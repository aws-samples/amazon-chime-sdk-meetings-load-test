import {createRequire} from 'module';
import SQSOperations from './SQSOperations.js';
import WebRTCStatReport from "./WebRTCStatReport.js";

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const {exec} = require('child_process');
const fs = require('fs');
const os = require('os');
const {Worker, isMainThread, parentPort, workerData} = require('worker_threads');

class MeetingLauncher {
  static FILE_NAME = './t.js';
  meetingSessionActive = new Map();
  fileLocation = new Map();
  loadTestEndSignal = false;
  reportFetch = {};
  realTimeMetricAggregate = false;

  constructor() {
    this.validateLauncherParameters();
    const launcherArgs = require('minimist')(process.argv.slice(2));
    this.NO_OF_MEETINGS = launcherArgs.meetingCount || this.getNoOfMeetingsBasedOnCoreSize();
    this.NO_OF_THREADS = launcherArgs.noOfThreads || this.getNoOThreadsBasedOnCoreSize();
    this.NO_ATTENDEES_PER_MEETING = launcherArgs.attendeesPerMeeting || 10;
    this.MIN_ACTIVE_TIME_MS = launcherArgs.minDurationMin * 60 * 1000 || 1200000;
    this.MAX_ACTIVE_TIME_MS = launcherArgs.maxDurationMin * 60 * 1000 || 1230000;
    this.METRIC_GRAB_FREQUENCY = launcherArgs.metricGrabFrequencyMin * 60 * 1000 || 1000;
    this.run();
    this.done = 0;
  }

  getRndDuration() {
    return Math.floor(Math.random() * (this.MAX_ACTIVE_TIME_MS - this.MIN_ACTIVE_TIME_MS + 1)) + this.MIN_ACTIVE_TIME_MS;
  }

  async done() {
    try {
      console.log('Done ');
    } catch (error) {
      console.log(error);
    }
  }

  async createWorkerThread(startIndex, range, threadId, meetingAttendeeList, meetingsDirectory, loadTestStartTimeStampEpoch) {
    const instanceId = await this.getInstanceId();
    return (await new Worker(MeetingLauncher.FILE_NAME, {
      workerData: {
        start: startIndex,
        range: range,
        threadId: threadId,
        meetingAttendeeList: meetingAttendeeList,
        meetingsDirectory: meetingsDirectory,
        loadTestStartTimeStampEpoch: loadTestStartTimeStampEpoch,
        instanceId: instanceId
      }
    }));
  }

  cleanup() {
    console.log('cleanup ');
    this.putMetricData('CleanupInitiated', 1);
    exec(`sudo ps -aux | grep 'puppeteer' | xargs kill -9`);
    exec(`sudo ps aux | grep puppeteer | grep -v grep | awk '{print $2}' | xargs kill -9`);
  }

  async spawnThreads(meetingAttendeeList, threadCount, threads, meetingsDirectory, loadTestStartTimeStampEpoch) {
    const max = meetingAttendeeList.length;
    const min = 0;
    console.log(`Running with ${threadCount} threads...`);
    let start = min;

    if (max % threadCount === 0) {
      const range = (max / threadCount);
      for (let threadId = 0; threadId < threadCount; threadId++) {
        const startIndex = start;
        console.log(startIndex + ' ' + range + ' ' + threadId);
        threads.add(await this.createWorkerThread(startIndex, range, threadId, meetingAttendeeList, meetingsDirectory, loadTestStartTimeStampEpoch));
        this.putMetricData("ThreadCreated", 1);
        start += range;
      }
    } else {
      let range = 1;
      if (threadCount <= max)
        range = Math.floor(max / threadCount);
      else
        range = Math.ceil(max / threadCount);
      let remainingDataCount = max - range * threadCount;
      for (let threadId = 0; threadId < threadCount && threadId < max; threadId++) {
        const startIndex = start;
        if (remainingDataCount > 0) {
          console.log(startIndex + ' ' + (range + 1) + ' ' + threadId);
          remainingDataCount -= 1;
          threads.add(await this.createWorkerThread(startIndex, range + 1, threadId, meetingAttendeeList, meetingsDirectory, loadTestStartTimeStampEpoch));
          this.putMetricData("ThreadCreated", 1);
          start += range + 1;
        } else {
          console.log(startIndex + ' ' + (range) + ' ' + threadId);
          threads.add(await this.createWorkerThread(startIndex, range, threadId, meetingAttendeeList, meetingsDirectory, loadTestStartTimeStampEpoch));
          this.putMetricData("ThreadCreated", 1);
          start += range;
        }
      }
    }
  }

  setAWSToken(role) {
    exec(`
TOKEN=\`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"\` && curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/iam/security-credentials/${role}; echo $TOKEN;`);
  }

  async getInstanceId() {
    try {
      const cmd = 'curl http://169.254.169.254/latest/meta-data/instance-id';
      const instanceId = new Promise(function (resolve, reject) {
        exec(cmd, (err, stdout, stderr) => {
          if (err) {
            reject(err);
          } else {
            resolve(stdout);
          }
        });
      });
      if (instanceId) {
        return instanceId;
      }
    } catch (ex) {
      console.log(ex);
      return 'localhost';
    }
  }

  putMetricData(metricName, metricValue, namespace = "AlivePing") {
    const cmd = `aws cloudwatch put-metric-data --metric-name ${metricName} --dimensions Instance=\`curl http://169.254.169.254/latest/meta-data/instance-id\`  --namespace ${namespace} --value ${metricValue}`;
    exec(cmd);
  }

  transferDirectoryToS3(directoryToUpload) {
    exec(`aws s3 cp ${directoryToUpload} s3://load-test-results-gamma/ --recursive`);
  }

  getNoOfMeetingsBasedOnCoreSize() {
    const cpuCount = os.cpus().length;
    if (cpuCount > 36) {
      return Math.floor(cpuCount * 1.20);
    }
    return Math.floor(cpuCount);
  }

  getNoOThreadsBasedOnCoreSize() {
    const cpuCount = os.cpus().length;
    return Math.ceil(cpuCount);
  }

  async run() {
    if (isMainThread) {
      this.putMetricData('LauncherRunning', 400);
      const threadCount = this.NO_OF_THREADS;
      const noOfMeetings = this.NO_OF_MEETINGS;
      const noOfAttendeesPerMeeting = this.NO_ATTENDEES_PER_MEETING;
      console.log(threadCount);
      console.log(noOfMeetings);
      const threads = new Set();
      let meetingAttendeeList = new SharedArrayBuffer();
      let meetingAttendeeArray = new Array();
      let meetingAttendeeListIndex = 0;
      const sqs = new SQSOperations();
      const meetingsDirectory = '';
      const loadTestStartTimeStampEpoch = Date.now();
      let lastMsgReceivedFromSQS = 0;
      while (meetingAttendeeArray.length < noOfMeetings * noOfAttendeesPerMeeting) {
        console.log('meetingAttendeeArray Length ', meetingAttendeeArray.length);
        try {
          const createMeetingWithAttendeesResponses = await sqs.getCreateMeetingWithAttendeesBody();
          if (createMeetingWithAttendeesResponses && createMeetingWithAttendeesResponses.Messages) {
            lastMsgReceivedFromSQS = Date.now();
            for (let response = 0; response < Math.min(noOfMeetings, createMeetingWithAttendeesResponses.Messages.length); response += 1) {
              const meetingAttendeeInfo = JSON.parse(createMeetingWithAttendeesResponses.Messages[response].Body);
              if (meetingAttendeeInfo && meetingAttendeeInfo.Meeting && meetingAttendeeInfo.Attendees) {
                const meetingInfo = meetingAttendeeInfo.Meeting;
                const attendeeInfo = meetingAttendeeInfo.Attendees;
                let lock = false;
                for (let attendee = 0; attendee < attendeeInfo.length; attendee += 1) {
                  if (lock === false && meetingAttendeeListIndex < noOfMeetings * this.NO_ATTENDEES_PER_MEETING) {
                    lock = true;
                    meetingAttendeeArray[meetingAttendeeListIndex] = {
                      Meeting: meetingInfo,
                      Attendees: attendeeInfo[attendee]
                    };
                    meetingAttendeeListIndex += 1;
                    lock = false;
                  }
                }
              }
            }
          } else {
            this.log('No Message received from SQS');
            if (Date.now() - lastMsgReceivedFromSQS > 10000){
              meetingAttendeeArray = [];
              meetingAttendeeListIndex = 0;
            }
          }
        } catch (err) {
          this.error('Failed SQS retrieval ' + err.message + err)
        }
      }
      if (meetingAttendeeArray.length > 0) {
        this.log('meetingAttendeeArrayLength ' + meetingAttendeeArray.length);
        this.putMetricData("meetingAttendeeArrayLength", meetingAttendeeArray.length);
        await this.spawnThreads(meetingAttendeeArray, threadCount, threads, meetingsDirectory, loadTestStartTimeStampEpoch);
        const rtcStatReport = new WebRTCStatReport(this.realTimeMetricAggregate);
        for (let worker of threads) {
          worker.on('error', (err) => {
            console.error(err);
          });

          worker.on('exit', () => {
            threads.delete(worker);
            console.log(`Thread exiting, ${threads.size} running...`);
            this.putMetricData('ThreadExit', 1);
            if (threads.size === 0) {
              console.log('Threads ended');
              rtcStatReport.printRTCStatReport(rtcStatReport, threadCount);
              meetingAttendeeList = null;
              meetingAttendeeArray = null;
              this.done = 1;
            }
          });

          worker.on('message', async (message) => {
            const threadId = message.threadId;
            console.log('threadId complete ', threadId);
          });
        }
      }
    } else {
      await this.childThreadActivity();
    }
  }

  getMeetingsDirectory() {
    const sessionTimeStamp = new Date().toISOString();
    const meetingsDirectory = 'Readings/MeetingsDirectory_' + sessionTimeStamp;
    try {
      if (!fs.existsSync(meetingsDirectory)) {
        fs.mkdirSync(meetingsDirectory, {recursive: true})
      }
    } catch (err) {
      console.error(err)
    }
    return meetingsDirectory;
  }

  async initializeFileToStoreMetricForMeeting(meetingId) {
    try {
      const dataToWriteToFile = 'audioPacketsReceived,audioDecoderLoss,audioPacketsReceivedFractionLoss,audioSpeakerDelayMs,availableSendBandwidth,attendeeId,timestamp\n'
      fs.writeFile(this.fileLocation.get(meetingId) + '.csv', dataToWriteToFile, function (err) {
        if (err) {
          console.error('Failed to create file due to ' + err.message + dataToWriteToFile);
        } else {
          console.log('File created ' + meetingId);
        }
      });
    } catch (err) {
      this.error('File write: ' + err)
    }
    this.log('this.fileLocation...Master' + this.fileLocation.size);
  }

  log(str, tabNo = '') {
    if (isMainThread) {
      console.log('[Master Thread] ' + str);
    } else {
      console.log(workerData.threadId + '  ' + tabNo + ' [Child Thread] ' + str);
    }
  }

  error(str, tabNo = '') {
    this.putMetricData("[ERROR]", 1);
    if (isMainThread) {
      console.log('[Master Thread ERROR] ' + str);
    } else {
      console.log(workerData.threadId + '  ' + tabNo + ' [Child Thread Error] ' + str);
    }
  }

  async childThreadActivity() {
    const browser = {};
    const webRTCStatReport = {};
    const page = {};
    const mapPageMeetingAttendee = new Map();
    webRTCStatReport[workerData.threadId] = new WebRTCStatReport(this.realTimeMetricAggregate);

    if (workerData.meetingAttendeeList) {
      for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
        browser[browserTab] = await this.openBrowser();
        const meetingInfo = workerData.meetingAttendeeList[browserTab].Meeting;
        const attendeeInfo = workerData.meetingAttendeeList[browserTab].Attendees;
        mapPageMeetingAttendee[workerData.threadId, browserTab] = {meetingInfo, attendeeInfo};
        if (browser[browserTab] !== null && meetingInfo && attendeeInfo) {
          page[browserTab] = await this.createNewPage(browser[browserTab], browserTab, mapPageMeetingAttendee);
          if (page[browserTab] !== null && browser[browserTab].isConnected()) {
            this.openLinkInPage(page[browserTab], meetingInfo, attendeeInfo, browserTab);
          }
        }
      }
      const now = Date.now();
      await this.resumeAudioContextForAllPages(page);

      if (this.realTimeMetricAggregate) {
        parentPort.postMessage({
          threadId: workerData.threadId,
          webRTCStatReport: webRTCStatReport[workerData.threadId]
        });
      } else {
        parentPort.postMessage({
          threadId: workerData.threadId
        });
      }
    }
  }

  async openBrowser() {
    process.setMaxListeners(Infinity);
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--disable-dev-shm-usage',
        '--use-fake-device-for-media-stream',
        '--no-sandbox', '--disable-setuid-sandbox',
        '--single-process', '--no-zygote'
      ],
    }).catch(async (err) => {
      this.error('Browser launch failed: ' + err);
      return this.openBrowser();
    });

    if (typeof browser !== 'undefined') {
      browser.on('error', async (message) => {
        console.error('Browser Errored out ');
      });

      browser.on('close', async (message) => {
        console.error('Browser Closed out');
      });

      browser.on('disconnect', async (message) => {
        console.error('Browser Disconnected out ');
      });
    }
    return browser;
  }

  async openLinkInPage(page, meetingInfo, attendeeInfo, browserTab, noOfRetries = 0) {
    if (noOfRetries >= 3) {
      page = null;
      this.meetingSessionActive.set(browserTab, false);
      this.putMetricData("BrowserTabOpenFail", 1);
      return;
    }
    if (page && page !== null) {
      try {
        let loadTestStartTimeStampEpoch = workerData.loadTestStartTimeStampEpoch;
        let currentTimeStampEpoch = Date.now();
        let timeToWaitMS = 1000;
        if (loadTestStartTimeStampEpoch <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 60000) {
          timeToWaitMS = 60000;  //2min 00 sec 120000ms
          this.putMetricData('timeToWaitMS-111', 1)
        } else if (loadTestStartTimeStampEpoch + 60000 <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 120000) {
          timeToWaitMS = 10000;  //1min 00 sec
          this.putMetricData('timeToWaitMS-222', 1)
        } else if (loadTestStartTimeStampEpoch + 120000 <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 180000) {
          timeToWaitMS = 8000;  //1min   10 sec
          this.putMetricData('timeToWaitMS-333', 1)
        } else if (loadTestStartTimeStampEpoch + 180000 <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 240000) {
          timeToWaitMS = 5000;  //0min 5 sec
          this.putMetricData('timeToWaitMS-444', 1)
        }

        if (this.NO_OF_MEETINGS > 30) {
          timeToWaitMS += 5000;
        }

        const meetingLeaveAfterMs = timeToWaitMS + this.getRndDuration();
        const url = 'https://u9ib9z88d7.execute-api.us-east-1.amazonaws.com/Prod/v2/?timeToWaitMS=' + timeToWaitMS + '&meetingLeaveAfterMs=' + meetingLeaveAfterMs + '&meetingInfo=' + encodeURIComponent(JSON.stringify(meetingInfo)) + '&attendeeInfo=' + encodeURIComponent(JSON.stringify(attendeeInfo)) + '&instanceId=' + workerData.instanceId + '&loadTestStartTime=' + workerData.loadTestStartTimeStampEpoch;
        page.setDefaultNavigationTimeout(0);
        const response = page.goto(url);
        this.log('Client Launched.... ', browserTab);
        this.putMetricData("ClientLaunched", 1);
      } catch (err) {
        this.error('Failed to load  ' + err, browserTab);
        this.meetingSessionActive.set(browserTab, false);
        noOfRetries += 1;
        this.openLinkInPage(page, meetingInfo, attendeeInfo, browserTab, noOfRetries);
      }
    }
  }

  async startMeetingSession(page, meetingInfo, attendeeInfo, browserTab, threadId) {
    if (workerData.threadId === threadId && page !== null) {
      try {
        const meetingId = meetingInfo.MeetingId;
        const attendeeId = attendeeInfo.AttendeeId;
        if (page !== null) {
          const meetingStartStatus = await page.evaluate((attendeeId, meetingId, browserTab) => {
            return new Promise((resolve, reject) => {
              try {
                document.getElementById('inputMeeting').value = meetingId;
                document.getElementById('inputName').value = meetingId + ' : ' + browserTab + ' : ' + attendeeId;
                document.getElementById('authenticate').click();
                resolve('Success');
              } catch (err) {
                resolve('Fail');
              }
            });
          }, attendeeId, meetingId, browserTab);
          if (meetingStartStatus === 'Success') {
            this.meetingSessionActive.set(browserTab, true);
            this.log('Meeting start SUCCESS on tab # ', browserTab);
            this.putMetricData("MeetingStartSuccess", 1);
          } else {
            this.meetingSessionActive.set(browserTab, false);
            this.log('Meeting start FAIL on tab # ', browserTab);
            this.putMetricData("MeetingStartFail", 1);
          }
        }
      } catch (err) {
        this.meetingSessionActive.set(browserTab, false);
        this.error('Exception on page evaluate ' + err, browserTab);
        this.putMetricData("MeetingStartFailPageEvaluate", 1);
      }
    }
  }

  async resumeAudioContextForAllPages(page, doAgain = true) {
    setTimeout(async () => {
      for (const [key, value] of Object.entries(page)) {
        try {
          const meetingStartStatus = await this.resumeAudioContext(page[key], key);
          if (meetingStartStatus === 'Success') {
            this.meetingSessionActive.set(key, true);
            console.log('this.meetingSessionActive' , this.meetingSessionActive , key);
            this.log('Audio Context Resume Success', key);
            this.putMetricData('AudioContextResumed-' + doAgain, 1);
          } else {
            this.meetingSessionActive.set(key, false);
            this.log('Audio Context Failed', key);
            this.putMetricData('AudioContextFailed-' + doAgain, 1);
          }
        } catch (err) {
          this.meetingSessionActive.set(key, false);
          this.error('Exception on page evaluate ' + err, key);
          this.putMetricData("MeetingStartFailPageEvaluate", 1);
        }
      }
    }, 60000);
  }

  startAudioContext(page) {
    if (page !== null) {
      const meetingStartStatus = page.evaluate(() =>
        document.body.click());
    }
    this.putMetricData('StartAudioContext', 1);
    this.log('Start Audio Context');
  }

  async resumeAudioContext(page){
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
        this.error('Audio Context Failed to start ' + err);
      }
    }
  }

  async resurrectClosedMeeting(page, meetingInfo, attendeeInfo, browserTab) {
    try {
      console.log('Restarting Meeting... ', meetingInfo, attendeeInfo);
      await this.openLinkInPage(page, meetingInfo, attendeeInfo, browserTab);
      await new Promise(resolve => setTimeout(resolve, 3000));
      const meetingStartStatus = await this.resumeAudioContext(page);
      if (meetingStartStatus === 'Success') {
        this.meetingSessionActive.set(browserTab, true);
        this.log('Audio Context Resume Success on restarted page', browserTab);
        this.putMetricData('RestartMeetingSuccess', 1);
      } else {
        this.meetingSessionActive.set(browserTab, false);
        this.log('Audio Context Resume Faled on restarted page', browserTab);
        this.putMetricData('RestartMeetingFailed', 1);
      }
    } catch (err) {
      this.error('Restarting meeting Failed ' + err.message);
      this.putMetricData('RestartMeetingFailed', 1);
    }
  }

  async createNewPage(browser, browserTab, mapPageMeetingAttendee, noOfRetries = 0) {
    if (noOfRetries >= 3) {
      page = null;
      this.meetingSessionActive.set(browserTab, false);
      this.error('Retry Page Failed To Create ' + err, browserTab);
      this.putMetricData("RetryPageFailedToCreate", 1);
      return;
    }

    const pages = await browser.pages();
    let page = null;
    if (pages.length > 0) {
      page = pages[0];
    } else {
      page = await browser.newPage().catch(async (err) => {
        this.error('New page failed to load...Retrying... ' + err, browserTab);
        noOfRetries += 1;
        page = await this.createNewPage(browser, browserTab, mapPageMeetingAttendee, noOfRetries);
      });
    }

    if (typeof page !== 'undefined' && page !== null) {
      page.on('error', err => {
        this.error('Error occured: ' + err, browserTab);
        page = null;
      });

      page.on('close', async (message) => {
        this.putMetricData('PageClosed', 1);
        this.log(page !== null);
        if (this.loadTestEndSignal === false && page !== null && mapPageMeetingAttendee[workerData.threadId, browserTab] && mapPageMeetingAttendee[workerData.threadId, browserTab].meetingInfo && mapPageMeetingAttendee[workerData.threadId, browserTab].attendeeInfo) {
          this.log('Attempting to restart...' , page);
          page = await this.createNewPage(browser, browserTab, mapPageMeetingAttendee);
          this.log('Attempting to restart 2222' + page);
          await this.resurrectClosedMeeting(page, mapPageMeetingAttendee[workerData.threadId, browserTab].meetingInfo, mapPageMeetingAttendee[workerData.threadId, browserTab].attendeeInfo, browserTab).then(() => {
            console.log('Meeting Restarted');
          }).catch(() => {
            console.log('Meeting failed to restart');
            this.meetingSessionActive[browserTab] = false;
          });
        }
        this.log('Page Closed');
      });
    }
    return page;
  }

  async fetchMetricsFromBrowser(page) {
    setTimeout(() => {
      for (const [key, value] of Object.entries(page)) {
        this.reportFetch[key] = setInterval(async () => {
          this.putMetricData('Beacon-' + workerData.threadId, 1);
          try {
            if (this.meetingSessionActive.get(key) === true && page[key] !== null) {
              const metricReport = await page[key].evaluate(() => app.metricReport);
              if (metricReport.meetingId || metricReport.attendeeId || metricReport.audioDecoderLoss || metricReport.audioPacketsReceived || metricReport.audioPacketsReceivedFractionLoss || metricReport.audioSpeakerDelayMs || metricReport.availableReceiveBandwidth || metricReport.availableSendBandwidth) {
                const bodyHTML = await page[key].evaluate(() => document.body.innerText);
                this.log(bodyHTML);
                console.log(' metricReport ', metricReport);
                this.writeMetricsToFile(metricReport, metricReport.attendeeId, workerData.meetingsDirectory + '/' + metricReport.meetingId);
              } else {
                this.log('Metrics not received');
                this.putMetricData('MeetingInactive', 1);
                const bodyHTML = await page[key].evaluate(() => document.body.innerText);
                this.log(bodyHTML);
                console.log(' metricReport ', metricReport);
              }
            } else {
              this.log('Failed Metrics Reading');
            }
          } catch (err) {
            this.error('Cannot retrieve Metrics from browser meeting ' + err.message);
          }
        }, this.METRIC_GRAB_FREQUENCY);

      }
    }, 180000);
  }

  async setMeetingTimeout(page, reportFetch, threadId) {
    if (workerData.threadId === threadId && page !== null) {
      const tabRandomDuration = new Map();
      for (let browserTab = workerData.start; browserTab < workerData.start + workerData.range; browserTab++) {
        if (!tabRandomDuration.has(browserTab)) {
          tabRandomDuration[browserTab] = this.getRndDuration();
        }
        setTimeout(async () => {
          try {
            if (page[browserTab] !== null) {
              this.log('Attempting to quit meeting', browserTab);
              this.meetingSessionActive[browserTab] = false;
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
              console.log('closeStatus ', closeStatus);
              if (closeStatus === 'Success') {
                this.log('Tab closed', browserTab);
                this.putMetricData("MeetingLeaveSuccess", 1);
                await this.closeBrowserTab(page[browserTab], reportFetch[browserTab], browserTab, workerData.threadId);
              } else {
                this.error('Failed to Leave meeting from the browser ');
                this.putMetricData("MeetingLeaveFail", 1);
              }
            }
          } catch (err) {
            this.error('Failed to end meeting ' + err, browserTab);
            this.putMetricData("MeetingLeaveFail", 1);

            const bodyHTML = await page[browserTab].evaluate(() => document.body.innerText);
            console.log(bodyHTML);
          } finally {
            page[browserTab] = null;
            this.meetingSessionActive[browserTab] = false;
          }
        }, tabRandomDuration[browserTab]);
      }
    }
  }


  async leaveMeeting(page, browserTab) {
    try {
      this.log('Attempting to quit meeting', browserTab);
      this.loadTestEndSignal = true;
      this.meetingSessionActive.set(browserTab, false);
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
      console.log('closeStatus ', closeStatus);
      if (closeStatus === 'Success') {
        this.log('Tab closed', browserTab);
        this.putMetricData("MeetingLeaveSuccess", 1);
      } else {
        this.error('Failed to Leave meeting from the browser ');
        this.putMetricData("MeetingLeaveFail", 1);
      }
    } catch (err) {
      this.error('Failed to end meeting ' + err, browserTab);
      this.putMetricData("MeetingLeaveFail", 1);
      const bodyHTML = await page.evaluate(() => document.body.innerText);
      console.log(bodyHTML);
    }
  }


  async closeBrowserTab(page) {
    try {
      if (page !== null) {
        let localPage = page;
        page = null;
        await localPage.close();
        localPage = null;
        this.log('Close BrowserTab Success ');
      }
    } catch (err) {
      this.error('Close BrowserTab failed ' + err);
      const bodyHTML = await page[browserTab].evaluate(() => document.body.innerText);
      console.log(bodyHTML);
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
              this.log('Close browser initiated');
              //await browser.disconnect();
              this.meetingSessionActive.set(key, false);
              if (typeof this.reportFetch !== 'undefined' && this.reportFetch[key] !== null) {
                clearInterval(this.reportFetch[key]);
                this.reportFetch[key] = null;
              }
              await pages[0].close();
            } catch (err) {
              console.log(err);
            } finally {
              await browser[key].close();
              this.putMetricData("BrowserClose", 1);
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
    if (typeof (webRTCStatReport.audioPacketsReceived) !== 'undefined') {
      dataToWrite += webRTCStatReport.audioPacketsReceived + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof (webRTCStatReport.audioDecoderLoss) !== 'undefined') {
      dataToWrite += webRTCStatReport.audioDecoderLoss + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof (webRTCStatReport.audioPacketsReceivedFractionLoss) !== 'undefined') {
      //dataToWrite += Math.min(Math.max(webRTCStatReport.audioPacketsReceivedFractionLoss, 0), 1) + ',';
      dataToWrite += Math.min(Math.max(webRTCStatReport.audioPacketsReceivedFractionLoss, 0), 1) + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof (webRTCStatReport.audioSpeakerDelayMs) !== 'undefined') {
      dataToWrite += webRTCStatReport.audioSpeakerDelayMs + ',';
    } else {
      dataToWrite += ',';
    }
    if (typeof (webRTCStatReport.availableSendBandwidth) !== 'undefined') {
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

  validateLauncherParameters() {
    const launcherArgs = require('minimist')(process.argv.slice(2));
    if (Object.keys(launcherArgs).length > 1) {
      const expectedParameters = {_: 1, meetingCount: 1, noOfThreads: 1, attendeesPerMeeting: 1, minDurationMin: 1, maxDurationMin: 1, metricGrabFrequencyMin: 1};
      for (let [key, value] of Object.entries(launcherArgs)) {
        if (!(key in expectedParameters)) {
          console.log('Please check entered parameters');
          console.log('Optional parameters: ', expectedParameters);
          process.exit(1);
        }
      }

      if (launcherArgs.meetingCount && typeof launcherArgs.meetingCount !== 'number') {
        console.log('Parameter `meetingCount` should be of type `number`');
        process.exit(1)
      }

      if (launcherArgs.noOfThreads && typeof launcherArgs.noOfThreads !== 'number') {
        console.log('Parameter `noOfThreads` should be of type `number`');
        process.exit(1)
      }

      if (launcherArgs.attendeesPerMeeting && typeof launcherArgs.attendeesPerMeeting !== 'number') {
        console.log('Parameter `attendeesPerMeeting` should be of type `number`');
        process.exit(1)
      }

      if (launcherArgs.minDurationMin && typeof launcherArgs.minDurationMin !== 'number') {
        console.log('Parameter `minDurationMin` should be of type `number`');
        process.exit(1)
      }

      if (launcherArgs.maxDurationMin && typeof launcherArgs.maxDurationMin !== 'number') {
        console.log('Parameter `maxDurationMin` should be of type `number`');
        process.exit(1)
      }

      if (launcherArgs.metricGrabFrequencyMin && typeof launcherArgs.metricGrabFrequencyMin !== 'number') {
        console.log('Parameter `metricGrabFrequencyMin` should be of type `number`');
        process.exit(1)
      }
    }
  }
}

new MeetingLauncher();