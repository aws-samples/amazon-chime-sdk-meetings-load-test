import BrowserActivity from './BrowserActivity.js';
import PageActivity from './PageActivity.js';
import ClientController from './ClientController.js';
import { createRequire } from 'module';
import {
	s3BucketName,
	joinButton,
	meetingLeaveButton,
	micButton,
	cameraButton,
	authenticateButton,
	inputMeetingTextBox,
	inputNameTextBox
} from '../configs/Constants.js';

const require = createRequire(import.meta.url);
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const { parentPort, workerData } = require('worker_threads');


export default class ChildActivity {
	constructor(support, realTimeMetricAggregate = false) {
		this.support = support;
		this.realTimeMetricAggregate = realTimeMetricAggregate;
	}

	async childThreadActivity() {
		const webRTCStatReport = {};
		const browserActivity = new BrowserActivity(this.support);
		const pageActivity = new PageActivity(this.support);
		const pages = await this.openClient(browserActivity, pageActivity);

		workerData.sharedConfigParameters.iterator += 1;
		const meetingName = workerData.sharedConfigParameters.loadTestSessionName;
		const attendeeName = await this.support.getAttendeeName(
			workerData.sharedConfigParameters.attendeeNamePrefix,
			workerData.start,
			workerData.sharedConfigParameters.iterator,
			workerData.sharedConfigParameters.attendeesPerMeeting
		);

		const meetingStartRequested = {};
		meetingStartRequested[workerData.threadId] = {};
		meetingStartRequested[workerData.threadId][attendeeName] = false;

		const isLocalVideoOn = {};
		isLocalVideoOn[workerData.threadId] = {};
		isLocalVideoOn[workerData.threadId][attendeeName] = false;

		const isLocalMute = {};
		isLocalMute[workerData.threadId] = {};
		isLocalMute[workerData.threadId][attendeeName] = false;

		const controlStatus = { meetingStartRequested, isLocalVideoOn, isLocalMute };

		const genericCommandFileName = 'activity/' + meetingName + '_*.txt';
		await this.performActivityCommands(genericCommandFileName, meetingName, attendeeName, pages, controlStatus);
		const attendeeCommandFileName = 'activity/' + meetingName + '_' + attendeeName + '.txt';
		await this.performActivityCommands(attendeeCommandFileName, meetingName, attendeeName, pages, controlStatus);

		if (this.realTimeMetricAggregate) {
			parentPort.postMessage({
				threadId: workerData.threadId,
				instanceId: workerData.instanceId,
				accountId: workerData.accountId,
				webRTCStatReport: webRTCStatReport[workerData.threadId],
			});
		} else {
			parentPort.postMessage({
				threadId: workerData.threadId,
				instanceId: workerData.instanceId,
				accountId: workerData.accountId,
			});
		}
	}

	async performActivityCommands(fileName, meetingName, attendeeName, pages, controlStatus) {
		const lastCommandExecuteTimestampMs = {};
		lastCommandExecuteTimestampMs[workerData.threadId] = {};
		lastCommandExecuteTimestampMs[workerData.threadId][fileName] = 0;

		setInterval(async() => {
			const fileContent = await this.readCommands(s3BucketName, fileName);
			let line = {};
			try {
				if (fileContent !== '') {
					line = JSON.parse(fileContent.replace(/\n/g, ''));
				}
			} catch (err) {
				this.support.log('Error parsing file content');
			}
			const timestamp = line.timestamp;
			if (timestamp > lastCommandExecuteTimestampMs[workerData.threadId][fileName]) {
				lastCommandExecuteTimestampMs[workerData.threadId][fileName] = timestamp;
				const commands = line.commands;
				for (const command of commands) {
					await this.performActivity(command, meetingName, attendeeName, pages, controlStatus);
				}
			}
		},2000);
	}

	async performActivity(command, meetingName, attendeeName, pages, controlStatus) {
		const meetingStartRequested = controlStatus['meetingStartRequested'];
		const isLocalVideoOn = controlStatus['isLocalVideoOn'];
		const isLocalMute = controlStatus['isLocalMute'];

		const clientController = new ClientController(pages, this.support);
		if (command.hasOwnProperty('activity')) {
			switch (command.activity) {
			case 'JoinMeeting':
				if (meetingStartRequested[workerData.threadId][attendeeName] === false) {
					await clientController.startMeetingSession(meetingName, attendeeName, inputMeetingTextBox, inputNameTextBox, authenticateButton);
					await clientController.joinMeeting(joinButton);
					meetingStartRequested[workerData.threadId][attendeeName] = true;
				}
				break;

			case 'TurnOnLocalCamera':
				if (meetingStartRequested[workerData.threadId][attendeeName] && isLocalVideoOn[workerData.threadId][attendeeName] === false) {
					await clientController.toggleLocalVideo(cameraButton);
					isLocalVideoOn[workerData.threadId][attendeeName] = true;
				}
				break;

			case 'TurnOffLocalCamera':
				if (meetingStartRequested[workerData.threadId][attendeeName] && isLocalVideoOn[workerData.threadId][attendeeName] === true) {
					await clientController.toggleLocalVideo(cameraButton);
					isLocalVideoOn[workerData.threadId][attendeeName] = false;
				}
				break;

			case 'LocalMute':
				if (meetingStartRequested[workerData.threadId][attendeeName] && isLocalMute[workerData.threadId][attendeeName] === false) {
					await clientController.toggleLocalMute(micButton);
					isLocalMute[workerData.threadId][attendeeName] = true;
				}
				break;

			case 'LocalUnmute':
				if (meetingStartRequested[workerData.threadId][attendeeName] && isLocalMute[workerData.threadId][attendeeName] === true) {
					await clientController.toggleLocalMute(micButton);
					isLocalMute[workerData.threadId][attendeeName] = false;
				}
				break;

			case 'LeaveMeeting':
				if (meetingStartRequested[workerData.threadId][attendeeName]) {
					await clientController.leaveMeeting(0, meetingLeaveButton);
					meetingStartRequested[workerData.threadId][attendeeName] = false;
				}
				break;

			case 'Wait':
				if (command.duration) {
					await this.support.delay(command.duration);
				}
				break;
			}
		}
	}

	async readCommands (bucket, objectKey) {
		try {
			const params = {
				Bucket: bucket,
				Key: objectKey
			};
			const data = await s3.getObject(params).promise();

			return data.Body.toString();
		} catch (e) {
			if (e.message.indexOf('NoSuchKey:') === 1) {
				this.support.log(`File ${objectKey} does not exist, instead reading from * file in S3 bucket ${bucket}`);
			}
			return '';
		}
	}

	async openClient(browserActivity, pageActivity) {
		const browser = {};
		const pages = {};
		const mapPageMeetingAttendee = new Map();
		for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
			browser[browserTab] = await browserActivity.openBrowser();
			const meetingInfo = workerData.meetingAttendeeList ? workerData.meetingAttendeeList[browserTab]?.Meeting : null;
			const attendeeInfo = workerData.meetingAttendeeList ? workerData.meetingAttendeeList[browserTab]?.Attendees : null;
			mapPageMeetingAttendee[(workerData.threadId, browserTab)] = { meetingInfo, attendeeInfo };
			if (browser[browserTab] !== null) {
				pages[browserTab] = await pageActivity.createNewPage(
					browser[browserTab],
					browserTab,
					mapPageMeetingAttendee
				);
				if (pages[browserTab] !== null && browser[browserTab].isConnected()) {
					pageActivity.openLinkInPage(pages[browserTab], meetingInfo, attendeeInfo, browserTab);
				}
			}
		}
		return pages;
	}
}

