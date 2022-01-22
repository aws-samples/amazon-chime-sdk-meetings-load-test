import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
require('events').EventEmitter.prototype._maxListeners = Infinity;
const { metricScope } = require('aws-embedded-metrics');
const { isMainThread, workerData } = require('worker_threads');

export default class Support {

	constructor(isLocalMachine, loadTestSessionId) {
		if (isMainThread) {
			this.isLocalMachine = isLocalMachine;
		} else {
			this.isLocalMachine = workerData.sharedConfigParameters.isLocalMachine;
		}
		console.log('isLocalMachine ->', this.isLocalMachine);
		this.testSessionName = loadTestSessionId || this.getLoadTestSessionId();
	}

	getLoadTestSessionId () {
		const file = './configs/LoadTestStatus.json';
		const rawData = fs.readFileSync(file);
		const jsonData = JSON.parse(rawData);
		return jsonData.LoadTestSessionId.toString();
	}

	getRndDuration(max, min) {
		return (Math.floor(Math.random() * (max - min + 1)) + min);
	}

	async done() {
		try {
			console.log('Done ');
		} catch (error) {
			console.log(error);
		}
	}

	cleanup() {
		console.log('cleanup ');
		this.putMetricData('CleanupInitiated', 1);
		exec('sudo ps -aux | grep \'puppeteer\' | xargs kill -9');
		exec('sudo ps aux | grep puppeteer | grep -v grep | awk \'{print $2}\' | xargs kill -9');
	}

	async getAccountDetails() {
		if (this.isLocalMachine) {
			return 'local_machine';
		}
		const cmd = 'curl -s http://169.254.169.254/latest/dynamic/instance-identity/document';
		const accountDetails = JSON.parse(await this.runCmdAsync(cmd));
		return accountDetails;
	}

	async getInstanceId() {
		if (this.isLocalMachine) {
			return 'local_machine';
		}
		const cmd = 'curl http://169.254.169.254/latest/meta-data/instance-id';
		return await this.runCmdAsync(cmd);
	}

	async getInstanceNumber() {
		if (this.isLocalMachine) {
			return 0;
		}
		const tagName = 'InstanceNumber';
		const instanceId = await this.getInstanceId();
		const region = 'us-east-1';
		const cmd = `aws ec2 describe-instances --filters Name=instance-id,Values=${instanceId} --query 'Reservations[*].Instances[].[Tags[?Key==\`${tagName}\`].Value]' --region ${region} --output text`;
		return await this.runCmdAsync(cmd);
	}

	async getAttendeeName(attendeeNamePrefix, startRange, threadIterator, attendeesPerMeeting) {
		return attendeeNamePrefix + '_'
      + (startRange + threadIterator
        + (await this.getInstanceNumber() * attendeesPerMeeting)
      );
	}

	async runCmdAsync(cmd) {
		try {
			const response = new Promise(function (resolve, reject) {
				exec(cmd, (err, stdout, __stderr) => {
					if (err) {
						reject(err);
					} else {
						resolve(stdout);
					}
				});
			});
			if (response) {
				return response;
			}
		} catch (err) {
			console.log(err);
			return 'localhost';
		}
	}

	async putMetricData(metricName, metricValue) {
		if (this.isLocalMachine) {
			return;
		}
		const instanceId = await this.getInstanceId();
		const startTime = 'MasterThread N/A';
		metricScope.logGroupName = 'LoadTest_Metrics';
		const putMetric = metricScope(
			(metrics) => async (instanceId, startTime, metricName, metricValue) => {
				console.log('received message');
				metrics.putDimensions({ SId: this.testSessionName, IId: instanceId, StartTime: startTime });
				metrics.putMetric(metricName, metricValue);
				console.log('completed aggregation successfully.');
			}
		);
		putMetric(instanceId, startTime, metricName, metricValue);
	}

	getNoOfMeetingsBasedOnCoreSize() {
		const cpuCount = os.cpus().length;
		if (cpuCount >= 36) {
			return Math.floor(cpuCount * 0.10);
		}
		return Math.floor(cpuCount * 0.08);
	}

	getNoOThreadsBasedOnCoreSize() {
		const cpuCount = os.cpus().length;
		return Math.ceil(cpuCount);
	}

	log(str, tabNo = '') {
		let data = new Date().toString() + ' ';
		if (isMainThread) {
			data += '[Master Thread] ' + str;
			console.log(data);
		} else {
			data += workerData.threadId + '  ' + tabNo + ' [Child Thread] ' + str;
			console.log(data);
		}
	}

	error(str, tabNo = '') {
		this.putMetricData('[ERROR]', 1);
		let data = new Date().toString() + ' ';
		if (isMainThread) {
			data += '[Master Thread ERROR] ' + str;
			console.log(data);
		} else {
			data += workerData.threadId + '  ' + tabNo + ' [Child Thread ERROR] ' + str;
			console.log(data);
		}
	}

	delay(ms) {
		return new Promise( resolve => setTimeout(resolve, ms) );
	}
}
