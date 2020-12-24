class ClientController {
  /*
  * This class is not being used currently as part of the seperation of the client and the launcher tasks. The methods in this class have however been implemented on the client side
  * However, as per the requirements, the methods can be invoked.
  *
  */
  reportFetch = {};

  constructor(maxTimeOut, minTimeOut, support) {
    this.support = support;
    this.maxTimeOut = maxTimeOut;
    this.minTimeOut = minTimeOut;
  }

  async setMeetingTimeout(page, reportFetch) {
    if (page !== null) {
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

  async leaveMeeting(page, browserTab) {
    try {
      this.support.log('Attempting to quit meeting', browserTab);
      ClientLauncher.loadTestEndSignal = true;
      clearInterval(this.reportFetch[browserTab]);
      this.reportFetch[browserTab] = null;
      const closeStatus = await page.evaluate(async () => {
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
      } else {
        this.support.error('Failed to Leave meeting from the browser ');
        this.support.putMetricData('MeetingLeaveFail', 1);
      }
    } catch (err) {
      this.support.error('Failed to end meeting ' + err, browserTab);
      this.support.putMetricData('MeetingLeaveFail', 1);
    }
  }

  async closeBrowserTab(page) {
    try {
      if (page !== null) {
        let localPage = page;
        page = null;
        await localPage.close();
        localPage = null;
        this.support.log('Close BrowserTab Success ');
      }
    } catch (err) {
      this.support.error('Close BrowserTab failed ' + err);
    }
  }

  async closeBrowser(browser, page, waitFactor = 1.5) {
    if (browser) {
      setTimeout(async () => {
        for (const [key, value] of Object.entries(browser)) {
          if (browser[key] && browser[key].isConnected()) {
            try {
              const pages = await browser[key].pages();
              await this.leaveMeeting(pages[0], key);
              this.support.log('Close browser initiated');
              if (typeof this.reportFetch !== 'undefined' && this.reportFetch[key] !== null) {
                clearInterval(this.reportFetch[key]);
                this.reportFetch[key] = null;
              }
              await pages[0].close();
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
      }, this.MIN_ACTIVE_TIME_MS * waitFactor);
    }
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