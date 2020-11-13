import {createRequire} from 'module';
import SQSOperations from './SQSOperations.js';
import WebRTCStatReport from './WebRTCStatReport.js';
import serverlessRestApiForAccountMap from './configs/ServerlessRestApiAccountMap.js';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const {exec} = require('child_process');
const fs = require('fs');
const os = require('os');
const minimist = require('minimist');
const {Worker, isMainThread, parentPort, workerData} = require('worker_threads');
require('events').EventEmitter.prototype._maxListeners = Infinity;
const { metricScope } = require("aws-embedded-metrics");

class MeetingLauncher {
  static FILE_NAME = './ClientLauncher.js';
  meetingSessionActive = new Map();
  fileLocation = new Map();
  loadTestEndSignal = false;
  reportFetch = {};
  realTimeMetricAggregate = false;

  constructor() {
    this.validateLauncherParameters();
    const launcherArgs = minimist(process.argv.slice(2));
    this.NO_OF_MEETINGS = launcherArgs.meetingCount || this.getNoOfMeetingsBasedOnCoreSize();
    this.NO_OF_THREADS = launcherArgs.noOfThreads || this.getNoOThreadsBasedOnCoreSize();
    this.NO_ATTENDEES_PER_MEETING = launcherArgs.attendeesPerMeeting || 10;
    this.MIN_ACTIVE_TIME_MS = launcherArgs.minDurationMin * 60 * 1000 || 1500000;
    this.MAX_ACTIVE_TIME_MS = launcherArgs.maxDurationMin * 60 * 1000 || 1505000;
    this.METRIC_GRAB_FREQUENCY = launcherArgs.metricGrabFrequencyMin * 60 * 1000 || 1000;
    this.PUT_METRIC_DATA_NAMESPACE = launcherArgs.putMetricDataNamespace || 'AlivePing';
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

  async createWorkerThread(startIndex, range, threadId, meetingAttendeeList, loadTestStartTimeStampEpoch, instanceId, accountId) {
    return (await new Worker(MeetingLauncher.FILE_NAME, {
      workerData: {
        start: startIndex,
        range: range,
        threadId: threadId,
        meetingAttendeeList: meetingAttendeeList,
        loadTestStartTimeStampEpoch: loadTestStartTimeStampEpoch,
        instanceId: instanceId,
        accountId: accountId
      }
    }));
  }

  cleanup() {
    console.log('cleanup ');
    this.putMetricData('CleanupInitiated', 1);
    exec(`sudo ps -aux | grep 'puppeteer' | xargs kill -9`);
    exec(`sudo ps aux | grep puppeteer | grep -v grep | awk '{print $2}' | xargs kill -9`);
  }

  async getAcctountDetails() {
    const cmd = `curl -s http://169.254.169.254/latest/dynamic/instance-identity/document`;
    const acctountDetails = JSON.parse(await this.runCmdAsync(cmd));
    return acctountDetails;
  }

  async getInstanceId() {
    const cmd = `curl http://169.254.169.254/latest/meta-data/instance-id`;
    const instanceId = await this.runCmdAsync(cmd);
    return instanceId;
  }

  async spawnThreads(meetingAttendeeList, threadCount, threads, loadTestStartTimeStampEpoch) {
    const max = meetingAttendeeList.length;
    const min = 0;
    console.log(`Running with ${threadCount} threads...`);
    let start = min;
    const accountId = (await this.getAcctountDetails()).accountId;
    const instanceId = await this.getInstanceId();
    if (max % threadCount === 0) {
      const range = (max / threadCount);
      for (let threadId = 0; threadId < threadCount; threadId++) {
        const startIndex = start;
        console.log(startIndex + ' ' + range + ' ' + threadId);
        threads.add(await this.createWorkerThread(startIndex, range, threadId, meetingAttendeeList, loadTestStartTimeStampEpoch, instanceId, accountId));
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
          threads.add(await this.createWorkerThread(startIndex, range + 1, threadId, meetingAttendeeList, loadTestStartTimeStampEpoch, instanceId, accountId));
          this.putMetricData("ThreadCreated", 1);
          start += range + 1;
        } else {
          console.log(startIndex + ' ' + (range) + ' ' + threadId);
          threads.add(await this.createWorkerThread(startIndex, range, threadId, meetingAttendeeList, loadTestStartTimeStampEpoch, instanceId, accountId));
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

  async runCmdAsync(cmd) {
    try {
      const response = new Promise(function (resolve, reject) {
        exec(cmd, (err, stdout, stderr) => {
          if (err) {
            reject(err);
          } else {
            resolve(stdout);
          }
        });
      });
      if (response) {
        return response;
      }
    } catch (err) {
      console.log(err);
      return 'localhost';
    }
  }

  // putMetricData(metricName, metricValue, namespace = this.PUT_METRIC_DATA_NAMESPACE) {
  //   const cmd = `aws cloudwatch put-metric-data --metric-name ${metricName} --dimensions Instance=\`curl http://169.254.169.254/latest/meta-data/instance-id\`  --namespace ${namespace} --value ${metricValue}`;
  //   exec(cmd);
  // }

  async putMetricData(metricName, metricValue) {
    const instanceId = await this.getInstanceId();
    const startTime = 'MasterThread N/A';
    const putMetric =
      metricScope(metrics => async (instanceId, startTime, metricName, metricValue) => {
        console.log("received message");
        metrics.putDimensions({IId: instanceId, StartTime: startTime});
        metrics.putMetric(metricName, metricValue);
        console.log("completed aggregation successfully.");
      });
    putMetric(instanceId, startTime, metricName, metricValue);
  }

  getNoOfMeetingsBasedOnCoreSize() {
    const cpuCount = os.cpus().length;
    if (cpuCount > 36) {
      return Math.floor(cpuCount * 0.50);
    }
    return Math.floor(cpuCount * 0.40);
  }

  getNoOThreadsBasedOnCoreSize() {
    const cpuCount = os.cpus().length;
    return Math.ceil(cpuCount);
  }

  async run() {
    if (isMainThread) {
      this.putMetricData('LauncherRunning', 600);
      const threadCount = this.NO_OF_THREADS;
      const noOfMeetings = this.NO_OF_MEETINGS;
      const noOfAttendeesPerMeeting = this.NO_ATTENDEES_PER_MEETING;
      this.log('ThreadCount: ' + threadCount);
      this.log('No Of Meetings: ' + noOfMeetings);
      const threads = new Set();
      //let meetingAttendeeList = new SharedArrayBuffer();
      let meetingAttendeeArray = new Array();
      let meetingAttendeeListIndex = 0;
      const sqs = new SQSOperations();
      await sqs.init('E2ELoadTestStack-ResponseQueue');
      let lastMsgReceivedFromSQS = Date.now();
      this.log((meetingAttendeeArray.length < noOfMeetings * noOfAttendeesPerMeeting).toString());
      while (meetingAttendeeArray.length < noOfMeetings * noOfAttendeesPerMeeting) {
        try {
          const createMeetingWithAttendeesResponses = await sqs.getCreateMeetingWithAttendeesBody();
          if (createMeetingWithAttendeesResponses && createMeetingWithAttendeesResponses.Messages) {
            lastMsgReceivedFromSQS = Date.now();
            for (let response = 0; response < Math.min(noOfMeetings, createMeetingWithAttendeesResponses.Messages.length); response += 1) {
              const meetingAttendeeInfo = JSON.parse(createMeetingWithAttendeesResponses.Messages[response].Body);
              //this.log(JSON.stringify(meetingAttendeeInfo));
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
                    //this.log(meetingAttendeeListIndex + ' ------> ' + new Date().toString());
                    this.log(meetingAttendeeListIndex + ' ' + JSON.stringify(meetingAttendeeArray[meetingAttendeeListIndex]));
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
              this.log('meetingAttendeeArray cleaned');
            }
          }
        } catch (err) {
          this.error('Failed SQS retrieval ' + err)
        }
      }
      if (meetingAttendeeArray.length > 0) {
        const loadTestStartTimeStampEpoch = Date.now();
        this.log('MeetingAttendeeArrayLength ' + meetingAttendeeArray.length);
        this.putMetricData("MeetingAttendeeArrayLength", meetingAttendeeArray.length);
        await this.spawnThreads(meetingAttendeeArray, threadCount, threads, loadTestStartTimeStampEpoch);
        const rtcStatReport = new WebRTCStatReport(this.realTimeMetricAggregate);
        for (let worker of threads) {
          worker.on('error', (err) => {
            console.error(err);
          });

          worker.on('exit', () => {
            threads.delete(worker);
            this.log(`Thread exiting ${threads.size} running...`);
            this.putMetricData('ThreadExit', 1);
            if (threads.size === 0) {
              this.log('Threads ended');
              meetingAttendeeArray = null;
              this.done = 1;
            }
          });

          worker.on('message', async (message) => {
            const threadId = message.threadId;
            const accountId = message.accountId;
            const instanceId = message.instanceId;
            this.log('ThreadId complete ', threadId);
            const filename = 'Log_' + accountId + '_' + instanceId;
            this.transferFileToS3(filename);
            //threads.delete(worker);
            if (threads.size === 0) {
              this.log('Threads ending');
              this.putMetricData('ThreadExit', 1);
              meetingAttendeeArray = null;
              this.done = 1;
              const filename = 'Log_' + accountId + '_' + instanceId;
              this.transferFileToS3(filename);
              console.log(filename);
              setTimeout(() => {
                //process.exit(0);
              }, 250000);
            }
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
          this.log('File created ' + meetingId);
        }
      });
    } catch (err) {
      this.error('File write: ' + err)
    }
    this.log('this.fileLocation...Master' + this.fileLocation.size);
  }

  log(str, tabNo = '') {
    let data = new Date().toString() + ' ';
    if (isMainThread) {
      data += '[Master Thread] ' + str ;
      console.log(data);
    } else {
      data += workerData.threadId + '  ' + tabNo + ' [Child Thread] ' + str;
      console.log(data);
    }
    this.writeLogErrorToFile(data);
  }

  error(str, tabNo = '') {
    this.putMetricData("[ERROR]", 1);
    let data = new Date().toString() + ' ';
    if (isMainThread) {
      data += '[Master Thread ERROR] ' + str ;
      console.log(data);
    } else {
      data += workerData.threadId + '  ' + tabNo + ' [Child Thread ERROR] ' + str;
      console.log(data);
    }
    this.writeLogErrorToFile(data);
  }

  async writeLogErrorToFile (data) {
    const accountId = (await this.getAcctountDetails()).accountId;
    const instanceId = await this.getInstanceId();
    const filename = 'Log_' + accountId + '_' + instanceId;
    fs.appendFile(filename, data+'\n', function (err) {
      if (err) throw err;
    });
  }

  transferFileToS3(fileToUpload) {
    exec(`aws s3api put-object --bucket chimesdkmeetingsloadtest --key logs/`);
    exec(`aws s3 cp ${fileToUpload} s3://chimesdkmeetingsloadtest/logs/ `);
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
      var count = Object.keys(page).length;

      if (this.realTimeMetricAggregate) {
        parentPort.postMessage({
          threadId: workerData.threadId,
          instanceId: workerData.instanceId,
          accountId: workerData.accountId,
          webRTCStatReport: webRTCStatReport[workerData.threadId]
        });
      } else {
        parentPort.postMessage({
          threadId: workerData.threadId,
          instanceId: workerData.instanceId,
          accountId: workerData.accountId
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
          //timeToWaitMS = 120000;  //2min 00 sec
          timeToWaitMS = 60000;  //2min 00 sec
          this.putMetricData('timeToWaitMS-111', 1)
        } else if (loadTestStartTimeStampEpoch + 60000 <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 120000) {
          //timeToWaitMS = 60000;  //1min 00 sec
          timeToWaitMS = 30000;  //2min 00 sec
          this.putMetricData('timeToWaitMS-222', 1)
        } else if (loadTestStartTimeStampEpoch + 120000 <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 180000) {
          //timeToWaitMS = 25000;  //0min   25 sec
          timeToWaitMS = 15000;  //0min   25 sec
          this.putMetricData('timeToWaitMS-333', 1)
        } else if (loadTestStartTimeStampEpoch + 180000 <= currentTimeStampEpoch && currentTimeStampEpoch < loadTestStartTimeStampEpoch + 240000) {
          timeToWaitMS = 5000;  //0min 5 sec
          this.putMetricData('timeToWaitMS-444', 1)
        }

        if (this.NO_OF_MEETINGS < 30) {
          timeToWaitMS /= 2;
        }

        const meetingLeaveAfterMs = timeToWaitMS + this.getRndDuration();
        const serverlessRestApi = this.getServerlessRestApiForAccount(workerData.accountId);
        //const url = 'https://' + serverlessRestApi + '.execute-api.us-east-1.amazonaws.com/Prod/v2/?timeToWaitMS=' + timeToWaitMS + '&meetingLeaveAfterMs=' + meetingLeaveAfterMs + '&meetingInfo=' + encodeURIComponent(JSON.stringify(meetingInfo)) + '&attendeeInfo=' + encodeURIComponent(JSON.stringify(attendeeInfo)) + '&instanceId=' + workerData.instanceId + '&loadTestStartTime=' + workerData.loadTestStartTimeStampEpoch;
        const url = 'http://127.0.0.1:8080/?timeToWaitMS=' + timeToWaitMS + '&meetingLeaveAfterMs=' + meetingLeaveAfterMs + '&meetingInfo=' + encodeURIComponent(JSON.stringify(meetingInfo)) + '&attendeeInfo=' + encodeURIComponent(JSON.stringify(attendeeInfo)) + '&instanceId=' + workerData.instanceId + '&loadTestStartTime=' + workerData.loadTestStartTimeStampEpoch;
        this.log(url);
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

  getServerlessRestApiForAccount(accountId) {
    if(accountId in serverlessRestApiForAccountMap) {
      return serverlessRestApiForAccountMap[accountId];
    }
    return serverlessRestApiForAccountMap['306496942465'];
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
    }, 45000);
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
      this.log('Restarting Meeting... ', meetingInfo, attendeeInfo);
      await this.openLinkInPage(page, meetingInfo, attendeeInfo, browserTab);
      await new Promise(resolve => setTimeout(resolve, 3000));
      const meetingStartStatus = await this.resumeAudioContext(page);
      if (meetingStartStatus === 'Success') {
        this.meetingSessionActive.set(browserTab, true);
        this.log('this.meetingSessionActive' , this.meetingSessionActive , browserTab);
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
        this.log('this.loadTestEndSignal ' + this.loadTestEndSignal);
        this.log(page !== null);
        if (this.loadTestEndSignal === false && page !== null && mapPageMeetingAttendee[workerData.threadId, browserTab] && mapPageMeetingAttendee[workerData.threadId, browserTab].meetingInfo && mapPageMeetingAttendee[workerData.threadId, browserTab].attendeeInfo) {
          this.log('Attempting to restart...' , page);
          page = await this.createNewPage(browser, browserTab, mapPageMeetingAttendee);
          this.log('Attempting to restart 2222' + page);
          await this.resurrectClosedMeeting(page, mapPageMeetingAttendee[workerData.threadId, browserTab].meetingInfo, mapPageMeetingAttendee[workerData.threadId, browserTab].attendeeInfo, browserTab).then(() => {
            this.log('Meeting Restarted', browserTab);
          }).catch(() => {
            this.log('Meeting failed to restart', browserTab);
            this.meetingSessionActive[browserTab] = false;
          });
        }
        this.log('Page Closedddd');
      });
    }
    return page;
  }

  async fetchMetricsFromBrowser(page) {
    setTimeout(() => {
      for (const [key, value] of Object.entries(page)) {
        this.reportFetch[key] = setInterval(async () => {
          this.putMetricData('Beacon-' + workerData.threadId, 1);
          this.log(" meetingSessionActive " + this.meetingSessionActive.get(key));
          try {
            if (this.meetingSessionActive.get(key) === true && page[key] !== null) {
              const metricReport = await page[key].evaluate(() => app.metricReport);
              if (metricReport.meetingId || metricReport.attendeeId || metricReport.audioDecoderLoss || metricReport.audioPacketsReceived || metricReport.audioPacketsReceivedFractionLoss || metricReport.audioSpeakerDelayMs || metricReport.availableReceiveBandwidth || metricReport.availableSendBandwidth) {
                const bodyHTML = await page[key].evaluate(() => document.body.innerText);
                this.log(bodyHTML);
                this.writeMetricsToFile(metricReport, metricReport.attendeeId, workerData.meetingsDirectory + '/' + metricReport.meetingId);
              } else {
                this.log('Metrics not received');
                this.putMetricData('MeetingInactive', 1);
                const bodyHTML = await page[key].evaluate(() => document.body.innerText);
                this.log(bodyHTML);
              }
            } else {
              this.log('Failed Metrics Reading');
            }
          } catch (err) {
            this.error('Cannot retrieve Metrics from browser meeting ' + err.message);
            this.error('this.meetingSessionActive[browserTab] ' + this.meetingSessionActive.get(key), key);
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
    }
  }


  async closeBrowserTab(page) {
    try {
      this.meetingSessionActive[browserTab] = false;
      if (page !== null) {
        let localPage = page;
        page = null;
        await localPage.close();
        localPage = null;
        this.log('Close BrowserTab Success ');
      }
    } catch (err) {
      this.error('Close BrowserTab failed ' + err);
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
              this.meetingSessionActive.set(key, false);
              if (typeof this.reportFetch !== 'undefined' && this.reportFetch[key] !== null) {
                clearInterval(this.reportFetch[key]);
                this.reportFetch[key] = null;
              }
              await pages[0].close();
            } catch (err) {
              this.error(err);
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
      //const expectedParameters = ['_', 'meetingCount', 'noOfThreads', 'attendeesPerMeeting', 'minDurationMin', 'maxDurationMin', 'metricGrabFrequencyMin'];
      const expectedParameters = {_: 1, meetingCount: 1, noOfThreads: 1, attendeesPerMeeting: 1, minDurationMin: 1, maxDurationMin: 1, metricGrabFrequencyMin: 1, putMetricDataNamespace: 1};

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

      if (launcherArgs.putMetricDataNamespace && typeof launcherArgs.putMetricDataNamespace !== 'string') {
        console.log('Parameter `putMetricDataNamespace` should be of type `string`');
        process.exit(1)
      }
    }
  }
}

new MeetingLauncher();