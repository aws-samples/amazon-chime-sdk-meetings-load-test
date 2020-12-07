import ClientLauncher from "../ClientLauncher.js";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
import serverlessRestApiForAccountMap from '../configs/ServerlessRestApiAccountMap.js';

export default class PageActivity {
  constructor(support) {
    this.support = support;
    this.maxDuration = workerData.sharedConfigParameters.maxDurationMin;
    this.minDuration = workerData.sharedConfigParameters.minDurationMin;
    this.loadTestName = workerData.sharedConfigParameters.loadTestSessionName;
    this.sessionPasscode = workerData.sharedConfigParameters.sessionPasscode;
  }

  async openLinkInPage(page, meetingInfo, attendeeInfo, browserTab, noOfRetries = 0) {
    if (noOfRetries >= 3) {
      page = null;
      this.support.putMetricData('BrowserTabOpenFail', 1);
      return;
    }
    if (page && page !== null) {
      try {
        const timeToWaitMS = this.getTimeToWaitMS();
        const meetingLeaveAfterMs = timeToWaitMS + this.support.getRndDuration(this.maxDuration, this.minDuration);
        //const serverlessRestApi = this.getServerlessRestApiForAccount(workerData.accountId);
        //const url = 'https://' + serverlessRestApi + '.execute-api.us-east-1.amazonaws.com/Prod/v2/?timeToWaitMS=' + timeToWaitMS + '&meetingLeaveAfterMs=' + meetingLeaveAfterMs + '&meetingInfo=' + encodeURIComponent(JSON.stringify(meetingInfo)) + '&attendeeInfo=' + encodeURIComponent(JSON.stringify(attendeeInfo)) + '&instanceId=' + workerData.instanceId + '&loadTestStartTime=' + workerData.loadTestStartTimeStampEpoch;

        let url =
          'http://127.0.0.1:8080/?timeToWaitMS=' +
          timeToWaitMS +
          '&meetingLeaveAfterMs=' +
          meetingLeaveAfterMs +
          '&instanceId=' +
          workerData.instanceId +
          '&loadTestStartTime=' +
          workerData.loadTestStartTimeStampEpoch +
          '&loadTestSessionName=' +
          this.loadTestName;

        console.log(workerData.sharedConfigParameters);


        if(this.sessionPasscode !== 0) {
          url += '&Passcode=' +
            this.sessionPasscode;
        } else {
          url += '&meetingInfo=' +
            encodeURIComponent(JSON.stringify(meetingInfo)) +
            '&attendeeInfo=' +
            encodeURIComponent(JSON.stringify(attendeeInfo));
        }
        this.support.log(url);
        page.setDefaultNavigationTimeout(0);
        const response = page.goto(url);
        this.support.log('Client Launched.... ', browserTab);
        this.support.putMetricData('ClientLaunched', 1);
      } catch (err) {
        this.support.error('Failed to load  ' + err, browserTab);
        noOfRetries += 1;
        this.openLinkInPage(page, meetingInfo, attendeeInfo, browserTab, noOfRetries);
      }
    }
  }

  getTimeToWaitMS () {
    const loadTestStartTimeStampEpoch = workerData.loadTestStartTimeStampEpoch;
    const currentTimeStampEpoch = Date.now();
    let timeToWaitMS = 1000;
    if (loadTestStartTimeStampEpoch <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 60000) {
      timeToWaitMS = 60000; //1min 00 sec
      this.support.putMetricData('timeToWaitMS-111', 1);
    } else if (loadTestStartTimeStampEpoch + 60000 <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 120000) {
      timeToWaitMS = 30000; //30 sec
      this.support.putMetricData('timeToWaitMS-222', 1);
    } else if (loadTestStartTimeStampEpoch + 120000 <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 180000) {
      timeToWaitMS = 15000; //15 sec
      this.support.putMetricData('timeToWaitMS-333', 1);
    } else if (loadTestStartTimeStampEpoch + 180000 <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 240000) {
      timeToWaitMS = 5000; //5 sec
      this.support.putMetricData('timeToWaitMS-444', 1);
    }

    //if (this.NO_OF_MEETINGS < 30) {
    timeToWaitMS /= 2;
    //}
    return timeToWaitMS;
  }

  getServerlessRestApiForAccount(accountId) {
    if (accountId in serverlessRestApiForAccountMap) {
      return serverlessRestApiForAccountMap[accountId];
    }
    return serverlessRestApiForAccountMap['306496942465'];
  }

  async createNewPage(browser, browserTab, mapPageMeetingAttendee, noOfRetries = 0) {
    if (noOfRetries >= 3) {
      page = null;
      this.support.error('Retry Page Failed To Create ', browserTab);
      this.support.putMetricData('RetryPageFailedToCreate', 1);
      return;
    }

    const pages = await browser.pages();
    let page = null;
    if (pages.length > 0) {
      page = pages[0];
    } else {
      page = await browser.newPage().catch(async (err) => {
        this.support.error('New page failed to load...Retrying... ' + err, browserTab);
        noOfRetries += 1;
        page = await this.createNewPage(browser, browserTab, mapPageMeetingAttendee, noOfRetries);
      });
    }
    if (typeof page !== 'undefined' && page !== null) {
      page.on('error', (err) => {
        this.support.error('Error occured: ' + err, browserTab);
        page = null;
      });

      page.on('close', async (message) => {
        this.support.putMetricData('PageClosed', 1);
        this.support.log('ClientLauncher.loadTestEndSignal ' + ClientLauncher.loadTestEndSignal);
        this.support.log(page !== null);
        if (ClientLauncher.loadTestEndSignal === false &&
          page !== null &&
          mapPageMeetingAttendee[(workerData.threadId, browserTab)] &&
          mapPageMeetingAttendee[(workerData.threadId, browserTab)].meetingInfo &&
          mapPageMeetingAttendee[(workerData.threadId, browserTab)].attendeeInfo) {
          this.support.log('Attempting to restart...', page);
          page = await this.createNewPage(browser, browserTab, mapPageMeetingAttendee);
          this.support.log('Attempting to restart 2222' + page);
          await this.resurrectClosedMeeting(page,
            mapPageMeetingAttendee[(workerData.threadId, browserTab)].meetingInfo,
            mapPageMeetingAttendee[(workerData.threadId, browserTab)].attendeeInfo,
            browserTab)
            .then(() => {
              this.support.log('Meeting Restarted', browserTab);
            })
            .catch(() => {
              this.support.log('Meeting failed to restart', browserTab);
            });
        }
        this.support.log('Page Closedddd');
      });
    }
    return page;
  }

  async resurrectClosedMeeting(page, meetingInfo, attendeeInfo, browserTab) {
    try {
      this.support.log('Restarting Meeting... ', meetingInfo, attendeeInfo);
      await this.openLinkInPage(page, meetingInfo, attendeeInfo, browserTab);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const meetingStartStatus = await this.resumeAudioContext(page);
      if (meetingStartStatus === 'Success') {
        this.support.log('Audio Context Resume Success on restarted page', browserTab);
        this.support.putMetricData('RestartMeetingSuccess', 1);
      } else {
        this.support.log('Audio Context Resume Faled on restarted page', browserTab);
        this.support.putMetricData('RestartMeetingFailed', 1);
      }
    } catch (err) {
      this.support.error('Restarting meeting Failed ' + err.message);
      this.support.putMetricData('RestartMeetingFailed', 1);
    }
  }


  async resumeAudioContextForAllPages(page, doAgain = true) {
    setTimeout(async () => {
      for (const [key, value] of Object.entries(page)) {
        try {
          const meetingStartStatus = await this.resumeAudioContext(page[key], key);
          if (meetingStartStatus === 'Success') {
            this.support.log('Audio Context Resume Success', key);
            this.support.putMetricData('AudioContextResumed-' + doAgain, 1);
          } else {
            this.support.log('Audio Context Failed', key);
            this.support.putMetricData('AudioContextFailed-' + doAgain, 1);
          }
        } catch (err) {
          this.support.error('Exception on page evaluate ' + err, key);
          this.support.putMetricData('MeetingStartFailPageEvaluate', 1);
        }
      }
    }, 45000);
  }

  startAudioContext(page) {
    if (page !== null) {
      const meetingStartStatus = page.evaluate(() => document.body.click());
    }
    this.support.putMetricData('StartAudioContext', 1);
    this.support.log('Start Audio Context');
  }

  async resumeAudioContext(page) {
    if (page !== null) {
      try {
        const meetingStartStatus = await page.evaluate(() => {
          return new Promise((resolve, reject) => {
            try {
              document.body.click();
              resolve('Success');
            } catch (err) {
              resolve('Fail');
            }
          });
        });
        return meetingStartStatus;
      } catch (err) {
        this.support.error('Audio Context Failed to start ' + err);
      }
    }
  }
}