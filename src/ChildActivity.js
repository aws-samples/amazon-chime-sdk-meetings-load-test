
import BrowserActivity from "./BrowserActivity.js";
import PageActivity from "./PageActivity.js";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');


export default class ChildActivity {
  constructor(support, realTimeMetricAggregate = false) {
    this.support = support;
    this.realTimeMetricAggregate = realTimeMetricAggregate;
  }

  async childThreadActivity() {
    const webRTCStatReport = {};
    if (workerData.meetingAttendeeList) {
      const browserActivity = new BrowserActivity(this.support);
      const pageActivity = new PageActivity(this.support);
      const pages = await this.openClient(browserActivity, pageActivity);
      const now = Date.now();
      await pageActivity.resumeAudioContextForAllPages(pages);

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
  }

  async openClient(browserActivity, pageActivity) {
    const browser = {};
    const pages = {};
    const mapPageMeetingAttendee = new Map();
    for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
      browser[browserTab] = await browserActivity.openBrowser();
      const meetingInfo = workerData.meetingAttendeeList[browserTab].Meeting;
      const attendeeInfo = workerData.meetingAttendeeList[browserTab].Attendees;
      mapPageMeetingAttendee[(workerData.threadId, browserTab)] = { meetingInfo, attendeeInfo };
      if (browser[browserTab] !== null && meetingInfo && attendeeInfo) {
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