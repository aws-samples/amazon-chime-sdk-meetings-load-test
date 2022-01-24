import ThreadActivity from './ThreadActivity.js';
import ChildActivity from './ChildActivity.js';
import Support from './Support.js';
import { createRequire } from 'module';
import ConfigParameter from './ConfigParameter.js';
import {
  meetingName,
  attendeeNamePrefix,
  putMetricDataNamespace,
  noOfMeetings,
  attendeesPerMeetingCount,
  activeVideosPerMeetingCount,
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
    this.noOfMeetings = launcherArgs.meetingCount || noOfMeetings;
    this.threadsCount = launcherArgs.threadsCount || Math.max(1, this.support.getNoOThreadsBasedOnCoreSize());
    this.attendeesPerMeetingCount = launcherArgs.attendeesPerMeeting || attendeesPerMeetingCount;
    this.activeVideosPerMeetingCount = launcherArgs.activeVideosPerMeeting || activeVideosPerMeetingCount;
    this.minMeetingDuration = launcherArgs.minDurationMin * 60 * 1000 || minMeetingDuration;
    this.maxMeetingDuration = launcherArgs.maxDurationMin * 60 * 1000 || maxMeetingDuration;
    this.shouldLaunchServerlessClients = true;
    this.metricGrabFrequencyMs = launcherArgs.metricGrabFrequencyMin * 60 * 1000 || 1000;
    this.metricDataNamespace = launcherArgs.putMetricDataNamespace || putMetricDataNamespace;
    this.testSessionName = launcherArgs.loadTestSessionName || meetingName || this.support.getLoadTestSessionId();
    this.attendeeNamePrefix = launcherArgs.attendeeNamePrefix || attendeeNamePrefix;
    this.sessionPasscode = launcherArgs.sessionPasscode || 0;

    if (this.activeVideosPerMeetingCount > this.attendeesPerMeetingCount) {
      this.activeVideosPerMeetingCount = this.attendeesPerMeetingCount;
      this.support.log('Number of active video tiles cannot be greater than number of participants, setting activeVideosPerMeetingCount = attendeesPerMeetingCount');
    }
    this.run();
  }

  async run() {
    if (isMainThread) {
      this.support.putMetricData('LauncherRunning', 500);
      const threads = new Set();
      const sharedConfigParameters = this.getSharedConfigParameters();
      const threadActivity = new ThreadActivity(sharedConfigParameters, this.support);

      this.support.log('ThreadCount: ' + this.threadsCount);
      this.support.log('No Of Meetings: ' + this.noOfMeetings);
      this.support.log('No Of Attendees: ' + this.attendeesPerMeetingCount);
      this.support.putMetricData('meetingAttendeeObjectsLength', this.attendeesPerMeetingCount);

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
      meetingCount: this.noOfMeetings,
      threadsCount: this.threadsCount,
      attendeesPerMeeting: this.attendeesPerMeetingCount,
      activeVideosPerMeeting: this.activeVideosPerMeetingCount,
      minDurationMs: this.minMeetingDuration,
      maxDurationMs: this.maxMeetingDuration,
      metricGrabFrequencyMin: this.metricGrabFrequencyMs,
      putMetricDataNamespace: this.metricDataNamespace,
      loadTestSessionName: this.testSessionName,
      attendeeNamePrefix: this.attendeeNamePrefix,
      sessionPasscode: this.sessionPasscode,
      isLocalMachine: this.isLocalMachine,
      launchServerlessClients: this.shouldLaunchServerlessClients,
      iterator: 0
    };
  }
}

new ClientLauncher();
