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
    this.configParameter = new ConfigParameter('launcher');
    const launcherArgs = this.configParameter.getConfigParameters();
    console.log(launcherArgs);
    this.RUN_FROM_LOCAL_MACHINE = launcherArgs.localMachine || false;
    console.log(this.RUN_FROM_LOCAL_MACHINE);
    this.support = new Support(this.RUN_FROM_LOCAL_MACHINE, launcherArgs.loadTestSessionName);
    this.NO_OF_MEETINGS = launcherArgs.meetingCount || Math.max(1, this.support.getNoOfMeetingsBasedOnCoreSize());
    this.NO_OF_THREADS = launcherArgs.noOfThreads || Math.max(1, this.support.getNoOThreadsBasedOnCoreSize());
    this.NO_ATTENDEES_PER_MEETING = launcherArgs.attendeesPerMeeting || 10;
    this.NO_ACTIVE_VIDEO_PER_MEETING = launcherArgs.activeVideosPerMeeting || 0;
    this.MIN_ACTIVE_TIME_MS = launcherArgs.minDurationMin * 60 * 1000 || 1700000;
    this.MAX_ACTIVE_TIME_MS = launcherArgs.maxDurationMin * 60 * 1000 || 2000000;
    this.METRIC_GRAB_FREQUENCY = launcherArgs.metricGrabFrequencyMin * 60 * 1000 || 1000;
    this.PUT_METRIC_DATA_NAMESPACE = launcherArgs.putMetricDataNamespace || 'LoadTest';
    this.LOADTEST_SESSION_NAME = launcherArgs.loadTestSessionName || this.support.getLoadTestSessionId();
    this.SESSION_PASSCODE = launcherArgs.sessionPasscode || 0;
    this.generateMeetingAttendeeAfterBrowserLoad = false;
    if (launcherArgs.meetingCount === 1 && launcherArgs.attendeesPerMeeting > 10 && this.SESSION_PASSCODE === 0) {
      this.generateMeetingAttendeeAfterBrowserLoad = true;
    }
    this.run();
  }

  async run() {
    if (isMainThread) {
      this.support.putMetricData('LauncherRunning', 500);
      const threadCount = this.NO_OF_THREADS;
      const threads = new Set();
      let meetingAttendeeArray = null;
      const sharedConfigParameters = this.getSharedConfigParameters();
      const threadActivity = new ThreadActivity(sharedConfigParameters, this.support);
      const meetingActivity = new MeetingActivity(sharedConfigParameters, this.support);
      this.support.log('ThreadCount: ' + threadCount);
      if (!this.generateMeetingAttendeeAfterBrowserLoad) {
        if (this.SESSION_PASSCODE === 0) {
          this.support.log('No Of Meetings: ' + this.NO_OF_MEETINGS);
          meetingAttendeeArray = await meetingActivity.createMeetingAttendeeListFromSQS('E2ELoadTestStack-ResponseQueue');
        } else {
          this.support.log('No Of Attendees: ' + this.NO_ATTENDEES_PER_MEETING);
          meetingAttendeeArray = await meetingActivity.createMeetingAttendeeListFromPasscode(this.SESSION_PASSCODE, this.NO_ATTENDEES_PER_MEETING);
        }
        this.support.log('MeetingAttendeeArrayLength ' + meetingAttendeeArray.length);
        this.support.putMetricData('MeetingAttendeeArrayLength', meetingAttendeeArray.length);
      }
      const loadTestStartTimeStampEpoch = Date.now();
      await threadActivity.spawnThreads(
        meetingAttendeeArray,
        threadCount,
        threads,
        loadTestStartTimeStampEpoch
      );
      threadActivity.setWorkerThreadEvents(threads);

    } else {
      const childActivity = new ChildActivity(this.support);
      await childActivity.childThreadActivity();
    }
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
        sessionPasscode: this.SESSION_PASSCODE,
        isLocalMachine: this.RUN_FROM_LOCAL_MACHINE
      };
    return sharedConfigParameters;
  }
}

new ClientLauncher();
