import ThreadActivity from './ThreadActivity.js';
import ChildActivity from './ChildActivity.js';
import Support from './Support.js';
import { createRequire } from 'module';
import ConfigParameter from './ConfigParameter.js';
import {
  meetingName,
  attendeeNamePrefix,
  putMetricDataNamespace,
  attendeesPerMeetingCount,
  minMeetingDuration,
  maxMeetingDuration
} from '../configs/Constants.js';
const require = createRequire(import.meta.url);
const { isMainThread } = require('worker_threads');
require('events').EventEmitter.prototype._maxListeners = Infinity;

export default class ClientLauncher {
  static FILE_NAME = './ClientLauncher.js';
  static loadTestEndSignal = false;

  constructor() {
    this.configParameter = new ConfigParameter('launcher');
    const launcherArgs = this.configParameter.getConfigParameters();
    this.isLocalMachine = launcherArgs.localMachine || false;
    this.support = new Support(this.isLocalMachine, launcherArgs.loadTestSessionName);
    this.threadsCount = launcherArgs.threadsCount || Math.max(1, this.support.getNoOThreadsBasedOnCoreSize());
    this.attendeesPerMeetingCount = launcherArgs.attendeesPerMeeting || attendeesPerMeetingCount;
    this.minMeetingDuration = launcherArgs.minDurationMin * 60 * 1000 || minMeetingDuration;
    this.maxMeetingDuration = launcherArgs.maxDurationMin * 60 * 1000 || maxMeetingDuration;
    this.metricDataNamespace = launcherArgs.putMetricDataNamespace || putMetricDataNamespace;
    this.testSessionName = launcherArgs.loadTestSessionName || meetingName || this.support.getLoadTestSessionId();
    this.attendeeNamePrefix = launcherArgs.attendeeNamePrefix || attendeeNamePrefix;


    this.run();
  }

  async run() {
    if (isMainThread) {
      this.support.putMetricData('LauncherRunning', 1);
      const threads = new Set();
      const sharedConfigParameters = this.getSharedConfigParameters();
      const threadActivity = new ThreadActivity(sharedConfigParameters, this.support);

      this.support.log('ThreadCount: ' + this.threadsCount);
      this.support.log('No Of Attendees: ' + this.attendeesPerMeetingCount);

      const loadTestStartTimeStampEpoch = Date.now();
      await threadActivity.spawnThreads(
        this.threadsCount,
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
    return {
      threadsCount: this.threadsCount,
      attendeesPerMeeting: this.attendeesPerMeetingCount,
      minDurationMs: this.minMeetingDuration,
      maxDurationMs: this.maxMeetingDuration,
      putMetricDataNamespace: this.metricDataNamespace,
      loadTestSessionName: this.testSessionName,
      attendeeNamePrefix: this.attendeeNamePrefix,
      isLocalMachine: this.isLocalMachine,
      iterator: 0
    };
  }
}

new ClientLauncher();
