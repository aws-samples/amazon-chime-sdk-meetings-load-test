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

  constructor() {
    this.configParameter = new ConfigParameter();
    const launcherArgs = this.configParameter.getConfigParameters();
    this.support = new Support(!!launcherArgs.localMachine);
    this.NO_OF_MEETINGS = launcherArgs.meetingCount || this.support.getNoOfMeetingsBasedOnCoreSize();
    this.NO_OF_THREADS = launcherArgs.noOfThreads || this.support.getNoOThreadsBasedOnCoreSize();
    this.NO_ATTENDEES_PER_MEETING = launcherArgs.attendeesPerMeeting || 10;
    this.NO_ACTIVE_VIDEO_PER_MEETING = launcherArgs.activeVideosPerMeeting || 0;
    this.MIN_ACTIVE_TIME_MS = launcherArgs.minDurationMin * 60 * 1000 || 1700000;
    this.MAX_ACTIVE_TIME_MS = launcherArgs.maxDurationMin * 60 * 1000 || 2000000;
    this.METRIC_GRAB_FREQUENCY = launcherArgs.metricGrabFrequencyMin * 60 * 1000 || 1000;
    this.PUT_METRIC_DATA_NAMESPACE = launcherArgs.putMetricDataNamespace || 'LoadTest';
    this.LOADTEST_SESSION_NAME = launcherArgs.loadTestSessionName || this.support.getLoadTestSessionId();
    this.SESSION_PASSCODE = launcherArgs.sessionPasscode || 0;
    this.run();
  }

  async run() {
    if (isMainThread) {
      this.support.putMetricData('LauncherRunning', 500);
      const threadCount = this.NO_OF_THREADS;
      const noOfMeetings = this.NO_OF_MEETINGS;
      const noOfAttendeesPerMeeting = this.NO_ATTENDEES_PER_MEETING;
      const threads = new Set();
      let meetingAttendeeArray = null;
      const sharedConfigParameters = this.getSharedConfigParameters();
      const threadActivity = new ThreadActivity(sharedConfigParameters, this.support);
      const meetingActivity = new MeetingActivity(sharedConfigParameters, this.support);
      this.support.log('ThreadCount: ' + threadCount);
      if (this.SESSION_PASSCODE === 0) {
        this.support.log('No Of Meetings: ' + this.NO_OF_MEETINGS);
        meetingAttendeeArray = await meetingActivity.createMeetingAttendeeListFromSQS('E2ELoadTestStack-ResponseQueue');
      } else {
        this.support.log('No Of Attendees: ' + this.NO_ATTENDEES_PER_MEETING);
        meetingAttendeeArray = await meetingActivity.createMeetingAttendeeListFromPasscode(this.SESSION_PASSCODE, this.NO_ATTENDEES_PER_MEETING);
      }

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
      meetingAttendeeArray = [];
    } else {
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

  getSharedConfigParameters() {
    const sharedConfigParameters =
      {
        meetingCount: this.NO_OF_MEETINGS,
        noOfThreads: this.NO_OF_THREADS,
        attendeesPerMeeting: this.NO_ATTENDEES_PER_MEETING,
        activeVideosPerMeeting: this.NO_ACTIVE_VIDEO_PER_MEETING,
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
