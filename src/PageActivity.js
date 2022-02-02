import ClientLauncher from './ClientLauncher.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { clientUrl } from '../configs/Constants.js';
const { workerData } = require('worker_threads');

export default class PageActivity {
  MAX_NO_OF_RETRIES = 3;

  constructor(support) {
    this.support = support;
    const sharedConfigParameters = workerData.sharedConfigParameters;
    this.sessionPasscode = sharedConfigParameters.sessionPasscode;
    this.activeVideosPerMeeting = sharedConfigParameters.activeVideosPerMeeting;
    this.launchServerlessClients = sharedConfigParameters.launchServerlessClients;
  }

  async openLinkInPage(page, meetingInfo, attendeeInfo, browserTab) {
    for (let tryCount = 0; tryCount < this.MAX_NO_OF_RETRIES; tryCount++) {
      if (page) {
        let url = '';
        if (this.launchServerlessClients) {
          url = clientUrl;
        }
        this.support.log(url);
        try {
          page.setDefaultNavigationTimeout(0);
          await this.support.delay(100);
          page.goto(url);
          this.support.log('Client launched', browserTab);
          this.support.putMetricData('ClientLaunched', 1);
          break;
        } catch (err) {
          this.support.error('Failed to load  ' + err, browserTab);
        }
      }
      if (tryCount === this.MAX_NO_OF_RETRIES) {
        page = null;
        this.support.error('Failed to load, max try reached  ', browserTab);
        this.support.putMetricData('BrowserTabOpenFail', 1);
        return;
      }
    }
  }

  async createNewPage(browser, browserTab, mapPageMeetingAttendee, noOfRetries = 0) {
    if (noOfRetries >= 3) {
      page = null;
      this.support.error('Retry page failed To create ', browserTab);
      this.support.putMetricData('RetryPageFailedToCreate', 1);
      return;
    }

    const pages = await browser.pages();
    let page = null;
    if (pages.length > 0) {
      page = pages[0];
    } else {
      await this.support.delay(500);
      page = await browser.newPage().catch(async (err) => {
        this.support.error('Retrying page load as it failed to load ' + err, browserTab);
        noOfRetries += 1;
        page = await this.createNewPage(browser, browserTab, mapPageMeetingAttendee, noOfRetries);
      }).then(() => {
        this.support.log('New page created' + browserTab);
      });
    }
    if (typeof page !== 'undefined' && page !== null) {
      page.on('error', (err) => {
        this.support.error('Error occurred: ' + err, browserTab);
        page = null;
      });

      page.on('close', async (message) => {
        this.support.putMetricData('PageClosed', 1);
        this.support.log('ClientLauncher.loadTestEndSignal ' + ClientLauncher.loadTestEndSignal);
        this.support.log('Page closed');
      });
    }
    return page;
  }
}