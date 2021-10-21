
import BrowserActivity from "./BrowserActivity.js";
import PageActivity from "./PageActivity.js";
import ClientController from "./ClientController.js";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { v4: uuidv4 } = require('uuid');

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
      const clientController = new ClientController(pages, this.support);
      const meetingDuration = this.support.getRndDuration(workerData.sharedConfigParameters.maxDurationMs, workerData.sharedConfigParameters.minDurationMs);
      const meetingName = workerData.sharedConfigParameters.loadTestSessionName || 'fixed_meeting_name';
      const joinButton = 'joinButton';
      const videoButton = 'button-camera';
      const micButton = 'button-microphone';
      const meetingLeaveButton = 'button-meeting-leave';
      await clientController.startMeetingSession(meetingName);
      await clientController.joinMeeting(joinButton);
      await clientController.muteAttendee(micButton);
      if (workerData.videoHandleCount > 0) {
        await clientController.toggleVideo(videoButton);
        workerData.videoHandleCount -= 1;
      }
      await clientController.leaveMeeting(meetingDuration, meetingLeaveButton);
      await clientController.closeBrowserTab(workerData.sharedConfigParameters.maxDurationMs);
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