import ConfigParameter from './ConfigParameter.js';
import AWS from 'aws-sdk';
import fs from 'fs';

class LoadTestResult {
  MAX_RECONNECTION_ALLOWED_AT_ANY_MINUTE = 100;
  constructor() {
    this.configParameter = new ConfigParameter('result');
    const resultGeneratorArgs = this.configParameter.getConfigParameters();
    this.logGroupName = resultGeneratorArgs.logGroupName;
    this.startTime = resultGeneratorArgs.startTime || Date.now() - 12*60*1000;
    this.endTime =  resultGeneratorArgs.endTime || Date.now();
    this.region = resultGeneratorArgs.region || 'us-east-1';
    this.sessionId = resultGeneratorArgs.sessionId || this.getLoadTestSessionId();
    this.cloudwatchlogs = new AWS.CloudWatchLogs({apiVersion: '2014-03-28', region: this.region});
    this.attributeRangeMap = {
      audioPacketsReceivedP99: [49, 51],
      audioDecoderLossP99: [0, 100],
      audioPacketsReceivedFractionLossP99: [0, 0.60],
      audioSpeakerDelayMsP99: [0, 100],
      inboundBandwidthP99: [5000, 10000],
      outboundBandwidthP99: [5000, 10000]
    };
  }

  async init() {
    const queryId = await this.runInsightQuery();
    let resultUsingQueryId = await this.getResultUsingQueryId(queryId);
    while (resultUsingQueryId.status === 'Running') {
      resultUsingQueryId = await this.getResultUsingQueryId(queryId);
    }
    this.computeBadMinutes(resultUsingQueryId);
  }

  async runInsightQuery() {
    const params = {
      endTime: this.endTime,
      logGroupName: this.logGroupName,
      queryString: this.getQueryStr(this.sessionId),
      startTime: this.startTime
    };
    console.log(params);
    try {
      const getQueryIdResponse = await this.cloudwatchlogs.startQuery(params).promise();
      if (getQueryIdResponse.queryId !== null) {
        return getQueryIdResponse;
      }
    } catch (err) {
      console.error('Cannot retrieve Query Id: ' + err);
    }
    return null;
  }

  async getResultUsingQueryId(queryId) {
    if (queryId === null) {
      return null;
    }
    try {
      const getQueryResults = await this.cloudwatchlogs.getQueryResults(queryId).promise();
      if (getQueryResults.status !== null) {
        return getQueryResults;
      }
    } catch (err) {
      console.error('Cannot retrieve results from query: ' + err);
    }
    return null;
  }

  computeBadMinutes(resultUsingQueryIdJSON) {
    if (resultUsingQueryIdJSON === null) {
      console.log('Bad Minutes cannot be computed...');
    }
    if(resultUsingQueryIdJSON?.status === 'Complete') {
      const queryResults = resultUsingQueryIdJSON.results;
      const totalNoReadings = queryResults.length;
      const badMinuteReason = this.identifyMetricsNotInRange(queryResults);
      const badMinuteCount = Object.keys(badMinuteReason).length
      console.log(badMinuteCount);
      if (totalNoReadings > 0) {
        const loadTestFailMinutePercentage = (badMinuteCount / totalNoReadings) * 100;
        console.log('Good Minute % ', 100 - loadTestFailMinutePercentage);
        console.log('Bad Minute % ', loadTestFailMinutePercentage);
        if (loadTestFailMinutePercentage > 0) {
          console.log('Bad Minute Details: ');
          console.log(badMinuteReason);
        }
        const result = loadTestFailMinutePercentage < 1 ? 'Success' : 'Fail';
        console.log('LOADTEST RESULT: ', result);
      }
    }
  }

  identifyMetricsNotInRange(queryResults) {
    const badMinuteReason = {};
    for (let iter = 0; iter < queryResults.length; iter += 1) {
      //not taking field minute into consideration, being used as timeAtWhichBadMinuteConditionSatisfied
      for(let attr = 1; attr < queryResults[iter].length; attr += 1) {
        const metricAttribute = queryResults[iter][attr];
        const field = metricAttribute.field;
        const value = parseInt(metricAttribute.value);
        if (this.satisfiesBadMinuteCondition(field, value)) {
          const timeAtWhichBadMinuteConditionSatisfied = queryResults[iter][0].value;
          if (!badMinuteReason.hasOwnProperty(timeAtWhichBadMinuteConditionSatisfied)) {
            badMinuteReason[timeAtWhichBadMinuteConditionSatisfied] = {};
          }
          badMinuteReason[timeAtWhichBadMinuteConditionSatisfied][field] = value;
        }
      }
    }
    return badMinuteReason;
  }

  satisfiesBadMinuteCondition(field, value) {
    const isAttributeInRange = (
      this.attributeRangeMap.hasOwnProperty(field) &&
      !(value >= this.attributeRangeMap[field][0] &&
        value <= this.attributeRangeMap[field][1])
    );

    const isReconnectionMoreThanLimit = (
      !this.attributeRangeMap.hasOwnProperty(field) &&
      field === 'ReconnectingSession' &&
      value > this.MAX_RECONNECTION_ALLOWED_AT_ANY_MINUTE
    );

    return isAttributeInRange || isReconnectionMoreThanLimit;
  }

  getQueryStr(sessionId) {
    const queryString = "fields @timestamp, @message" +
      "| filter @message like 'LoadTest-78956' " +
      "and @message like '\"audioPacketsReceived\":' " +
      "OR @message like '\"audioDecoderLoss\":' " +
      "OR @message like '\"audioPacketsReceivedFractionLoss\":' " +
      "OR @message like '\"audioSpeakerDelayMs\":' " +
      "OR @message like '\"inboundBandwidth\":' " +
      "OR @message like '\"outboundBandwidth\":' " +
      "OR @message like 'ReconnectingSession'  " +
      "OR @message like 'MeetingStarted' " +
      "| stats PCT(audioPacketsReceived, 99) as audioPacketsReceivedP99, " +
      "PCT(audioDecoderLoss, 99) as audioDecoderLossP99, " +
      "PCT(audioPacketsReceivedFractionLoss, 99) as audioPacketsReceivedFractionLossP99, " +
      "PCT(audioSpeakerDelayMs, 99) as audioSpeakerDelayMsP99, " +
      "PCT(inboundBandwidth, 99) as inboundBandwidthP99, " +
      "PCT(outboundBandwidth, 99) as outboundBandwidthP99, " +
      "sum(ReconnectingSession) as ReconnectingSessionSum " +
      "by bin(1m) as minute " +
      "| filter inboundBandwidthP99 > 0 " +
      "| sort minute asc ";

    return queryString;
  }

  getLoadTestSessionId() {
    const file = '../configs/LoadTestStatus.json';
    const rawData = fs.readFileSync(file);
    const jsonData = JSON.parse(rawData);
    let loadTestSessionId = null;
    if(jsonData.hasOwnProperty('LoadTestSessionId')) {
      loadTestSessionId = jsonData.LoadTestSessionId.toString();
    }
    return loadTestSessionId;
  }
}

new LoadTestResult().init();