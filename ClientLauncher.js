import SQSOperations from './src/SQSOperations.js';
import ThreadActivity from "./src/ThreadActivity.js";
import ChildActivity from "./src/ChildActivity.js";
import MeetingActivity from "./src/MeetingActivity.js";
import Support from "./src/Support.js";

import { createRequire } from 'module';
import ConfigParameter from "./src/ConfigParameter.js";
const require = createRequire(import.meta.url);
const fs = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
require('events').EventEmitter.prototype._maxListeners = Infinity;

export default class ClientLauncher {
  static FILE_NAME = './ClientLauncher.js';
  static loadTestEndSignal = false;
  fileLocation = new Map();
  reportFetch = {};

  constructor() {
    this.configParameter = new ConfigParameter();
    const launcherArgs = this.configParameter.getConfigParameters();
    this.support = new Support();
    this.NO_OF_MEETINGS = launcherArgs.meetingCount || this.support.getNoOfMeetingsBasedOnCoreSize();
    this.NO_OF_THREADS = launcherArgs.noOfThreads || this.support.getNoOThreadsBasedOnCoreSize();
    this.NO_ATTENDEES_PER_MEETING = launcherArgs.attendeesPerMeeting || 10;
    this.MIN_ACTIVE_TIME_MS = launcherArgs.minDurationMin * 60 * 1000 || 1800000;
    this.MAX_ACTIVE_TIME_MS = launcherArgs.maxDurationMin * 60 * 1000 || 1850000;
    this.METRIC_GRAB_FREQUENCY = launcherArgs.metricGrabFrequencyMin * 60 * 1000 || 1000;
    this.PUT_METRIC_DATA_NAMESPACE = launcherArgs.putMetricDataNamespace || 'LoadTest';
    this.LOADTEST_SESSION_NAME = launcherArgs.loadTestSessionName || this.support.getLoadTestSessionId();
    this.SESSION_PASSCODE = launcherArgs.sessionPasscode || 0;
    this.run();
    this.done = 0;
  }

  async run() {
    if (isMainThread) {
      this.support.putMetricData('LauncherRunning', 500);
      const threadCount = this.NO_OF_THREADS;
      const noOfMeetings = this.NO_OF_MEETINGS;
      const noOfAttendeesPerMeeting = this.NO_ATTENDEES_PER_MEETING;
      const threads = new Set();
      const sqs = new SQSOperations();
      await sqs.init('E2ELoadTestStack-ResponseQueue');
      const sharedConfigParameters = this.getSharedConfigParameters();
      const threadActivity = new ThreadActivity(sharedConfigParameters, this.support);
      const meetingActivity = new MeetingActivity(this.support, noOfMeetings, noOfAttendeesPerMeeting, sqs);
      this.support.log('ThreadCount: ' + threadCount);
      this.support.log('No Of Meetings: ' + this.NO_OF_MEETINGS);
      let meetingAttendeeArray = await meetingActivity.createMeetingAttendeeList();
      if (meetingAttendeeArray.length > 0) {
        const loadTestStartTimeStampEpoch = Date.now();
        this.support.log('MeetingAttendeeArrayLength ' + meetingAttendeeArray.length);
        this.support.putMetricData('MeetingAttendeeArrayLength', meetingAttendeeArray.length);
        await threadActivity.spawnThreads(
          meetingAttendeeArray,
          threadCount,
          threads,
          loadTestStartTimeStampEpoch
        );
        threadActivity.setWorkerThreadEvents(threads);
      }
    } else {
      console.log('this.SESSION_PASSCODE ClientLauncher', this.SESSION_PASSCODE);
      console.log('this.MIN_ACTIVE_TIME_MS ClientLauncher', this.MIN_ACTIVE_TIME_MS);
      const childActivity = new ChildActivity(this.support);
      await childActivity.childThreadActivity();
    }
  }

  async startMeetingSession(page, meetingInfo, attendeeInfo, browserTab, threadId) {
    if (workerData.threadId === threadId && page !== null) {
      try {
        const meetingId = meetingInfo.MeetingId;
        const attendeeId = attendeeInfo.AttendeeId;
        if (page !== null) {
          const meetingStartStatus = await page.evaluate(
            (attendeeId, meetingId, browserTab) => {
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

          if (meetingStartStatus === 'Success') {
            this.support.log('Meeting start SUCCESS on tab # ', browserTab);
            this.support.putMetricData('MeetingStartSuccess', 1);
          } else {
            this.support.log('Meeting start FAIL on tab # ', browserTab);
            this.support.putMetricData('MeetingStartFail', 1);
          }
        }
      } catch (err) {
        this.support.error('Exception on page evaluate ' + err, browserTab);
        this.support.putMetricData('MeetingStartFailPageEvaluate', 1);
      }
    }
  }

  async fetchMetricsFromBrowser(page) {
    setTimeout(() => {
      for (const [key, value] of Object.entries(page)) {
        this.reportFetch[key] = setInterval(async () => {
          this.support.putMetricData('Beacon-' + workerData.threadId, 1);
          try {
            if (page[key] !== null) {
              const metricReport = await page[key].evaluate(() => app.metricReport);
              if (
                metricReport.meetingId || metricReport.attendeeId || metricReport.audioDecoderLoss || metricReport.audioPacketsReceived || metricReport.audioPacketsReceivedFractionLoss || metricReport.audioSpeakerDelayMs || metricReport.availableReceiveBandwidth || metricReport.availableSendBandwidth
              ) {
                const bodyHTML = await page[key].evaluate(() => document.body.innerText);
                this.support.log(bodyHTML);
                this.writeMetricsToFile(metricReport, metricReport.attendeeId, workerData.meetingsDirectory + '/' + metricReport.meetingId);
              } else {
                this.support.log('Metrics not received');
                this.support.putMetricData('MeetingInactive', 1);
                const bodyHTML = await page[key].evaluate(() => document.body.innerText);
                this.support.log(bodyHTML);
              }
            } else {
              this.support.log('Failed Metrics Reading');
            }
          } catch (err) {
            this.support.error('Cannot retrieve Metrics from browser meeting ' + err.message);
          }
        }, this.METRIC_GRAB_FREQUENCY);
      }
    }, 180000);
  }

  async setMeetingTimeout(page, reportFetch) {
    if (page !== null) {
      const tabRandomDuration = new Map();
      for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
        if (!tabRandomDuration.has(browserTab)) {
          tabRandomDuration[browserTab] = this.support.getRndDuration(this.MAX_ACTIVE_TIME_MS, this.MIN_ACTIVE_TIME_MS);
        }
        setTimeout(async () => {
          try {
            if (page[browserTab] !== null) {
              await this.meetingTimeoutActivity(page, reportFetch, browserTab);
            }
          } catch (err) {
            this.support.error('Failed to end meeting ' + err, browserTab);
            this.support.putMetricData('MeetingLeaveFail', 1);
          } finally {
            page[browserTab] = null;
          }
        }, tabRandomDuration[browserTab]);
      }
    }
  }

  async meetingTimeoutActivity(page, reportFetch, browserTab) {
    this.support.log('Attempting to quit meeting', browserTab);
    clearInterval(reportFetch[browserTab]);
    reportFetch[browserTab] = null;
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
    if (closeStatus === 'Success') {
      this.support.log('Tab closed', browserTab);
      this.support.putMetricData('MeetingLeaveSuccess', 1);
      await this.closeBrowserTab(
        page[browserTab],
        reportFetch[browserTab],
        browserTab,
        workerData.threadId
      );
    } else {
      this.support.error('Failed to Leave meeting from the browser ');
      this.support.putMetricData('MeetingLeaveFail', 1);
    }
  }

  async leaveMeeting(page, browserTab) {
    try {
      this.support.log('Attempting to quit meeting', browserTab);
      ClientLauncher.loadTestEndSignal = true;
      clearInterval(this.reportFetch[browserTab]);
      this.reportFetch[browserTab] = null;
      const closeStatus = await page.evaluate(async () => {
        return new Promise((resolve, reject) => {
          try {
            document.getElementById('button-meeting-leave').click();
            resolve('Success');
          } catch (err) {
            resolve('Fail');
          }
        });
      });
      if (closeStatus === 'Success') {
        this.support.log('Tab closed', browserTab);
        this.support.putMetricData('MeetingLeaveSuccess', 1);
      } else {
        this.support.error('Failed to Leave meeting from the browser ');
        this.support.putMetricData('MeetingLeaveFail', 1);
      }
    } catch (err) {
      this.support.error('Failed to end meeting ' + err, browserTab);
      this.support.putMetricData('MeetingLeaveFail', 1);
    }
  }

  async closeBrowserTab(page) {
    try {
      if (page !== null) {
        let localPage = page;
        page = null;
        await localPage.close();
        localPage = null;
        this.support.log('Close BrowserTab Success ');
      }
    } catch (err) {
      this.support.error('Close BrowserTab failed ' + err);
    }
  }

  async closeBrowser(browser, page, waitFactor = 1.5) {
    if (browser) {
      setTimeout(async () => {
        for (const [key, value] of Object.entries(browser)) {
          if (browser[key] && browser[key].isConnected()) {
            try {
              const pages = await browser[key].pages();
              await this.leaveMeeting(pages[0], key);
              this.support.log('Close browser initiated');
              if (typeof this.reportFetch !== 'undefined' && this.reportFetch[key] !== null) {
                clearInterval(this.reportFetch[key]);
                this.reportFetch[key] = null;
              }
              await pages[0].close();
            } catch (err) {
              this.support.error(err);
            } finally {
              await browser[key].close();
              this.support.putMetricData('BrowserClose', 1);
            }
          } else {
            return;
          }
        }
      }, this.MIN_ACTIVE_TIME_MS * waitFactor);
    }
  }

  writeMetricsToFile(webRTCStatReport, attendeeId, fileLocation) {
    let dataToWrite = '';
    if (typeof webRTCStatReport.audioPacketsReceived !== 'undefined') {
      dataToWrite += webRTCStatReport.audioPacketsReceived + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof webRTCStatReport.audioDecoderLoss !== 'undefined') {
      dataToWrite += webRTCStatReport.audioDecoderLoss + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof webRTCStatReport.audioPacketsReceivedFractionLoss !== 'undefined') {
      //dataToWrite += Math.min(Math.max(webRTCStatReport.audioPacketsReceivedFractionLoss, 0), 1) + ',';
      dataToWrite += Math.min(Math.max(webRTCStatReport.audioPacketsReceivedFractionLoss, 0), 1) + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof webRTCStatReport.audioSpeakerDelayMs !== 'undefined') {
      dataToWrite += webRTCStatReport.audioSpeakerDelayMs + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof webRTCStatReport.availableSendBandwidth !== 'undefined') {
      dataToWrite += webRTCStatReport.availableSendBandwidth + ',';
    } else {
      dataToWrite += ',';
    }

    if (dataToWrite !== ',,,,') {
      try {
        const timestamp = new Date().toISOString();
        const dataToWriteToFile = dataToWrite + attendeeId + ',' + timestamp + '\n';
        fs.appendFile(fileLocation + '.csv', dataToWriteToFile, function (err) {
          if (err) {
            console.error('Failed to write due to ', err.message + dataToWriteToFile);
          }
          console.log('Saved!' + dataToWriteToFile);
        });
      } catch (err) {
        console.error(err.message);
      }
    }
  }

  getSharedConfigParameters() {
    const sharedConfigParameters =
      {
        meetingCount: this.NO_OF_MEETINGS,
        noOfThreads: this.NO_OF_THREADS,
        attendeesPerMeeting: this.NO_ATTENDEES_PER_MEETING,
        minDurationMin: this.MIN_ACTIVE_TIME_MS,
        maxDurationMin: this.MAX_ACTIVE_TIME_MS,
        metricGrabFrequencyMin: this.METRIC_GRAB_FREQUENCY,
        putMetricDataNamespace: this.PUT_METRIC_DATA_NAMESPACE,
        loadTestSessionName: this.LOADTEST_SESSION_NAME,
        sessionPasscode: this.SESSION_PASSCODE
      };
    return sharedConfigParameters;
  }
}

new ClientLauncher();
