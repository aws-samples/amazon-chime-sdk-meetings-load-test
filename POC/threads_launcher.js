import {createRequire} from "module";
import SQSOperations from '../SQSOperations.js';

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
    // this.availableSendBandwidthTotal = 0;
    this.totalReadings = 0;

    this.audioDecoderLossMinMax = [];
    this.audioPacketsReceivedMinMax = [];
    this.audioPacketsReceivedFractionLossMinMax = [];
    this.audioSpeakerDelayMsMinMax = [];
    this.availableReceiveBandwidthMinMax = [];
    //this.availableSendBandwidthMinMax = [0,0];

    this.audioDecoderLossAvg = 0;
    this.audioPacketsReceivedAvg = 0;
    this.audioPacketsReceivedFractionLossAvg = 0;
    this.audioSpeakerDelayMsAvg = 0;
    this.availableReceiveBandwidthAvg = 0;
    //this.availableSendBandwidthAvg = 0;
  }
}


class MeetingLauncher {
  static MIN_ACTIVE_TIME_MS = 600000;   //1200000
  //const MIN_ACTIVE_TIME_MS = 193071;   //1200000
  static MAX_ACTIVE_TIME_MS = 600500;   //1300000
  static METRIC_GRAB_FREQUENCY = 1000;
  static NO_ATTENDEES_PER_MEETING = 10;
  triggerClearInterval = new Map();
  leave = new Map();

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
    return (new Worker('./threads_launcher.js', {
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
    exec(`ps -aux | grep 'chrome' | xargs kill -9`)
    // const whoami = exec("whoami", { encoding: 'utf-8' });
    // console.log(whoami);
    // change the username to ec2user and add somne delay
    // prefer to use `ps -aux | grep 'puppeteer' | xargs kill -9`
    // const killCommand = "pgrep -U ridip|xargs kill -9";
    // console.log(killCommand);
    // exec(killCommand);
  }

  spawnThreads(meetingAttendeeList, threadCount, threads, meetingsDirectory) {
    const max = meetingAttendeeList.length;
    //console.log(meetingAttendeeList);
    //console.log(max);
    const min = 0;
    console.log(`Running with ${threadCount} threads...`);

    let start = min;

    if (max % threadCount === 0) {
      const range = (max / threadCount);
      for (let threadId = 0; threadId < threadCount; threadId++) {
        const startIndex = start;
        console.log(startIndex + ' ' + range + ' ' + threadId, meetingsDirectory);
        threads.add(this.createWorkerThread(startIndex, range, threadId, meetingsDirectory, meetingAttendeeList));
        start += range;
      }
    } else {
      let range = 1;
      if (threadCount <= max)
        range = Math.floor(max / threadCount);
      else
        range = Math.ceil(max / threadCount);

      //console.log(range);
      let remainingDataCount = max - range * threadCount;
      //console.log(remainingDataCount);

      for (let threadId = 0; threadId < threadCount && threadId <= max; threadId++) {
        const startIndex = start;
        if (remainingDataCount > 0) {
          console.log(startIndex + ' ' + (range + 1) + ' ' + threadId, meetingsDirectory);
          remainingDataCount -= 1;
          threads.add(this.createWorkerThread(startIndex, range + 1, threadId, meetingsDirectory, meetingAttendeeList));
          start += range + 1;
        } else {
          console.log(startIndex + ' ' + (range) + ' ' + threadId, meetingsDirectory);
          threads.add(this.createWorkerThread(startIndex, range, threadId, meetingsDirectory, meetingAttendeeList));
          start += range;
        }
      }
    }
  }

  async run() {
    if (isMainThread) {
      const sessionTimeStamp = new Date().toISOString();
      const threadCount = process.argv[2] || 2;
      const noOfMeetings = process.argv[3] || 10;
      const threads = new Set();
      const meetingAttendeeList = new SharedArrayBuffer();
      const meetingAttendeeArray = new Array();
      let meetingAttendeeListIndex = 0;
      const sqs = new SQSOperations();

      //for (let meeting = 0; meeting < noOfMeetings; meeting++) {
      while(meetingAttendeeArray.length < noOfMeetings * MeetingLauncher.NO_ATTENDEES_PER_MEETING ) {
        console.log('ttertwt ' , meetingAttendeeArray.length);
        try {
          const createMeetingWithAttendeesResponses = await sqs.getCreateMeetingWithAttendeesBodyFromSQS();
          //console.log(createMeetingWithAttendeesResponses);
          for(let response = 0; response < Math.min(noOfMeetings,createMeetingWithAttendeesResponses.Messages.length); response+=1) {
            const meetingAttendeeInfo = JSON.parse(createMeetingWithAttendeesResponses.Messages[response].Body);
            //console.log(meetingAttendeeInfo);
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
              console.log('Empty SQS 0000 ');
          }
        } catch (err) {
          console.log('Failed ', err.message)
        }
        console.log(meetingAttendeeArray.length, ' meetingAttendeeArray ', meetingAttendeeArray);
      }

      if (meetingAttendeeArray.length > 0) {
        console.log('meetingAttendeeArrayLength ', meetingAttendeeArray.length);
        let meetingsDirectory = 'Readings/MeetingsDirectory_' + sessionTimeStamp;

        try {
          if (!fs.existsSync(meetingsDirectory)) {
            fs.mkdirSync(meetingsDirectory, { recursive: true })
          }
        } catch (err) {
          console.error(err)
        }

        this.spawnThreads(meetingAttendeeArray, threadCount, threads, meetingsDirectory);

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
      }
    } else {
      this.childThreadActivity();
      // const used = process.memoryUsage();
      // for (let key in used) {
      //   console.log(`${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
      // }
    }
  }

  async childThreadActivity() {
    const browser = {};
    const reportFetch = new Map();

    const webRTCStatReport = {};
    const page = [];

    browser[workerData.threadId] = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--hostname localhost',
        '--no-sandbox', '--disable-setuid-sandbox',
        '--single-process', '--no-zygote'
      ],
    });
    webRTCStatReport[workerData.threadId] = new WebRTCStatReport();
    const sqs = new SQSOperations();
    let fileLocation = new Map();
    let dataToWriteToFile = new Map();
    let meetingsDirectory = workerData.meetingsDirectory;

    fs.access(meetingsDirectory, fs.F_OK, (err) => {
      if (err) {
        fs.mkdirSync(meetingsDirectory, { recursive: true });
      } else {
        if (err) throw err;
      }
    });

    for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
      try {
        let meetingInfo = workerData.meetingAttendeeList[browserTab].Meeting;
        let attendeeInfo = workerData.meetingAttendeeList[browserTab].Attendees;

        if (meetingInfo && attendeeInfo) {
          page[browserTab] = await browser[workerData.threadId].newPage();
          page[browserTab].on('error', err => {
            console.log('error occured: ', err);
          });
          page[browserTab].on('page error', pageerr => {
            console.log('page error occurred: ', pageerr);
          });

          //const response = await page[browserTab].goto('http://127.0.0.1:8080/?meetingInfo=' + encodeURIComponent(JSON.stringify(meetingInfo)) + '&attendeeInfo=' + encodeURIComponent(JSON.stringify(attendeeInfo)) + '').catch(() => {
          //const response = await page[browserTab].goto('https://ocj63wl9di.execute-api.us-east-1.amazonaws.com/Prod/v2/?meetingInfo=' + encodeURIComponent(JSON.stringify(meetingInfo)) + '&attendeeInfo=' + encodeURIComponent(JSON.stringify(attendeeInfo)) + '').catch(() => {
          const response = await page[browserTab].goto('https://av2yj4j98c.execute-api.us-east-1.amazonaws.com/Prod/v2/?meetingInfo=' + encodeURIComponent(JSON.stringify(meetingInfo)) + '&attendeeInfo=' + encodeURIComponent(JSON.stringify(attendeeInfo)) + '').catch(() => {
            console.log('Failed to load localhost')
          });
          const meetingId = meetingInfo.MeetingId;
          fileLocation[meetingId] = meetingsDirectory + '/' + meetingId;

          try {
            if (fs.existsSync(fileLocation[meetingId])) {
              //file exists
              console.log('bla bla bla');
            } else {
              dataToWriteToFile[meetingId] = 'audioPacketsReceived,audioDecoderLoss,audioPacketsReceivedFractionLoss,audioSpeakerDelayMs,availableSendBandwidth,attendeeId\n'
              fs.writeFile(fileLocation[meetingId] + '.csv', dataToWriteToFile[meetingId], function (err) {
                if (err) {
                  console.log('Failed to write due to ', err.message + dataToWriteToFile[meetingId]);
                }
                console.log(meetingId, ' Saved!' + dataToWriteToFile[meetingId]);
              })
            }
          } catch(err) {
            console.error(err)
          }
        }
      } catch (ex) {
        console.log(ex.message)
      }
    }

    const now = Date.now();
    for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
      const meetingInfo = workerData.meetingAttendeeList[browserTab].Meeting;
      const attendeeInfo = workerData.meetingAttendeeList[browserTab].Attendees;
      const meetingId = meetingInfo.ExternalMeetingId || meetingInfo.MeetingId;
      const attendeeId = attendeeInfo.ExternalUserId || attendeeInfo.MeetingId;
      this.triggerClearInterval[browserTab] = false;
      this.leave[browserTab] = false;

      try {
        if(page[browserTab]) {
          await page[browserTab].evaluate((attendee, meetingId, browserTab) => {
            document.getElementById('inputMeeting').value = meetingId;
            document.getElementById('inputName').value = meetingId + ' : ' + browserTab + ' : ' + attendee;
            document.getElementById('authenticate').click();
          }, attendeeId, meetingId, browserTab);
          console.log('Starting meeting on tab # ', browserTab);
          //await new Promise(resolve => setTimeout(resolve, 750));
        }
      } catch (e) {
        console.log('an exception on page.evaluate ', e);
      }
      await this.fetchMetricsFromBrowser(browser, page, reportFetch, meetingInfo, attendeeInfo, fileLocation, browserTab);

    }
    await this.setMeetingTimeout(page, reportFetch);
    await this.closeBrowser(browser[workerData.threadId]);
    parentPort.postMessage({threadId: workerData.threadId, webRTCStatReport: webRTCStatReport[workerData.threadId]});
  }

  async fetchMetricsFromBrowser(browser, page, reportFetch, meetingInfo, attendeeInfo, fileLocation, browserTab) {
    reportFetch[browserTab] = setInterval(async () => {
      try {
        if (this.triggerClearInterval[browserTab] === false && browser[workerData.threadId].isConnected() && page[browserTab]) {
          const metricReport = await page[browserTab].evaluate(() => {

            return new Promise((resolve, reject) => {
              console.log();
              if (app) {
                let metricStatsForTab = app.metricReport;
                resolve(metricStatsForTab);
              }
            });
          });

          if (metricReport) {
            this.writeMetricsToFile(metricReport, attendeeInfo.AttendeeId, fileLocation[meetingInfo.MeetingId]);
          }
        }
      } catch (err) {
        console.log(err.message)
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
        console.log('Attempting to quit meeting tab # ', browserTab);
        try {
          if(page[browserTab]) {
            await page[browserTab].evaluate(async () => {
              document.getElementById('button-meeting-leave').click();
            });
          }
        } catch (e) {
          console.log('an exception on page.evaluate ', e);
        } finally {
          //this.leave[browserTab] = true;
          this.triggerClearInterval[browserTab] = true;
          clearInterval(reportFetch[browserTab]);
        }
      }, tabRandomDuration[browserTab]);
    }
  }

  async closeBrowser(browser, waitFactor = 1.2) {
    // for (const entry of this.leave.entries()) {
    //     const key = entry[0],
    //       value = entry[1];
    //     console.log(key + " k=v " + value);
    //   }

    if (browser.isConnected()) {

      await new Promise((resolve) => {
        console.log(workerData.threadId + ' sleepinggggggg forrrrrrrr ', waitFactor , '  ++ ', MeetingLauncher.MAX_ACTIVE_TIME_MS * waitFactor);
        setTimeout(resolve, MeetingLauncher.MAX_ACTIVE_TIME_MS * waitFactor)

      });
      for (let value of this.leave.values()) {
        console.log('value ' , value);
        console.log('value === false ' , value === false);
        if (value === false) {
          waitFactor = 0.3
          await this.closeBrowser(browser,waitFactor);
        }
      }

      // this.leave.forEach((value, key) => {
      //   console.log('keyVal --> ', key, value);
      // });

      // for (var entry of this.leave.entries()) {
      //   const key = entry[0],
      //     value = entry[1];
      //   console.log(key + " = " + value);
      // }

      console.log('Close browser initiated');
      await browser.close();
      //this.individualThreadWebRTCAvgReading(webRTCStatReport);
    } else {
      return;
    }
  }

  writeMetricsToFile(webRTCStatReport, attendeeId, fileLocation) {
    //var timestamp = new Date().toISOString();
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
        //const dataToWriteToFile = dataToWrite + attendeeId + ',' + timestamp + '\n';
        const dataToWriteToFile = dataToWrite + attendeeId + '\n';
        fs.appendFile(fileLocation + '.csv', dataToWriteToFile, function (err) {
          if (err) {
            console.log('Failed to write due to ', err.message + dataToWriteToFile);
          }
          console.log('Saved!' + dataToWriteToFile);
        });
      } catch (err) {
        console.log(err.message);
      }
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

new MeetingLauncher();