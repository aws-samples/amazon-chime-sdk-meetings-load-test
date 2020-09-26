import puppeteer from 'puppeteer';
import {exec} from 'child_process';
import fs from 'fs';
import WebRTCStatReport from './WebRTCStats.js';

import {Worker, isMainThread, parentPort, workerData} from 'worker_threads';



export default class MeetingLauncher {
  static MIN_ACTIVE_TIME_MS = 1000000;   //1200000
  //const MIN_ACTIVE_TIME_MS = 193071;   //1200000
  static MAX_ACTIVE_TIME_MS = 1005000;   //1300000

  constructor(sessionTimestamp) {
    this.sessionTimeStamp = sessionTimestamp;
    console.log(this.sessionTimeStamp);
    this.browserThreadMap = [];
    this.run();
    this.done = 0;

  }

  getRndDuration() {
    return Math.floor(Math.random() * (MeetingLauncher.MAX_ACTIVE_TIME_MS - MeetingLauncher.MIN_ACTIVE_TIME_MS + 1)) + MeetingLauncher.MIN_ACTIVE_TIME_MS;
  }


  async done() {
    try {
      console.log('Done ' + done);
      this.done = done + 1;
    } catch (error) {
      console.log(error);
    }
  }

  createWorkerThread(startIndex, range, threadId) {
    return (new Worker(__filename, {workerData: {start: startIndex, range: range, threadId: threadId}}));
  }

  cleanup() {

    exec(`ps -aux | grep 'puppeteer' | xargs kill -9`);
    exec(`ps -aux | grep 'chrome' | xargs kill -9`)
    // const whoami = exec("whoami", { encoding: 'utf-8' });
    // console.log(whoami);
    // change the username to ec2user and add somne delay
    // prefer to use `ps -aux | grep 'puppeteer' | xargs kill -9`
    // const killCommand = "pgrep -U ridip|xargs kill -9";
    // console.log(killCommand);
    // exec(killCommand);
  }

  spawnThreads(arr, threadCount, threads) {
    const max = arr.length;
    console.log(arr);
    console.log(max);
    const min = 0;
    console.log(`Running with ${threadCount} threads...`);

    let start = min;

    if (max % threadCount === 0) {
      const range = (max / threadCount);
      for (let threadId = 0; threadId < threadCount; threadId++) {
        const startIndex = start;
        console.log(startIndex + ' ' + range + ' ' + threadId);
        threads.add(this.createWorkerThread(startIndex, range, threadId));
        this.browserThreadMap.push(0);
        start += range;
      }
    } else {
      let range = 1;
      if (threadCount <= max)
        range = Math.floor(max / threadCount);
      else
        range = Math.ceil(max / threadCount);

      console.log(range);
      let remainingDataCount = max - range * threadCount;
      console.log(remainingDataCount);

      for (let threadId = 0; threadId < threadCount && threadId <= max; threadId++) {
        const startIndex = start;
        if (remainingDataCount > 0) {
          console.log(startIndex + ' ' + (range + 1) + ' ' + threadId);
          remainingDataCount -= 1;
          threads.add(this.createWorkerThread(startIndex, range + 1, threadId));
          start += range + 1;
        } else {
          console.log(startIndex + ' ' + (range) + ' ' + threadId);
          threads.add(this.createWorkerThread(startIndex, range, threadId));
          start += range;
        }
        this.browserThreadMap.push(0);
      }
    }
  }

  async run() {
    console.log(this.sessionTimeStamp);

    if (isMainThread) {
      // This code is executed in the main thread and not in the worker.
      const threadCount = process.argv[2] || 2;
      const arrSize = process.argv[3] || 10;
      const threads = new Set();
      const arr = [];

      //for fixed size array

      for (let j = 0; j < arrSize; j++)
        arr.push(j);

      this.spawnThreads(arr, threadCount, threads);

      let rtcStatReport = new WebRTCStatReport();

      for (let worker of threads) {

        worker.on('error', (err) => {
          console.error(err)
        });

        worker.on('exit', () => {
          threads.delete(worker);
          console.log(`Thread exiting, ${threads.size} running...`);
          if (threads.size === 0) {
            console.log('Threads ended');
            // const totalReadings = rtcStatReport.totalReadings;
            // console.log('totalReadings: ' + totalReadings);
            // console.log('audioDecoderLoss Avg: ' + rtcStatReport.audioDecoderLossAvg / threadCount);
            // console.log('audioPacketsReceived Avg: ' + rtcStatReport.audioPacketsReceivedAvg / threadCount);
            // console.log('audioPacketsReceivedFractionLoss Avg: ' + rtcStatReport.audioPacketsReceivedFractionLossAvg / threadCount);
            // console.log('audioSpeakerDelayMs Avg: ' + rtcStatReport.audioSpeakerDelayMsAvg / threadCount);
            // console.log('availableReceiveBandwidth Avg: ' + rtcStatReport.availableReceiveBandwidthAvg / threadCount);
            // //console.log('availableSendBandwidth Avg: ' + rtcStatReport.availableSendBandwidthAvg / threadCount);
            //
            // console.log('totalReadings: ' + totalReadings);
            // console.log('audioDecoderLoss MinMax: ' + rtcStatReport.audioDecoderLossMinMax);
            // console.log('audioPacketsReceived MinMax: ' + rtcStatReport.audioPacketsReceivedMinMax);
            // console.log('audioPacketsReceivedFractionLoss MinMax: ' + rtcStatReport.audioPacketsReceivedFractionLossMinMax);
            // console.log('audioSpeakerDelayMs MinMax: ' + rtcStatReport.audioSpeakerDelayMsMinMax);
            //console.log('availableReceiveBandwidth MinMax: ' + rtcStatReport.availableReceiveBandwidthMinMax);
            //console.log('availableSendBandwidth MinMax: ' + rtcStatReport.availableSendBandwidthMinMax);
            this.cleanup()
          }
        });

        worker.on('message', async (message) => {
          const threadStatReport = message.webRTCStatReport;
          console.log('threadStatReport ----  ');
          console.log(message);
          const threadId = message.threadId;
          // rtcStatReport.audioDecoderLossAvg += threadStatReport.audioDecoderLossAvg;
          // rtcStatReport.audioPacketsReceivedAvg += threadStatReport.audioPacketsReceivedAvg;
          // rtcStatReport.audioPacketsReceivedFractionLossAvg += threadStatReport.audioPacketsReceivedFractionLossAvg;
          // rtcStatReport.audioSpeakerDelayMsAvg += threadStatReport.audioSpeakerDelayMsAvg;
          // rtcStatReport.availableReceiveBandwidthAvg += threadStatReport.availableReceiveBandwidthAvg;
          // //rtcStatReport.availableSendBandwidthAvg += threadStatReport.availableSendBandwidthAvg;
          // rtcStatReport.totalReadings += threadStatReport.totalReadings;
          //
          //
          // console.log('audioDecoderLoss MinMax: ' + threadStatReport.audioDecoderLossMinMax);
          // console.log('audioPacketsReceived MinMax: ' + threadStatReport.audioPacketsReceivedMinMax);
          // console.log('audioPacketsReceivedFractionLoss MinMax: ' + threadStatReport.audioPacketsReceivedFractionLossMinMax);
          // console.log('audioSpeakerDelayMs MinMax: ' + threadStatReport.audioSpeakerDelayMsMinMax);
          // console.log('availableReceiveBandwidth MinMax: ' + threadStatReport.availableReceiveBandwidthMinMax);
          // //console.log('availableSendBandwidth MinMax: ' + threadStatReport.availableSendBandwidthMinMax);
          //
          // console.log(' -------- - - - --------------------- - - - ---------------------');
          // console.log('audioDecoderLoss MinMax: ' + rtcStatReport.audioDecoderLossMinMax);
          // console.log('audioPacketsReceived MinMax: ' + rtcStatReport.audioPacketsReceivedMinMax);
          // console.log('audioPacketsReceivedFractionLoss MinMax: ' + rtcStatReport.audioPacketsReceivedFractionLossMinMax);
          // console.log('audioSpeakerDelayMs MinMax: ' + rtcStatReport.audioSpeakerDelayMsMinMax);
          // console.log('availableReceiveBandwidth MinMax: ' + rtcStatReport.availableReceiveBandwidthMinMax);
          // //console.log('availableSendBandwidth MinMax: ' + rtcStatReport.availableSendBandwidthMinMax);
          //
          //
          // rtcStatReport.audioDecoderLossMinMax[0] = !rtcStatReport.audioDecoderLossMinMax[0] ? threadStatReport.audioDecoderLossMinMax[0] : Math.min(rtcStatReport.audioDecoderLossMinMax[0], threadStatReport.audioDecoderLossMinMax[0]);
          // rtcStatReport.audioDecoderLossMinMax[1] = !rtcStatReport.audioDecoderLossMinMax[1] ? threadStatReport.audioDecoderLossMinMax[1] : Math.max(rtcStatReport.audioDecoderLossMinMax[1], threadStatReport.audioDecoderLossMinMax[1]);
          //
          // rtcStatReport.audioPacketsReceivedMinMax[0] = !rtcStatReport.audioPacketsReceivedMinMax[0] ? threadStatReport.audioPacketsReceivedMinMax[0] : Math.min(rtcStatReport.audioPacketsReceivedMinMax[0], threadStatReport.audioPacketsReceivedMinMax[0]);
          // rtcStatReport.audioPacketsReceivedMinMax[1] = !rtcStatReport.audioPacketsReceivedMinMax[1] ? threadStatReport.audioPacketsReceivedMinMax[1] : Math.max(rtcStatReport.audioPacketsReceivedMinMax[1], threadStatReport.audioPacketsReceivedMinMax[1]);
          //
          // rtcStatReport.audioPacketsReceivedFractionLossMinMax[0] = !rtcStatReport.audioPacketsReceivedFractionLossMinMax[0] ? threadStatReport.audioPacketsReceivedFractionLossMinMax[0] : Math.min(rtcStatReport.audioPacketsReceivedFractionLossMinMax[0], threadStatReport.audioPacketsReceivedFractionLossMinMax[0]);
          // rtcStatReport.audioPacketsReceivedFractionLossMinMax[1] = !rtcStatReport.audioPacketsReceivedFractionLossMinMax[1] ? threadStatReport.audioPacketsReceivedFractionLossMinMax[1] : Math.max(rtcStatReport.audioPacketsReceivedFractionLossMinMax[1], threadStatReport.audioPacketsReceivedFractionLossMinMax[1]);
          //
          // rtcStatReport.audioSpeakerDelayMsMinMax[0] = !rtcStatReport.audioSpeakerDelayMsMinMax[0] ? threadStatReport.audioSpeakerDelayMsMinMax[0] : Math.min(rtcStatReport.audioSpeakerDelayMsMinMax[0], threadStatReport.audioSpeakerDelayMsMinMax[0]);
          // rtcStatReport.audioSpeakerDelayMsMinMax[1] = !rtcStatReport.audioSpeakerDelayMsMinMax[1] ? threadStatReport.audioSpeakerDelayMsMinMax[1] : Math.max(rtcStatReport.audioSpeakerDelayMsMinMax[1], threadStatReport.audioSpeakerDelayMsMinMax[1]);
          //
          // rtcStatReport.availableReceiveBandwidthMinMax[0] = !rtcStatReport.availableReceiveBandwidthMinMax[0] ? threadStatReport.availableReceiveBandwidthMinMax[0] : Math.min(rtcStatReport.availableReceiveBandwidthMinMax[0], threadStatReport.availableReceiveBandwidthMinMax[0]);
          // rtcStatReport.availableReceiveBandwidthMinMax[1] = !rtcStatReport.availableReceiveBandwidthMinMax[1] ? threadStatReport.availableReceiveBandwidthMinMax[1] : Math.max(rtcStatReport.availableReceiveBandwidthMinMax[1], threadStatReport.availableReceiveBandwidthMinMax[1]);

          // console.log(' --------  - - - --------------------- - - - ---------------------');
          // console.log('audioDecoderLoss MinMax: ' + rtcStatReport.audioDecoderLossMinMax);
          // console.log('audioPacketsReceived MinMax: ' + rtcStatReport.audioPacketsReceivedMinMax);
          // console.log('audioPacketsReceivedFractionLoss MinMax: ' + rtcStatReport.audioPacketsReceivedFractionLossMinMax);
          // console.log('audioSpeakerDelayMs MinMax: ' + rtcStatReport.audioSpeakerDelayMsMinMax);
          // console.log('availableReceiveBandwidth MinMax: ' + rtcStatReport.availableReceiveBandwidthMinMax);

        });
      }
    } else {
      console.log(this.sessionTimeStamp);

      this.childThreadActivity();

    }
  }

  async childThreadActivity() {
    const browser = {};
    const tabRandomDuration = new Map();
    const reportFetch = new Map();
    const triggerClearInterval = new Map();
    const webRTCStatReport = {};


    const page = [];
    const meetingId = Math.random();



    browser[workerData.threadId] = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--hostname localhost',
        '--no-sandbox', '--disable-setuid-sandbox',
        '--single-process', '--no-zygote'
      ],
    });

    this.browserThreadMap[workerData.threadId] = browser;
    webRTCStatReport[workerData.threadId] = new WebRTCStatReport();

    for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
      page[browserTab] = await browser[workerData.threadId].newPage();
      page[browserTab].on('error', err=> {
        console.log('error occured: ', err);
      });
      page[browserTab].on('page error', pageerr=> {
        console.log('page error occurred: ', pageerr);
      })
      await page[browserTab].goto('http://127.0.0.1:8080/?m=' + meetingId).catch(()=>{console.log('Failed to load localhost')});
    }

    const now = Date.now();
    const meetingsDirectory = 'MeetingsDirectory_' + this.sessionTimeStamp;
    fs.existsSync(meetingsDirectory) || fs.mkdirSync(meetingsDirectory);
    const fileLocation = meetingsDirectory + '/' + meetingId;

    for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
      const attendeeId = Math.random();
      triggerClearInterval[browserTab] = false;
      if (!tabRandomDuration.has(browserTab)) {
        tabRandomDuration[browserTab] = this.getRndDuration();
      }
      try {
        await page[browserTab].evaluate((attendee, meetingId, browserTab) => {
          document.getElementById('inputName').value = meetingId + ' : ' + browserTab + ' : ' + attendee;
          document.getElementById('authenticate').click();
        }, attendeeId, meetingId, browserTab);
      } catch (e) {
        console.log('an expection on page.evaluate ', e);
      }
      await new Promise(resolve => setTimeout(resolve, 750));

      reportFetch[browserTab] = setInterval(async () => {
        try {
          //console.log(workerData.threadId, 'triggerClearInterval ', triggerClearInterval);

          if (triggerClearInterval[browserTab] === false && browser[workerData.threadId].isConnected()) {
            const metricReport = await page[browserTab].evaluate(() => {

              return new Promise((resolve, reject) => {
                if (app) {
                  let metricStatsForTab = app.metricReport;
                  resolve(metricStatsForTab);
                }
              });
            });

            if (metricReport) {
              var now_2 = Date.now();
              console.log(now_2 - now);
              console.log(now_2);
              console.log(now);
              //const metricsStr = this.writeMetric(metricReport, webRTCStatReport);
              //console.log(workerData.threadId + '--> ' + browserTab + ' : ' + meetingId + ' : ' + attendeeId + ' : ' + metricsStr);
              console.log(metricReport)
              this.writeMetricsToFile(metricReport, attendeeId, fileLocation);
            }
          }
        } catch (err) {
          console.log(err.message)
        }
      }, 1000);
      console.log('reportFetch[browserTab] ', reportFetch[browserTab]);
      setTimeout(async () => {
        triggerClearInterval[browserTab] = true;
        try {
          await page[browserTab].evaluate(async () => {
            document.getElementById('button-meeting-leave').click();
          });
        } catch (e) {
          console.log('an expection on page.evaluate ', e);
        }
        //console.log('clear interval called');

        if (triggerClearInterval[browserTab] === true) {
          console.log(browserTab + ' clear interval called');
          clearInterval(reportFetch[browserTab]);
        }
      }, tabRandomDuration[browserTab]);
    }

    if (browser[workerData.threadId].isConnected()) {
      await new Promise((resolve) => {
        console.log(workerData.threadId + ' sleepinggggggg forrrrrrrr', MeetingLauncher.MAX_ACTIVE_TIME_MS, ' browser ', browser);
        setTimeout(resolve, MeetingLauncher.MAX_ACTIVE_TIME_MS)
      });
      console.log('Close browser initiated');
      await browser[workerData.threadId].close();

      //this.individualThreadWebRTCAvgReading(webRTCStatReport);

    }
    parentPort.postMessage({threadId: workerData.threadId, webRTCStatReport: webRTCStatReport[workerData.threadId]});
  }


  writeMetricsToFile(webRTCStatReport, attendeeId, fileLocation) {
    console.log(webRTCStatReport)
    console.log(fileLocation)
    var timestamp = new Date().toISOString();
    // var utcDate = new Date(date.toUTCString());
    // utcDate.setHours(utcDate.getHours()-7);
    // var now = new Date(utcDate);
    // var strNow = now.getUTCFullYear().toString() + "/" +
    //   (now.getUTCMonth() + 1).toString() +
    //   "/" + now.getUTCDate() + " " + now.getUTCHours() +
    //   ":" + now.getUTCMinutes() + ":" + now.getUTCSeconds();

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

    // fs.mkdir(meetingsDirectory, (err) => {
    //
    //   console.log(meetingsDirectory + 'Created');
    // });

    if (dataToWrite !== '') {
      const dataToWriteToFile = dataToWrite + attendeeId + ',' + timestamp + '\n';
      fs.appendFile(fileLocation + '.csv', dataToWriteToFile, function (err) {
        if (err) {
          console.log('Failed to write due to ' , err.message + dataToWriteToFile);
        }
        console.log('Saved!' + dataToWriteToFile);
      });
    }

  }


  individualThreadWebRTCAvgReading(webRTCStatReport) {
    const threadWebRTCStatReport = webRTCStatReport[workerData.threadId];
    const totalReadingsByWorkerThread = threadWebRTCStatReport.totalReadings;
    if (threadWebRTCStatReport.totalReadings > 0) {
      threadWebRTCStatReport.audioDecoderLossAvg = threadWebRTCStatReport.audioDecoderLossTotal / totalReadingsByWorkerThread;
      threadWebRTCStatReport.audioPacketsReceivedAvg = threadWebRTCStatReport.audioPacketsReceivedTotal / totalReadingsByWorkerThread;
      threadWebRTCStatReport.audioPacketsReceivedFractionLossAvg = threadWebRTCStatReport.audioPacketsReceivedFractionLossTotal / totalReadingsByWorkerThread;
      threadWebRTCStatReport.audioSpeakerDelayMsAvg = threadWebRTCStatReport.audioSpeakerDelayMsTotal / totalReadingsByWorkerThread;
      threadWebRTCStatReport.availableReceiveBandwidthAvg = threadWebRTCStatReport.availableReceiveBandwidthTotal / totalReadingsByWorkerThread;
      //threadWebRTCStatReport.availableSendBandwidthAvg = threadWebRTCStatReport.availableSendBandwidthTotal / totalReadingsByWorkerThread;
    } else {
      console.log(workerData.threadId + 'threadReadings is 0 0000000 ');
    }
  }

  writeMetric(metricReport, webRTCStatReport) {

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