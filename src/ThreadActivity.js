import { createRequire } from 'module';
import ClientLauncher from './ClientLauncher.js';
const require = createRequire(import.meta.url);
const { Worker } = require('worker_threads');

export default class ThreadActivity {
	constructor(sharedConfigParameters, support) {
		this.sharedConfigParameters = sharedConfigParameters;
		this.support = support;
	}

	async spawnThreads(threadCount, threads, loadTestStartTimeStampEpoch) {
		let totalNoOfVideos = this.sharedConfigParameters.activeVideosPerMeeting;
		const max = this.sharedConfigParameters.attendeesPerMeeting;
		const min = 0;
		console.log(`Running with ${threadCount} threads...`);
		let start = min;
		const accountId = (await this.support.getAccountDetails()).accountId;
		const instanceId = await this.support.getInstanceId();
		const noOfVideosThreadHandle = [];
		for (let threadId = 0; threadId < threadCount; threadId++) {
			noOfVideosThreadHandle[threadId] = 0;
		}
		for (let threadId = 0; threadId < threadCount && totalNoOfVideos > 0; threadId++) {
			noOfVideosThreadHandle[threadId] += 1;
			totalNoOfVideos -= 1;
		}
		if (max % threadCount === 0) {
			const range = max / threadCount;
			for (let threadId = 0; threadId < threadCount; threadId++) {
				const startIndex = start;
				console.log(startIndex + ' ' + range + ' ' + threadId);
				threads.add(
					await this.createWorkerThread(
						startIndex,
						range,
						threadId,
						loadTestStartTimeStampEpoch,
						instanceId,
						accountId,
						noOfVideosThreadHandle[threadId]
					)
				);
				this.support.putMetricData('ThreadCreated', 1);
				start += range;
			}
		} else {
			let range = 1;
			if (threadCount <= max) range = Math.floor(max / threadCount);
			else range = Math.ceil(max / threadCount);
			let remainingDataCount = max - range * threadCount;
			for (let threadId = 0; threadId < threadCount && threadId < max; threadId++) {
				const startIndex = start;
				if (remainingDataCount > 0) {
					console.log(startIndex + ' ' + (range + 1) + ' ' + threadId);
					remainingDataCount -= 1;
					threads.add(
						await this.createWorkerThread(
							startIndex,
							range + 1,
							threadId,
							loadTestStartTimeStampEpoch,
							instanceId,
							accountId,
							noOfVideosThreadHandle[threadId]
						)
					);
					this.support.putMetricData('ThreadCreated', 1);
					start += range + 1;
				} else {
					console.log(startIndex + ' ' + range + ' ' + threadId);
					threads.add(
						await this.createWorkerThread(
							startIndex,
							range,
							threadId,
							loadTestStartTimeStampEpoch,
							instanceId,
							accountId,
							noOfVideosThreadHandle[threadId]
						)
					);
					this.support.putMetricData('ThreadCreated', 1);
					start += range;
				}
			}
		}
	}

	setWorkerThreadEvents(threads) {
		for (let worker of threads) {
			worker.on('error', (err) => {
				console.error(err);
			});

			worker.on('exit', () => {
				threads.delete(worker);
				this.support.log(`Thread exiting ${threads.size} running...`);
				this.support.putMetricData('ThreadExit', 1);
				if (threads.size === 0) {
					this.support.log('Threads ended');
					this.support.done = 1;
				}
			});

			worker.on('message', async (message) => {
				const threadId = message.threadId;
				const accountId = message.accountId;
				const instanceId = message.instanceId;
				this.support.log('ThreadId complete ', threadId);
				const filename = 'Log_' + accountId + '_' + instanceId;
				this.support.putMetricData('ChildThreadActivityComplete', 1);
				if(this.sharedConfigParameters.sessionPasscode !== 0) {
					threads.delete(worker);
					if (threads.size === 0) {
						this.support.log('Threads ending');
						this.support.putMetricData('ThreadExit', 1);
						this.support.done = 1;
						process.exit(1);
					}
				}
			});
		}
	}

	async createWorkerThread(
		startIndex,
		range,
		threadId,
		loadTestStartTimeStampEpoch,
		instanceId,
		accountId,
		videoHandleCount
	) {
		return new Worker(ClientLauncher.FILE_NAME, {
			workerData: {
				start: startIndex,
				range: range,
				threadId: threadId,
				loadTestStartTimeStampEpoch: loadTestStartTimeStampEpoch,
				instanceId: instanceId,
				accountId: accountId,
				sharedConfigParameters: this.sharedConfigParameters,
				videoHandleCount
			},
		});
	}
}