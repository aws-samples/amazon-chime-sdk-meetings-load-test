import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const minimist = require('minimist');

export default class ConfigParameter {
  constructor() {
    this.launcherArgs = minimist(process.argv.slice(2));
    this.validateConfigParameters();
  }

  getConfigParameters() {
    return this.launcherArgs;
  }

  validateConfigParameters() {
    const launcherArgs = this.launcherArgs;
    if (Object.keys(launcherArgs).length > 1) {
      //const expectedParameters = ['_', 'meetingCount', 'noOfThreads', 'attendeesPerMeeting', 'minDurationMin', 'maxDurationMin', 'metricGrabFrequencyMin'];
      const expectedParameters = {
        _: typeof [],
        meetingCount: 'number',
        noOfThreads: 'number',
        attendeesPerMeeting: 'number',
        activeVideosPerMeeting: 'number',
        minDurationMin: 'number',
        maxDurationMin: 'number',
        metricGrabFrequencyMin: 'number',
        putMetricDataNamespace: 'string',
        loadTestSessionName: 'string',
        sessionPasscode: 'number',
        localMachine: 'boolean'
      };

      for (let [paramName, paramType] of Object.entries(launcherArgs)) {
        if (!(paramName in expectedParameters)) {
          console.log('Please check entered parameters');
          console.log('Expected parameters: ', expectedParameters);
          process.exit(1);
        }

        if (typeof paramType !== expectedParameters[paramName] && paramName !== 'localMachine') {
          console.log(`Parameter '${paramName}' should be of type '${expectedParameters[paramName]}'`);
          process.exit(1);
        }

        if (paramName === 'sessionPasscode' && launcherArgs['sessionPasscode'].toString().length !== 10) {
          console.log('Parameter `sessionPasscode` should be 10 digits');
          console.log('Current typeof sessionPasscode', typeof launcherArgs['sessionPasscode'].toString());
          console.log('Current length sessionPasscode', launcherArgs['sessionPasscode'].toString().length);
          process.exit(1);
        }
      }
    }
  }
}