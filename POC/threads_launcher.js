import {createRequire} from 'module';
import SQSOperations from './SQSOperations.js';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const {exec} = require('child_process');
const fs = require('fs');
const {Worker, isMainThread, parentPort, workerData} = require('worker_threads');

class WebRTCStatReport {
  constructor() {
    this.audioDecoderLossTotal = 0;
    this.audioPacketsReceivedTotal = 0;
    this.audioPacketsReceivedFractionLossTotal = 0;
    this.audioSpeakerDelayMsTotal = 0;
    this.availableReceiveBandwidthTotal = 0;
    this.totalReadings = 0;

    this.audioDecoderLossMinMax = [];
    this.audioPacketsReceivedMinMax = [];
    this.audioPacketsReceivedFractionLossMinMax = [];
    this.audioSpeakerDelayMsMinMax = [];
    this.availableReceiveBandwidthMinMax = [];

    this.audioDecoderLossAvg = 0;
    this.audioPacketsReceivedAvg = 0;
    this.audioPacketsReceivedFractionLossAvg = 0;
    this.audioSpeakerDelayMsAvg = 0;
    this.availableReceiveBandwidthAvg = 0;
  }
}

class MeetingLauncher {
  static MIN_ACTIVE_TIME_MS = 20000;   //1200000
  static MAX_ACTIVE_TIME_MS = 20500;   //1300000
  static METRIC_GRAB_FREQUENCY = 1000;
  static FILE_NAME = "./thread_launcher.js"
  static NO_ATTENDEES_PER_MEETING = 10;
  triggerClearInterval = new Map();
  leave = new Map();
  realTimeMetricAggregate = false;

  constructor() {
    this.run();
    this.done = 0;
  }

  getRndDuration() {
    return Math.floor(Math.random() * (MeetingLauncher.MAX_ACTIVE_TIME_MS - MeetingLauncher.MIN_ACTIVE_TIME_MS + 1)) + MeetingLauncher.MIN_ACTIVE_TIME_MS;
  }

  async done() {
    try {
      console.log('Done ');
    } catch (error) {
      console.log(error);
    }
  }

  createWorkerThread(startIndex, range, threadId, meetingsDirectory, meetingAttendeeList) {
    console.log(threadId , 'createddddd ');
    return (new Worker(MeetingLauncher.FILE_NAME, {
      workerData: {
        start: startIndex,
        range: range,
        threadId: threadId,
        meetingsDirectory: meetingsDirectory,
        meetingAttendeeList: meetingAttendeeList
      }
    }));
  }

  cleanup() {
    exec(`ps -aux | grep 'puppeteer' | xargs kill -9`);
    //exec(`ps -aux | grep 'node' | xargs kill -9`);
    //exec(`cd node_module`);
    //exec(`rm -rf puppeteer`);
  }

  async spawnThreads(meetingAttendeeList, threadCount, threads, meetingsDirectory) {
    const max = meetingAttendeeList.length;
    const min = 0;
    console.log(`Running with ${threadCount} threads...`);
    let start = min;

    if (max % threadCount === 0) {
      const range = (max / threadCount);
      for (let threadId = 0; threadId < threadCount; threadId++) {
        const startIndex = start;
        console.log(startIndex + ' ' + range + ' ' + threadId, meetingsDirectory);
        threads.add(this.createWorkerThread(startIndex, range, threadId, meetingsDirectory, meetingAttendeeList));
        this.putMetricData("thread_created", 1);
        start += range;
      }
    } else {
      let range = 1;
      if (threadCount <= max)
        range = Math.floor(max / threadCount);
      else
        range = Math.ceil(max / threadCount);
      let remainingDataCount = max - range * threadCount;
      for (let threadId = 0; threadId < threadCount && threadId <= max; threadId++) {
        const startIndex = start;
        if (remainingDataCount > 0) {
          console.log(startIndex + ' ' + (range + 1) + ' ' + threadId, meetingsDirectory);
          remainingDataCount -= 1;
          threads.add(this.createWorkerThread(startIndex, range + 1, threadId, meetingsDirectory, meetingAttendeeList));
          this.putMetricData("thread_created", 1);
          start += range + 1;
        } else {
          console.log(startIndex + ' ' + (range) + ' ' + threadId, meetingsDirectory);
          threads.add(this.createWorkerThread(startIndex, range, threadId, meetingsDirectory, meetingAttendeeList));
          this.putMetricData("thread_created", 1);
          start += range;
        }
      }
    }
  }

  putMetricData(metricName, metricValue, namespace = "CustomLT1") {
    exec(`aws cloudwatch put-metric-data --metric-name ${metricName} --dimensions Instance=i-0c51f9f1213e63159  --namespace ${namespace} --value ${metricValue}`);
  }

  async run() {
    if (isMainThread) {
      const sessionTimeStamp = new Date().toISOString();
      const threadCount = process.argv[2] || 2;
      const noOfMeetings = process.argv[3] || 10;
      const threads = new Set();
      let meetingAttendeeList = new SharedArrayBuffer();
      let meetingAttendeeArray = new Array();
      let meetingAttendeeListIndex = 0;
      const sqs = new SQSOperations();

      //for (let meeting = 0; meeting < noOfMeetings; meeting++) {
      while (meetingAttendeeArray.length < noOfMeetings * MeetingLauncher.NO_ATTENDEES_PER_MEETING) {
        console.log('ttertwt ', meetingAttendeeArray.length);
        try {
          const createMeetingWithAttendeesResponses = await sqs.getCreateMeetingWithAttendeesBodyFromSQS();
          for (let response = 0; response < Math.min(noOfMeetings, createMeetingWithAttendeesResponses.Messages.length); response += 1) {
            const meetingAttendeeInfo = JSON.parse(createMeetingWithAttendeesResponses.Messages[response].Body);
            if (meetingAttendeeInfo && meetingAttendeeInfo.Meeting && meetingAttendeeInfo.Attendees) {
              const meetingInfo = meetingAttendeeInfo.Meeting;
              const attendeeInfo = meetingAttendeeInfo.Attendees;
              for (let attendee = 0; attendee < attendeeInfo.length; attendee += 1) {
                meetingAttendeeArray[meetingAttendeeListIndex] = {
                  Meeting: meetingInfo,
                  Attendees: attendeeInfo[attendee]
                };
                meetingAttendeeListIndex += 1;
              }
            } else
              this.log('Empty SQS');
          }
        } catch (err) {
          this.error('Failed SQS retrieval' + err.message)
        }
        this.log(meetingAttendeeArray.length + ' meetingAttendeeArray ' + meetingAttendeeArray);
      }
      if (meetingAttendeeArray.length > 0) {
        this.log('meetingAttendeeArrayLength ' + meetingAttendeeArray.length);
        this.putMetricData("meetingAttendeeArrayLength", meetingAttendeeArray.length);

        let meetingsDirectory = 'Readings/MeetingsDirectory_' + sessionTimeStamp;

        try {
          if (!fs.existsSync(meetingsDirectory)) {
            fs.mkdirSync(meetingsDirectory, {recursive: true})
          }
        } catch (err) {
          console.error(err)
        }
        this.spawnThreads(meetingAttendeeArray, threadCount, threads, meetingsDirectory);
        let rtcStatReport = new WebRTCStatReport();
        for (let worker of threads) {
          worker.on('error', (err) => {
            console.error(err);

          });

          worker.on('exit', () => {
            threads.delete(worker);
            console.log(`Thread exiting, ${threads.size} running...`);
            this.putMetricData("thread_exit", 1);
            if (threads.size === 0) {
              console.log('Threads ended');
              this.printRTCStatReport(rtcStatReport, threadCount, this.realTimeMetricAggregate);
              meetingAttendeeList = null;
              meetingAttendeeArray = null;
              this.cleanup()
            }
          });

          worker.on('message', async (message) => {
            const threadStatReport = message.webRTCStatReport;
            console.log('threadStatReport ----  ');
            const threadId = message.threadId;
            this.aggregationOperation(rtcStatReport, threadCount, this.realTimeMetricAggregate);
          });
        }
      }
    } else {
      this.childThreadActivity();
    }
  }

  log(str, tabNo = '') {
    if (isMainThread) {
      console.log('[Master Thread] ' + str);
    } else {
      console.log(workerData.threadId + '  ' + tabNo + ' [Child Thread] ' + str);
    }
  }

  error(str, tabNo = '') {
    this.putMetricData("[ERROR]", 1);
    if (isMainThread) {
      console.log('[Master Thread ERROR] ' + str);
    } else {
      console.log(workerData.threadId + '  ' + tabNo + ' [Child Thread Error] ' + str);
    }
  }

  async childThreadActivity() {
    const browser = {};
    const webRTCStatReport = {};
    const reportFetch = new Map();
    const page = [];

    browser[workerData.threadId] = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--disable-dev-shm-usage',
        '--use-fake-device-for-media-stream',
        '--hostname localhost',
        '--no-sandbox', '--disable-setuid-sandbox',
        '--single-process', '--no-zygote'
      ],
    }).catch((err) => {
      this.error('Browser launch failed: ' + err);
      //browser[workerData.threadId] = null;
    });

    browser[workerData.threadId].on('error', async (message) => {
      //browser[workerData.threadId] = null;
      //restart(workerData.threadId, workerData.threadId )
      console.log('Browser Errored out ');
      this.createWorkerThread(workerData.start, workerData.range, workerData.threadId, workerData.meetingsDirectory, workerData.meetingAttendeeList);
    });
    browser[workerData.threadId].on('close', async (message) => {
      console.log('Browser Closedddd out ');
      //browser[workerData.threadId] = null;
    });

    browser[workerData.threadId].on('disconnect', async (message) => {
      console.log('Browser Disconnectedddd out ');
      //browser[workerData.threadId] = null;
    });

    webRTCStatReport[workerData.threadId] = new WebRTCStatReport();
    const sqs = new SQSOperations();
    let fileLocation = new Map();
    let dataToWriteToFile = new Map();
    let meetingsDirectory = workerData.meetingsDirectory;

    fs.access(meetingsDirectory, fs.F_OK, (err) => {
      if (err) {
        fs.mkdirSync(meetingsDirectory, {recursive: true});
      } else {
        if (err) throw err;
      }
    });

    if (browser[workerData.threadId]) {
      for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
        let meetingInfo = workerData.meetingAttendeeList[browserTab].Meeting;
        let attendeeInfo = workerData.meetingAttendeeList[browserTab].Attendees;

        if (browser[workerData.threadId] !== null && meetingInfo && attendeeInfo) {
          page[browserTab] = await browser[workerData.threadId].newPage().catch(() => {
            this.error('New page failed to loads ');
            page[browserTab] = null;
          });
          if(page[browserTab] !== null && browser[workerData.threadId].isConnected()) {
            page[browserTab].on('error', err => {
              this.error('Error occured: ' + err, browserTab);
              page[browserTab] = null;
            });
            page[browserTab].on('close', async (message) => {
              this.putMetricData('PageClosed', 1)
              //page[browserTab] = null;
              //restart(browser, page, mapPageMeetingIdAttendeeId)
              console.log('Page Closedddd');
            });
            const url = 'http://127.0.0.1:8080/?meetingInfo=' + encodeURIComponent(JSON.stringify(meetingInfo)) + '&attendeeInfo=' + encodeURIComponent(JSON.stringify(attendeeInfo));
            const response = await page[browserTab].goto(url).catch((err) => {
              this.error('Failed to load  ' + err);
              page[browserTab] = null;
              this.putMetricData("BrowserTabOpenFail", 1);
            }).then(() => {
              this.log('Opened localhost.... ', browserTab);
              this.putMetricData("BrowserTabOpenSuccess", 1);
            });

            const meetingId = meetingInfo.MeetingId;
            if (!fileLocation.has(meetingId)) {
              fileLocation[meetingId] = meetingsDirectory + '/' + meetingId;
              try {
                if (fs.existsSync(fileLocation[meetingId])) {
                  this.log('file exists');
                } else {
                  dataToWriteToFile[meetingId] = 'audioPacketsReceived,audioDecoderLoss,audioPacketsReceivedFractionLoss,audioSpeakerDelayMs,availableSendBandwidth,attendeeId\n'
                  fs.writeFile(fileLocation[meetingId] + '.csv', dataToWriteToFile[meetingId], function (err) {
                    if (err) {
                      console.log('Failed to write due to ' + err.message + dataToWriteToFile[meetingId]);
                    }
                    console.log(meetingId, ' Saved!' + dataToWriteToFile[meetingId]);
                  })
                }
              } catch (err) {
                this.error('File write: ' + err)
              }
            }
          }
        }
      }

      const now = Date.now();
      for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
        const meetingInfo = workerData.meetingAttendeeList[browserTab].Meeting;
        const attendeeInfo = workerData.meetingAttendeeList[browserTab].Attendees;
        const meetingId = meetingInfo.MeetingId;
        const attendeeId = attendeeInfo.AttendeeId;
        this.triggerClearInterval[browserTab] = false;
        this.leave[browserTab] = false;

        try {
          if (page[browserTab] !== null) {
            const meetingStartStatus = await page[browserTab].evaluate((attendeeId, meetingId, browserTab) => {
              return new Promise((resolve, reject) => {
                try {
                  document.getElementById('inputMeeting').value = meetingId;
                  document.getElementById('inputName').value = meetingId + ' : ' + browserTab + ' : ' + attendeeId;
                  document.getElementById('authenticate').click();
                  resolve('Success');
                } catch (err) {
                  resolve('Fail');
                }
              });
            }, attendeeId, meetingId, browserTab);
            if(meetingStartStatus === 'Success') {
              this.log('Meeting start SUCCESS on tab # ', browserTab);
              this.putMetricData("MeetingStartSuccess", 1);
            } else {
              this.log('Meeting start FAIL on tab # ', browserTab);
              this.putMetricData("MeetingStartFail", 1);
            }
          }
        } catch (err) {
          this.error('Exception on page evaluate ' + err, browserTab);
          this.putMetricData("MeetingStartFailPageEvaluate", 1);
        }
        await this.fetchMetricsFromBrowser(browser, page, reportFetch, meetingInfo, attendeeInfo, fileLocation, browserTab);
      }
      await this.setMeetingTimeout(page, reportFetch);
      this.individualThreadWebRTCAvgReading(webRTCStatReport, this.realTimeMetricAggregate);

      if (browser[workerData.threadId]) {
        await this.closeBrowser(browser[workerData.threadId]);
      }
      if (this.realTimeMetricAggregate) {
        parentPort.postMessage({
          threadId: workerData.threadId,
          webRTCStatReport: webRTCStatReport[workerData.threadId]
        });
      } else {
        parentPort.postMessage({
          threadId: workerData.threadId
        });
      }
    }
  }

  async fetchMetricsFromBrowser(browser, page, reportFetch, meetingInfo, attendeeInfo, fileLocation, browserTab) {
    reportFetch[browserTab] = setInterval(async () => {
      try {
        if (this.triggerClearInterval[browserTab] === false && browser[workerData.threadId] && browser[workerData.threadId].isConnected() && page[browserTab] !== null) {
          const metricReport = await page[browserTab].evaluate(() => {
            return new Promise((resolve, reject) => {
              try {
                if (app) {
                  let metricStatsForTab = app.metricReport;
                  resolve(metricStatsForTab);
                }
              } catch (err) {
                this.error('App is undefined ' + err);
              }
            });
          });
          if (metricReport.audioDecoderLoss || metricReport.audioPacketsReceived || metricReport.audioPacketsReceivedFractionLoss || metricReport.audioSpeakerDelayMs || metricReport.availableReceiveBandwidth || metricReport.availableSendBandwidth) {
            this.writeMetricsToFile(metricReport, attendeeInfo.AttendeeId, fileLocation[meetingInfo.MeetingId]);
          } else {
            this.log('Meeting inactive');
          }
          //this.writeMetric(metricReport, webRTCStatReport, this.realTimeMetricAggregate);
        }
      } catch (err) {
        this.error('87878787 ' + err.message)
      }
    }, MeetingLauncher.METRIC_GRAB_FREQUENCY);
  }

  async setMeetingTimeout(page, reportFetch) {
    const tabRandomDuration = new Map();
    for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
      if (!tabRandomDuration.has(browserTab)) {
        tabRandomDuration[browserTab] = this.getRndDuration();
      }
      setTimeout(async () => {
        try {
          if (page[browserTab] !== null) {
            this.log('Attempting to quit meeting', browserTab);
            const closeStatus = await page[browserTab].evaluate(async () => {
              return new Promise((resolve, reject) => {
                try {
                  document.getElementById('button-meeting-leave').click();
                  resolve('Success');
                } catch (err) {
                  resolve('Fail');
                }
              });
            });
            console.log('closeStatus ', closeStatus);
            if(closeStatus === 'Success') {
              this.log('Tab closed', browserTab);
              this.putMetricData("MeetingEndSuccess", 1);
            } else {
              this.error('Failed to end meeting ');
              this.putMetricData("MeetingEndFail", 1);
            }
          }
        } catch(err) {
          this.error('Failed to end meeting ' + err);
        } finally {
          clearInterval(reportFetch[browserTab]);
          this.leave[browserTab] = true;
          this.triggerClearInterval[browserTab] = true;
          if (page[browserTab] !== null) {
            await page[browserTab].close();
          }
        }
      }, tabRandomDuration[browserTab]);
    }
  }

  async closeBrowser(browser, waitFactor = 1.2) {
    if (browser.isConnected()) {
      await new Promise((resolve) => {
        this.log('Sleeping with waitfactor ' + waitFactor + ' for ' + MeetingLauncher.MAX_ACTIVE_TIME_MS * waitFactor);
        setTimeout(resolve, MeetingLauncher.MAX_ACTIVE_TIME_MS * waitFactor)
      });
      for (let value of this.leave.values()) {
        this.log('value ', value);
        this.log('value === false ', value === false);
        if (value === false) {
          waitFactor = 0.3;
          await this.closeBrowser(browser, waitFactor);
        }
      }
      this.log('Close browser initiated');
      await browser.disconnect();
      await browser.close();
      this.putMetricData("BrowserClose", 1);
    } else {
      return;
    }
  }

  writeMetricsToFile(webRTCStatReport, attendeeId, fileLocation) {
    let dataToWrite = '';
    if (typeof (webRTCStatReport.audioPacketsReceived) !== 'undefined') {
      dataToWrite += webRTCStatReport.audioPacketsReceived + ',';
    }
    if (typeof (webRTCStatReport.audioDecoderLoss) !== 'undefined') {
      dataToWrite += webRTCStatReport.audioDecoderLoss + ',';
    }
    if (typeof (webRTCStatReport.audioPacketsReceivedFractionLoss) !== 'undefined') {
      dataToWrite += Math.min(Math.max(webRTCStatReport.audioPacketsReceivedFractionLoss, 0), 1) + ',';
    }
    if (typeof (webRTCStatReport.audioSpeakerDelayMs) !== 'undefined') {
      dataToWrite += webRTCStatReport.audioSpeakerDelayMs + ',';
    }
    if (typeof (webRTCStatReport.availableSendBandwidth) !== 'undefined') {
      dataToWrite += webRTCStatReport.availableSendBandwidth + ',';
    }

    if (dataToWrite !== '') {
      try {
        const dataToWriteToFile = dataToWrite + attendeeId + '\n';
        fs.appendFile(fileLocation + '.csv', dataToWriteToFile, function (err) {
          if (err) {
            console.log('Failed to write due to ', err.message + dataToWriteToFile);
          }
          console.log('Saved!' + dataToWriteToFile);
        });
      } catch (err) {
        console.error(err.message);
      }
    }
  }

  individualThreadWebRTCAvgReading(webRTCStatReport, realTimeMetricAggregate = false) {
    if (realTimeMetricAggregate) {
      const threadWebRTCStatReport = webRTCStatReport[workerData.threadId];
      const totalReadingsByWorkerThread = threadWebRTCStatReport.totalReadings;
      if (threadWebRTCStatReport.totalReadings > 0) {
        threadWebRTCStatReport.audioDecoderLossAvg = threadWebRTCStatReport.audioDecoderLossTotal / totalReadingsByWorkerThread;
        threadWebRTCStatReport.audioPacketsReceivedAvg = threadWebRTCStatReport.audioPacketsReceivedTotal / totalReadingsByWorkerThread;
        threadWebRTCStatReport.audioPacketsReceivedFractionLossAvg = threadWebRTCStatReport.audioPacketsReceivedFractionLossTotal / totalReadingsByWorkerThread;
        threadWebRTCStatReport.audioSpeakerDelayMsAvg = threadWebRTCStatReport.audioSpeakerDelayMsTotal / totalReadingsByWorkerThread;
        threadWebRTCStatReport.availableReceiveBandwidthAvg = threadWebRTCStatReport.availableReceiveBandwidthTotal / totalReadingsByWorkerThread;
      } else {
        console.log(workerData.threadId + 'threadReadings is 0 0000000 ');
      }
    }
  }

  writeMetric(metricReport, webRTCStatReport, realTimeMetricAggregate = false) {
    if (realTimeMetricAggregate) {
      let metricsStr = '[';
      const workerDataThreadId = workerData.threadId;
      const webRTCStatReportWorkerThread = webRTCStatReport[workerDataThreadId];

      if (typeof (metricReport.audioDecoderLoss) !== 'undefined') {
        const metricReportAudioDecoderLoss = metricReport.audioDecoderLoss;
        metricsStr += 'audioDecoderLoss: ' + metricReportAudioDecoderLoss + '; ';
        webRTCStatReportWorkerThread.audioDecoderLossTotal += metricReportAudioDecoderLoss;

        webRTCStatReportWorkerThread.audioDecoderLossMinMax[0] = !webRTCStatReportWorkerThread.audioDecoderLossMinMax[0] ? metricReportAudioDecoderLoss : Math.min(webRTCStatReportWorkerThread.audioDecoderLossMinMax[0], metricReportAudioDecoderLoss);
        webRTCStatReportWorkerThread.audioDecoderLossMinMax[1] = !webRTCStatReportWorkerThread.audioDecoderLossMinMax[1] ? metricReportAudioDecoderLoss : Math.max(webRTCStatReportWorkerThread.audioDecoderLossMinMax[1], metricReportAudioDecoderLoss);
      }

      if (typeof (metricReport.audioPacketsReceived) !== 'undefined') {
        const metricReportAudioPacketsReceived = metricReport.audioPacketsReceived;
        metricsStr += 'audioPacketsReceived: ' + metricReportAudioPacketsReceived + '; ';
        webRTCStatReportWorkerThread.audioPacketsReceivedTotal += metricReportAudioPacketsReceived;

        webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[0] = !webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[0] ? metricReportAudioPacketsReceived : Math.min(webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[0], metricReportAudioPacketsReceived);
        webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[1] = !webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[1] ? metricReportAudioPacketsReceived : Math.max(webRTCStatReportWorkerThread.audioPacketsReceivedMinMax[1], metricReportAudioPacketsReceived);

      }
      if (typeof (metricReport.audioPacketsReceivedFractionLoss) !== 'undefined') {
        const metricReportAudioPacketsReceivedFractionLoss = metricReport.audioPacketsReceivedFractionLoss;
        metricsStr += 'audioPacketsReceivedFractionLoss: ' + metricReportAudioPacketsReceivedFractionLoss + '; ';
        webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossTotal += metricReportAudioPacketsReceivedFractionLoss;

        webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[0] = !webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[0] ? metricReportAudioPacketsReceivedFractionLoss : Math.min(webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[0], metricReportAudioPacketsReceivedFractionLoss);
        webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[1] = !webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[1] ? metricReportAudioPacketsReceivedFractionLoss : Math.max(webRTCStatReportWorkerThread.audioPacketsReceivedFractionLossMinMax[1], metricReportAudioPacketsReceivedFractionLoss);
      }
      if (typeof (metricReport.audioSpeakerDelayMs) !== 'undefined') {
        const metricReportAudioSpeakerDelayMs = metricReport.audioSpeakerDelayMs;
        metricsStr += 'audioSpeakerDelayMs: ' + metricReportAudioSpeakerDelayMs + '; ';
        webRTCStatReportWorkerThread.audioSpeakerDelayMsTotal += metricReportAudioSpeakerDelayMs;

        webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[0] = !webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[0] ? metricReportAudioSpeakerDelayMs : Math.min(webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[0], metricReportAudioSpeakerDelayMs);
        webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[1] = !webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[1] ? metricReportAudioSpeakerDelayMs : Math.max(webRTCStatReportWorkerThread.audioSpeakerDelayMsMinMax[1], metricReportAudioSpeakerDelayMs);
      }
      if (typeof (metricReport.availableReceiveBandwidth) !== 'undefined') {
        const metricReportAvailableReceiveBandwidth = metricReport.availableReceiveBandwidth;
        metricsStr += 'availableReceiveBandwidth: ' + metricReportAvailableReceiveBandwidth + '; ';
        webRTCStatReportWorkerThread.availableReceiveBandwidthTotal += metricReportAvailableReceiveBandwidth;

        webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[0] = !webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[0] ? metricReportAvailableReceiveBandwidth : Math.min(webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[0], metricReportAvailableReceiveBandwidth);
        webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[1] = !webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[1] ? metricReportAvailableReceiveBandwidth : Math.max(webRTCStatReportWorkerThread.availableReceiveBandwidthMinMax[1], metricReportAvailableReceiveBandwidth);
      }

      metricsStr += ']';
      if (metricsStr.length > 3) {
        webRTCStatReportWorkerThread.totalReadings += 1;
      }
      return metricsStr;
    }
  }

  aggregationOperation(rtcStatReport, threadStatReport, realTimeMetricAggregate = false) {
    if (realTimeMetricAggregate) {
      rtcStatReport.audioDecoderLossAvg += threadStatReport.audioDecoderLossAvg;
      rtcStatReport.audioPacketsReceivedAvg += threadStatReport.audioPacketsReceivedAvg;
      rtcStatReport.audioPacketsReceivedFractionLossAvg += threadStatReport.audioPacketsReceivedFractionLossAvg;
      rtcStatReport.audioSpeakerDelayMsAvg += threadStatReport.audioSpeakerDelayMsAvg;
      rtcStatReport.availableReceiveBandwidthAvg += threadStatReport.availableReceiveBandwidthAvg;
      rtcStatReport.totalReadings += threadStatReport.totalReadings;

      console.log('audioDecoderLoss MinMax: ' + threadStatReport.audioDecoderLossMinMax);
      console.log('audioPacketsReceived MinMax: ' + threadStatReport.audioPacketsReceivedMinMax);
      console.log('audioPacketsReceivedFractionLoss MinMax: ' + threadStatReport.audioPacketsReceivedFractionLossMinMax);
      console.log('audioSpeakerDelayMs MinMax: ' + threadStatReport.audioSpeakerDelayMsMinMax);
      console.log('availableReceiveBandwidth MinMax: ' + threadStatReport.availableReceiveBandwidthMinMax);

      console.log(' -------- - - - --------------------- - - - ---------------------');
      console.log('audioDecoderLoss MinMax: ' + rtcStatReport.audioDecoderLossMinMax);
      console.log('audioPacketsReceived MinMax: ' + rtcStatReport.audioPacketsReceivedMinMax);
      console.log('audioPacketsReceivedFractionLoss MinMax: ' + rtcStatReport.audioPacketsReceivedFractionLossMinMax);
      console.log('audioSpeakerDelayMs MinMax: ' + rtcStatReport.audioSpeakerDelayMsMinMax);
      console.log('availableReceiveBandwidth MinMax: ' + rtcStatReport.availableReceiveBandwidthMinMax);

      rtcStatReport.audioDecoderLossMinMax[0] = !rtcStatReport.audioDecoderLossMinMax[0] ? threadStatReport.audioDecoderLossMinMax[0] : Math.min(rtcStatReport.audioDecoderLossMinMax[0], threadStatReport.audioDecoderLossMinMax[0]);
      rtcStatReport.audioDecoderLossMinMax[1] = !rtcStatReport.audioDecoderLossMinMax[1] ? threadStatReport.audioDecoderLossMinMax[1] : Math.max(rtcStatReport.audioDecoderLossMinMax[1], threadStatReport.audioDecoderLossMinMax[1]);

      rtcStatReport.audioPacketsReceivedMinMax[0] = !rtcStatReport.audioPacketsReceivedMinMax[0] ? threadStatReport.audioPacketsReceivedMinMax[0] : Math.min(rtcStatReport.audioPacketsReceivedMinMax[0], threadStatReport.audioPacketsReceivedMinMax[0]);
      rtcStatReport.audioPacketsReceivedMinMax[1] = !rtcStatReport.audioPacketsReceivedMinMax[1] ? threadStatReport.audioPacketsReceivedMinMax[1] : Math.max(rtcStatReport.audioPacketsReceivedMinMax[1], threadStatReport.audioPacketsReceivedMinMax[1]);

      rtcStatReport.audioPacketsReceivedFractionLossMinMax[0] = !rtcStatReport.audioPacketsReceivedFractionLossMinMax[0] ? threadStatReport.audioPacketsReceivedFractionLossMinMax[0] : Math.min(rtcStatReport.audioPacketsReceivedFractionLossMinMax[0], threadStatReport.audioPacketsReceivedFractionLossMinMax[0]);
      rtcStatReport.audioPacketsReceivedFractionLossMinMax[1] = !rtcStatReport.audioPacketsReceivedFractionLossMinMax[1] ? threadStatReport.audioPacketsReceivedFractionLossMinMax[1] : Math.max(rtcStatReport.audioPacketsReceivedFractionLossMinMax[1], threadStatReport.audioPacketsReceivedFractionLossMinMax[1]);

      rtcStatReport.audioSpeakerDelayMsMinMax[0] = !rtcStatReport.audioSpeakerDelayMsMinMax[0] ? threadStatReport.audioSpeakerDelayMsMinMax[0] : Math.min(rtcStatReport.audioSpeakerDelayMsMinMax[0], threadStatReport.audioSpeakerDelayMsMinMax[0]);
      rtcStatReport.audioSpeakerDelayMsMinMax[1] = !rtcStatReport.audioSpeakerDelayMsMinMax[1] ? threadStatReport.audioSpeakerDelayMsMinMax[1] : Math.max(rtcStatReport.audioSpeakerDelayMsMinMax[1], threadStatReport.audioSpeakerDelayMsMinMax[1]);

      rtcStatReport.availableReceiveBandwidthMinMax[0] = !rtcStatReport.availableReceiveBandwidthMinMax[0] ? threadStatReport.availableReceiveBandwidthMinMax[0] : Math.min(rtcStatReport.availableReceiveBandwidthMinMax[0], threadStatReport.availableReceiveBandwidthMinMax[0]);
      rtcStatReport.availableReceiveBandwidthMinMax[1] = !rtcStatReport.availableReceiveBandwidthMinMax[1] ? threadStatReport.availableReceiveBandwidthMinMax[1] : Math.max(rtcStatReport.availableReceiveBandwidthMinMax[1], threadStatReport.availableReceiveBandwidthMinMax[1]);

      console.log(' --------  - - - --------------------- - - - ---------------------');
      console.log('audioDecoderLoss MinMax: ' + rtcStatReport.audioDecoderLossMinMax);
      console.log('audioPacketsReceived MinMax: ' + rtcStatReport.audioPacketsReceivedMinMax);
      console.log('audioPacketsReceivedFractionLoss MinMax: ' + rtcStatReport.audioPacketsReceivedFractionLossMinMax);
      console.log('audioSpeakerDelayMs MinMax: ' + rtcStatReport.audioSpeakerDelayMsMinMax);
      console.log('availableReceiveBandwidth MinMax: ' + rtcStatReport.availableReceiveBandwidthMinMax);
    }
  }

  printRTCStatReport(rtcStatReport, threadCount, realTimeMetricAggregate = false) {
    if (realTimeMetricAggregate) {
      const totalReadings = rtcStatReport.totalReadings;
      console.log('totalReadings: ' + totalReadings);
      console.log('audioDecoderLoss Avg: ' + rtcStatReport.audioDecoderLossAvg / threadCount);
      console.log('audioPacketsReceived Avg: ' + rtcStatReport.audioPacketsReceivedAvg / threadCount);
      console.log('audioPacketsReceivedFractionLoss Avg: ' + rtcStatReport.audioPacketsReceivedFractionLossAvg / threadCount);
      console.log('audioSpeakerDelayMs Avg: ' + rtcStatReport.audioSpeakerDelayMsAvg / threadCount);
      console.log('availableReceiveBandwidth Avg: ' + rtcStatReport.availableReceiveBandwidthAvg / threadCount);

      console.log('totalReadings: ' + totalReadings);
      console.log('audioDecoderLoss MinMax: ' + rtcStatReport.audioDecoderLossMinMax);
      console.log('audioPacketsReceived MinMax: ' + rtcStatReport.audioPacketsReceivedMinMax);
      console.log('audioPacketsReceivedFractionLoss MinMax: ' + rtcStatReport.audioPacketsReceivedFractionLossMinMax);
      console.log('audioSpeakerDelayMs MinMax: ' + rtcStatReport.audioSpeakerDelayMsMinMax);
      console.log('availableReceiveBandwidth MinMax: ' + rtcStatReport.availableReceiveBandwidthMinMax);
    }
  }
}

new MeetingLauncher();