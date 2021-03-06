import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const minimist = require('minimist');

export default class ConfigParameter {
	constructor(caller) {
		this.configParameters = minimist(process.argv.slice(2));
		caller === 'launcher' ? this.validateLauncherConfigParameters() : this.validateResultViewerConfigParameters();
	}

	getConfigParameters() {
		return this.configParameters;
	}

	validateLauncherConfigParameters() {
		const launcherArgs = this.configParameters;
		if (Object.keys(launcherArgs).length > 1) {
			const expectedParameters = {
				_: typeof [],
				threadsCount: 'number',
				attendeesPerMeeting: 'number',
				minDurationMin: 'number',
				maxDurationMin: 'number',
				putMetricDataNamespace: 'string',
				loadTestSessionName: 'string',
				localMachine: 'boolean',
				useExistingMeeting: 'boolean',
				generateMultipleAttendeesForMultipleMeetings: 'boolean',
				generateMultipleAttendeesForAMeeting: 'boolean',
				generateAttendeesAgainstMeetingPin: 'boolean'
			};

			for (let [paramName, paramType] of Object.entries(launcherArgs)) {
				if (!(paramName in expectedParameters)) {
					console.log('Please check entered parameters');
					console.log('Expected parameters: ', expectedParameters);
					process.exit(1);
				}

				if (typeof paramType !== expectedParameters[paramName]) {
					console.log(`Parameter '${paramName}' should be of type '${expectedParameters[paramName]}'`);
					process.exit(1);
				}

			}
		}
	}

	validateResultViewerConfigParameters() {
		const resultViewerArgs = this.configParameters;
		if (Object.keys(resultViewerArgs).length > 1) {
			const expectedParameters = {
				_: typeof [],
				logGroupName: 'string',
				startTime: 'number',
				endTime: 'number',
				region: 'string',
				sessionId: 'string'
			};

			for (let [paramName, paramType] of Object.entries(resultViewerArgs)) {
				if (!(paramName in expectedParameters)) {
					console.log('Please check entered parameters');
					console.log('Expected parameters: ', expectedParameters);
					process.exit(1);
				}
				if (typeof paramType !== expectedParameters[paramName]) {
					console.log(`Parameter '${paramName}' should be of type '${expectedParameters[paramName]}'`);
					if (paramName === 'startTime' || paramName === 'endTime') {
						console.log(`'${paramName}' should be epoch time of format 1608081180000`);
					}
					process.exit(1);
				}
			}
		}
	}
}