import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const minimist = require('minimist');

export default class ConfigParameter {
  constructor() {
    this.launcherArgs = minimist(process.argv.slice(2));
    this.validateConfigParameters();
    //console.log(this.launcherArgs);
  }

  getConfigParameters() {
    return this.launcherArgs;
  }

  validateConfigParameters() {
    const launcherArgs = this.launcherArgs;
    if (Object.keys(launcherArgs).length > 1) {
      //const expectedParameters = ['_', 'meetingCount', 'noOfThreads', 'attendeesPerMeeting', 'minDurationMin', 'maxDurationMin', 'metricGrabFrequencyMin'];
      const expectedParameters = {
        _: 1,
        meetingCount: 1,
        noOfThreads: 1,
        attendeesPerMeeting: 1,
        minDurationMin: 1,
        maxDurationMin: 1,
        metricGrabFrequencyMin: 1,
        putMetricDataNamespace: 1,
        loadTestSessionName: 1,
        sessionPasscode: 1
      };

      for (let [key, value] of Object.entries(launcherArgs)) {
        if (!(key in expectedParameters)) {
          console.log('Please check entered parameters');
          console.log('Optional parameters: ', expectedParameters);
          process.exit(1);
        }
      }

      if (launcherArgs.meetingCount && typeof launcherArgs.meetingCount !== 'number') {
        console.log('Parameter `meetingCount` should be of type `number`');
        process.exit(1);
      }

      if (launcherArgs.noOfThreads && typeof launcherArgs.noOfThreads !== 'number') {
        console.log('Parameter `noOfThreads` should be of type `number`');
        process.exit(1);
      }

      if (launcherArgs.attendeesPerMeeting && typeof launcherArgs.attendeesPerMeeting !== 'number') {
        console.log('Parameter `attendeesPerMeeting` should be of type `number`');
        process.exit(1);
      }

      if (launcherArgs.minDurationMin && typeof launcherArgs.minDurationMin !== 'number') {
        console.log('Parameter `minDurationMin` should be of type `number`');
        process.exit(1);
      }

      if (launcherArgs.maxDurationMin && typeof launcherArgs.maxDurationMin !== 'number') {
        console.log('Parameter `maxDurationMin` should be of type `number`');
        process.exit(1);
      }

      if (launcherArgs.metricGrabFrequencyMin && typeof launcherArgs.metricGrabFrequencyMin !== 'number') {
        console.log('Parameter `metricGrabFrequencyMin` should be of type `number`');
        process.exit(1);
      }

      if (launcherArgs.putMetricDataNamespace && typeof launcherArgs.putMetricDataNamespace !== 'string') {
        console.log('Parameter `putMetricDataNamespace` should be of type `string`');
        process.exit(1);
      }

      if (launcherArgs.loadTestSessionName && typeof launcherArgs.loadTestSessionName !== 'string') {
        console.log('Parameter `loadTestSessionName` should be of type `string`');
        process.exit(1);
      }

      if (launcherArgs.sessionPasscode && (typeof launcherArgs.sessionPasscode !== 'number' || launcherArgs.sessionPasscode.toString().length !== 10)) {
        console.log('Parameter `sessionPasscode` should be 10 digits');
        console.log('Current typeof sessionPasscode', typeof launcherArgs.sessionPasscode.toString());
        console.log('Current length sessionPasscode', launcherArgs.sessionPasscode.toString().length);
        process.exit(1);
      }
    }
  }
}