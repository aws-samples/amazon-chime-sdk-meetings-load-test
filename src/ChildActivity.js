import BrowserActivity from './BrowserActivity.js';
import PageActivity from './PageActivity.js';
import ClientController from './ClientController.js';
import { createRequire } from 'module';
import {
  bucketName,
  joinButton,
  meetingLeaveButton,
  micButton,
  videoButton
} from '../configs/Constants.js';

const require = createRequire(import.meta.url);
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');


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
    const now = Date.now();

    if (workerData.sharedConfigParameters.launchServerlessClients) {
      workerData.sharedConfigParameters.iterator += 1;
      const meetingDuration = this.support.getRndDuration(workerData.sharedConfigParameters.maxDurationMs, workerData.sharedConfigParameters.minDurationMs);
      const meetingName = workerData.sharedConfigParameters.loadTestSessionName;
      const attendeeName = workerData.sharedConfigParameters.attendeeNamePrefix + '_' + (workerData.start + workerData.sharedConfigParameters.iterator);
      const fileName = 'activity/' + meetingName + '_' + attendeeName + '.txt';
      await this.performActivityCommands(fileName, meetingName, attendeeName, pages);

    } else {
      await pageActivity.resumeAudioContextForAllPages(pages);
    }

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

  async performActivityCommands(fileName, meetingName, attendeeName, pages) {
    const lastCommandExecuteTimestampMs = {};
    lastCommandExecuteTimestampMs[workerData.threadId] = {};
    lastCommandExecuteTimestampMs[workerData.threadId][fileName] = 0;
    const meetingStartRequested = {};
    meetingStartRequested[workerData.threadId] = {};
    meetingStartRequested[workerData.threadId][attendeeName] = false;
    setInterval(async() => {
      const fileContent = await this.readCommands(bucketName, fileName);
      let line = {};
      try {
        line = JSON.parse(fileContent.replace(/\n/g, ''));
      } catch (err) {
        console.log('Error parsing file content');
      }
      const timestamp = line.timestamp;
      if (timestamp > lastCommandExecuteTimestampMs[workerData.threadId][fileName]) {
        lastCommandExecuteTimestampMs[workerData.threadId][fileName] = timestamp;
        const commands = line.commands;
        for (const command of commands) {
          await this.performActivity(command, meetingName, attendeeName, lastCommandExecuteTimestampMs, meetingStartRequested, pages)
        }
      }
    },2000);
  }

  async performActivity(command, meetingName, attendeeName, lastCommandExecuteTimestampMs, meetingStartRequested, pages) {
    const clientController = new ClientController(pages, this.support);
    if (command.hasOwnProperty('activity')) {
      switch (command.activity) {
        case 'JoinMeeting':
          if (!meetingStartRequested[workerData.threadId][attendeeName]) {
            await clientController.startMeetingSession(meetingName, attendeeName);
            await clientController.joinMeeting(joinButton);
            meetingStartRequested[workerData.threadId][attendeeName] = true;
          }
          break;

        case 'ToggleSelfCamera':
          if (meetingStartRequested[workerData.threadId][attendeeName]) {
            await clientController.toggleVideo(videoButton);
          }
          break;

        case 'ToggleSelfMute':
          if (meetingStartRequested[workerData.threadId][attendeeName]) {
            await clientController.muteAttendee(micButton);
          }
          break;

        case 'LeaveMeeting':
          if (meetingStartRequested[workerData.threadId][attendeeName]) {
            await clientController.leaveMeeting(0, meetingLeaveButton);
            meetingStartRequested[workerData.threadId][attendeeName] = false;
          }
          break;

        case 'Wait':
          let waitTimeMs = 0;
          if (command.duration) {
            waitTimeMs = parseInt(command.duration)
          }
          await this.support.delay(waitTimeMs);
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
      throw new Error(`Could not retrieve file from S3: ${e.message}`)
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

