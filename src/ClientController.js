export default class ClientController {
  reportFetch = {};

  constructor(pages, support) {
    this.pages = pages;
    this.support = support;
  }

  async toggleVideo(videoButton = 'button-camera') {
    for (const [key, value] of Object.entries(this.pages)) {
      const browserTab = 1;
      const page = this.pages[key];
      if (page) {
        try {
          this.support.log('Attempting to toggle video on', value);
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
        } catch (err) {
          this.support.error('Failed to toggle video on tab # ', browserTab + ' due to ' + err);
        }
      }
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

  async leaveMeeting(meetingDuration, meetingLeaveButton) {
    setTimeout(async (meetingLeaveButton) => {
      for (const [key, value] of Object.entries(this.pages)) {
        const browserTab = 1;
        const page = this.pages[key];
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
            this.support.log('Meeting Left', browserTab);
            this.support.putMetricData('MeetingLeaveSuccess', 1);
          } else {
            this.support.error('Failed to Leave meeting from the browser ');
            this.support.putMetricData('MeetingLeaveFail', 1);
          }
        } catch (err) {
          this.support.error('Failed to end meeting ' + err, browserTab);
          this.support.putMetricData('MeetingLeaveFail', 1);
        }
      }
    }, meetingDuration, meetingLeaveButton);
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

  async joinMeeting(joinButton) {
    for (const [key, value] of Object.entries(this.pages)) {
      const browserTab = 1;
      try {
        const page = this.pages[key];
        if (page) {
          await page.waitForNavigation();
          await this.support.delay(1000);
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
  }

  async startMeetingSession(meetingId, attendeeId) {
    for (const [key, value] of Object.entries(this.pages)) {
      const browserTab = 1;
      try {
        const page = this.pages[key];
        if (page) {
          await page.waitForNavigation();
          const meetingStartStatus = await page.evaluate(
            (attendeeId, meetingId) => {
              return new Promise((resolve, reject) => {
                try {
                  document.getElementById('inputMeeting').value = meetingId;
                  document.getElementById('inputName').value = attendeeId;
                  document.getElementById('authenticate').click();
                  resolve('Success');
                } catch (err) {
                  resolve('Fail');
                }
              });
            }, attendeeId, meetingId);

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