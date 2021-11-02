export default class ClientController {
  reportFetch = {};

  constructor(pages, support) {
    this.pages = pages;
    this.support = support;
  }

  async startMeetingSession(meetingId, attendeeName, browserTabList = []) {
    if (browserTabList.length > 0) {
      for (const browserTab of browserTabList) {
        await this.startMeetingSessionOnPage(meetingId, attendeeName, browserTab, this.pages[browserTab]);
      }
    } else {
      for (const [browserTab, page] of Object.entries(this.pages)) {
        await this.startMeetingSessionOnPage(meetingId, attendeeName, browserTab, page);
      }
    }
  }

  async startMeetingSessionOnPage(meetingName, attendeeName, browserTab, page) {
    try {
      if (page) {
        await this.support.delay(5000);
        // await page.waitForNavigation();
        const meetingStartStatus = await page.evaluate(
          (attendeeName, meetingName) => {
            return new Promise((resolve, reject) => {
              try {
                document.getElementById('inputMeeting').value = meetingName;
                document.getElementById('inputName').value = attendeeName;
                document.getElementById('authenticate').click();
                resolve('Success');
              } catch (err) {
                resolve('Fail');
              }
            });
          }, attendeeName, meetingName);

        if (meetingStartStatus === 'Success') {
          this.support.log('Meeting start SUCCESS on tab ', browserTab);
          this.support.putMetricData('MeetingStartSuccess', 1);
        } else {
          this.support.log('Meeting start FAIL on tab ', browserTab);
          this.support.putMetricData('MeetingStartFail', 1);
        }
      }
    } catch (err) {
      this.support.error('Exception on page evaluate1111 ' + err, browserTab);
      this.support.putMetricData('MeetingStartFailPageEvaluate', browserTab);
    }
  }

  async joinMeeting(joinButton, browserTabList = []) {
    if (browserTabList.length > 0) {
      for (const browserTab of browserTabList) {
        await this.joinMeetingOnPage(joinButton, browserTab, this.pages[browserTab]);
      }
    } else {
      for (const [browserTab, page] of Object.entries(this.pages)) {
        await this.joinMeetingOnPage(joinButton, browserTab, page);
      }
    }
  }

  async joinMeetingOnPage(joinButton, browserTab, page) {
    try {
      if (page) {
        // await page.waitForNavigation();
        await this.support.delay(2000);
        const meetingStartStatus = await page.evaluate((joinButton) => {
          return new Promise((resolve, reject) => {
            try {
              document.getElementById(joinButton).click();
              resolve('Success');
            } catch (err) {
              resolve('Fail');
            }
          });
        }, joinButton);

        if (meetingStartStatus === 'Success') {
          this.support.log('Join meeting SUCCESS on tab ', browserTab);
          this.support.putMetricData('JoinMeetingSuccess', 1);
        } else {
          this.support.log('Join meeting FAIL on tab ', browserTab);
          this.support.putMetricData('JoinMeetingFail', 1);
        }
      }
    } catch (err) {
      this.support.error('Exception on page evaluate 1111 ' + err, browserTab);
      this.support.putMetricData('MeetingStartFailPageEvaluate', 1);
    }
  }

  async toggleVideo(videoButton, browserTabList = []) {
    if (browserTabList.length > 0) {
      for (const browserTab of browserTabList) {
        await this.toggleVideoOnPage(videoButton, browserTab, this.pages[browserTab]);
      }
    } else {
      for (const [browserTab, page] of Object.entries(this.pages)) {
        await this.toggleVideoOnPage(videoButton, browserTab, page);
      }
    }
  }

  async toggleVideoOnPage(videoButton, browserTab, page) {
    try {
      if (page) {
        this.support.log('Attempting to toggle video on', browserTab);
        const videoToggle = await page.evaluate(async (videoButton) => {
          return new Promise((resolve, reject) => {
            try {
              document.getElementById(videoButton).click();
              resolve('Success');
            } catch (err) {
              resolve('Fail');
            }
          });
        }, videoButton);
        if (videoToggle === 'Success') {
          this.support.log('Video toggled on tab #', browserTab);
        } else {
          this.support.error('Failed to toggle video on tab #', browserTab);
        }
      }
    } catch (err) {
      this.support.error('Failed to toggle video on tab # ', browserTab + ' due to ' + err);
    }
  }

  async muteAttendee(muteButton, browserTabList = []) {
    if (browserTabList.length > 0) {
      for (const browserTab of browserTabList) {
        await this.muteAttendeeOnPage(muteButton, browserTab, this.pages[browserTab]);
      }
    } else {
      for (const [browserTab, page] of Object.entries(this.pages)) {
        await this.muteAttendeeOnPage(muteButton, browserTab, page);
      }
    }
  }

  async muteAttendeeOnPage(muteButton, browserTab, page) {
    try {
      if (page) {
        this.support.log(`Attempting to toggle mute on ${browserTab}`);
        const muteToggle = await page.evaluate(async (muteButton) => {
          return new Promise((resolve, reject) => {
            try {
              document.getElementById(muteButton).click();
              resolve('Success');
            } catch (err) {
              resolve('Fail');
            }
          });
        }, muteButton);
        if (muteToggle === 'Success') {
          this.support.log(`Mute toggled on tab #${browserTab}`);
        } else {
          this.support.error(`Failed to toggle mute on tab #${browserTab}`);
        }
      }
    } catch (err) {
        this.support.error(`Failed to toggle mute on tab #${browserTab} due to ${err}`);
    }
  }

  async leaveMeeting(meetingDuration, meetingLeaveButton, browserTabList = []) {
    if (browserTabList.length > 0) {
      for (const browserTab of browserTabList) {
        setTimeout(async (meetingLeaveButton, browserTab) => {
          await this.leaveMeetingOnPage(meetingDuration, meetingLeaveButton, browserTab, this.pages[browserTab]);
        }, meetingDuration, meetingLeaveButton, browserTab);
      }
    } else {
      setTimeout(async (meetingLeaveButton) => {
        for (const [browserTab, page] of Object.entries(this.pages)) {
          await this.leaveMeetingOnPage(meetingDuration, meetingLeaveButton, browserTab, page);
        }
      }, meetingDuration, meetingLeaveButton);
    }
  }

  async leaveMeetingOnPage(meetingDuration, meetingLeaveButton, browserTab, page) {
    try {
      this.support.log('Attempting to leave meeting');
      const closeStatus = await page.evaluate(async (meetingLeaveButton) => {
        return new Promise((resolve, reject) => {
          try {
            document.getElementById(meetingLeaveButton).click();
            resolve('Success');
          } catch (err) {
            resolve('Fail');
          }
        });
      }, meetingLeaveButton);
      if (closeStatus === 'Success') {
        this.support.log('Attendee left meeting', browserTab);
        this.support.putMetricData('MeetingLeaveSuccess', 1);
      } else {
        this.support.error('Failed to leave meeting from the browser ');
        this.support.putMetricData('MeetingLeaveFail', 1);
      }
    } catch (err) {
      this.support.error('Failed to leave meeting ' + err, browserTab);
      this.support.putMetricData('MeetingLeaveFail', 1);
    }
  }




  async setMeetingTimeout(reportFetch) {
    if (page) {
      const tabRandomDuration = new Map();
      for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
        if (!tabRandomDuration.has(browserTab)) {
          tabRandomDuration[browserTab] = this.support.getRndDuration(this.maxTimeOut, this.minTimeOut);
        }
        setTimeout(async () => {
          try {
            if (page[browserTab] !== null) {
              await this.meetingTimeoutActivity(page, reportFetch, browserTab);
            }
          } catch (err) {
            this.support.error('Failed to end meeting ' + err, browserTab);
            this.support.putMetricData('MeetingLeaveFail', 1);
          } finally {
            page[browserTab] = null;
          }
        }, tabRandomDuration[browserTab]);
      }
    }
  }

  async meetingTimeoutActivity(page, reportFetch, browserTab) {
    this.support.log('Attempting to quit meeting', browserTab);
    clearInterval(reportFetch[browserTab]);
    reportFetch[browserTab] = null;
    const closeStatus = await page[browserTab].evaluate(async () => {
      return new Promise((resolve, reject) => {
        try {
          document.getElementById('button-meeting-leave').click();
          resolve('Success');
        } catch (err) {
          resolve('Fail');
        }
      });
    });
    if (closeStatus === 'Success') {
      this.support.log('Tab closed', browserTab);
      this.support.putMetricData('MeetingLeaveSuccess', 1);
      await this.closeBrowserTab(
        page[browserTab],
        reportFetch[browserTab],
        browserTab,
        workerData.threadId
      );
    } else {
      this.support.error('Failed to Leave meeting from the browser ');
      this.support.putMetricData('MeetingLeaveFail', 1);
    }
  }



  async closeBrowserTab(maxMeetingDuration) {
    setTimeout(async (meetingLeaveButton) => {
      for (const [key, value] of Object.entries(this.pages)) {
        const browserTab = 1;
        const page = this.pages[key];
        try {
          if (page !== null) {
            let localPage = page;
            this.pages[key] = null;
            await localPage.close();
            localPage = null;
            this.support.log('Close BrowserTab Success ', browserTab);
          }
        } catch (err) {
          this.support.error('Close BrowserTab failed ' + err, browserTab);
        }
      }
    }, maxMeetingDuration);
  }

  async closeBrowser(browser, page, waitFactor = 1.5) {
    if (browser) {
      setTimeout(async () => {
        for (const [key, value] of Object.entries(browser)) {
          if (browser[key] && browser[key].isConnected()) {
            try {
              const pages = await browser[key].this.pages();
              //await this.leaveMeeting(this.pages[0], key);
              this.support.log('Close browser initiated');
              if (typeof this.reportFetch !== 'undefined' && this.reportFetch[key] !== null) {
                clearInterval(this.reportFetch[key]);
                this.reportFetch[key] = null;
              }
              await this.pages[0].close();
            } catch (err) {
              this.support.error(err);
            } finally {
              await browser[key].close();
              this.support.putMetricData('BrowserClose', 1);
            }
          } else {
            return;
          }
        }
      }, 100000 * waitFactor);
    }
  }





  async fetchMetricsFromBrowser(page) {
    setTimeout(() => {
      for (const [key, value] of Object.entries(page)) {
        this.reportFetch[key] = setInterval(async () => {
          this.support.putMetricData('Beacon-' + workerData.threadId, 1);
          try {
            if (page[key] !== null) {
              const metricReport = await page[key].evaluate(() => app.metricReport);
              if (
                metricReport.meetingId || metricReport.attendeeId || metricReport.audioDecoderLoss || metricReport.audioPacketsReceived || metricReport.audioPacketsReceivedFractionLoss || metricReport.audioSpeakerDelayMs || metricReport.availableReceiveBandwidth || metricReport.availableSendBandwidth
              ) {
                const bodyHTML = await page[key].evaluate(() => document.body.innerText);
                this.support.log(bodyHTML);
                this.writeMetricsToFile(metricReport, metricReport.attendeeId, workerData.meetingsDirectory + '/' + metricReport.meetingId);
              } else {
                this.support.log('Metrics not received');
                this.support.putMetricData('MeetingInactive', 1);
                const bodyHTML = await page[key].evaluate(() => document.body.innerText);
                this.support.log(bodyHTML);
              }
            } else {
              this.support.log('Failed Metrics Reading');
            }
          } catch (err) {
            this.support.error('Cannot retrieve Metrics from browser meeting ' + err.message);
          }
        }, 1000);
      }
    }, 180000);
  }

  writeMetricsToFile(webRTCStatReport, attendeeId, fileLocation) {
    let dataToWrite = '';
    if (typeof webRTCStatReport.audioPacketsReceived !== 'undefined') {
      dataToWrite += webRTCStatReport.audioPacketsReceived + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof webRTCStatReport.audioDecoderLoss !== 'undefined') {
      dataToWrite += webRTCStatReport.audioDecoderLoss + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof webRTCStatReport.audioPacketsReceivedFractionLoss !== 'undefined') {
      //dataToWrite += Math.min(Math.max(webRTCStatReport.audioPacketsReceivedFractionLoss, 0), 1) + ',';
      dataToWrite += Math.min(Math.max(webRTCStatReport.audioPacketsReceivedFractionLoss, 0), 1) + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof webRTCStatReport.audioSpeakerDelayMs !== 'undefined') {
      dataToWrite += webRTCStatReport.audioSpeakerDelayMs + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof webRTCStatReport.availableSendBandwidth !== 'undefined') {
      dataToWrite += webRTCStatReport.availableSendBandwidth + ',';
    } else {
      dataToWrite += ',';
    }

    if (dataToWrite !== ',,,,') {
      try {
        const timestamp = new Date().toISOString();
        const dataToWriteToFile = dataToWrite + attendeeId + ',' + timestamp + '\n';
        fs.appendFile(fileLocation + '.csv', dataToWriteToFile, function (err) {
          if (err) {
            console.error('Failed to write due to ', err.message + dataToWriteToFile);
          }
          console.log('Saved!' + dataToWriteToFile);
        });
      } catch (err) {
        console.error(err.message);
      }
    }
  }
}