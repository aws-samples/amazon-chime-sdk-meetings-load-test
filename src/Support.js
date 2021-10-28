import {createRequire} from 'module';
import { s3BucketName } from '../configs/Constants.js';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
require('events').EventEmitter.prototype._maxListeners = Infinity;
const { metricScope } = require('aws-embedded-metrics');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

export default class Support {

  constructor(isLocalMachine, loadTestSessionId) {
    if (isMainThread) {
      this.isLocalMachine = isLocalMachine;
    } else {
      this.isLocalMachine = workerData.sharedConfigParameters.isLocalMachine;
    }
    console.log('isLocalMachine', this.isLocalMachine);
    this.LOADTEST_SESSION_NAME = loadTestSessionId || this.getLoadTestSessionId();
  }

  getLoadTestSessionId () {
    const file = './configs/LoadTestStatus.json';
    const rawData = fs.readFileSync(file);
    const jsonData = JSON.parse(rawData);
    return jsonData.LoadTestSessionId.toString();
  }

  getRndDuration(max, min) {
    return (Math.floor(Math.random() * (max - min + 1)) + min);
  }

  async done() {
    try {
      console.log('Done ');
    } catch (error) {
      console.log(error);
    }
  }

  cleanup() {
    console.log('cleanup ');
    this.putMetricData('CleanupInitiated', 1);
    exec(`sudo ps -aux | grep 'puppeteer' | xargs kill -9`);
    exec(`sudo ps aux | grep puppeteer | grep -v grep | awk '{print $2}' | xargs kill -9`);
  }

  async getAccountDetails() {
    if (this.isLocalMachine) {
      return 'local_machine';
    }
    const cmd = `curl -s http://169.254.169.254/latest/dynamic/instance-identity/document`;
    const accountDetails = JSON.parse(await this.runCmdAsync(cmd));
    return accountDetails;
  }

  async getInstanceId() {
    if (this.isLocalMachine) {
      return 'local_machine';
    }
    const cmd = `curl http://169.254.169.254/latest/meta-data/instance-id`;
    const instanceId = await this.runCmdAsync(cmd);
    return instanceId;
  }

  async getAttendeeName(browserTab) {
    return await this.getInstanceId() + '-' + browserTab
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

  async putMetricData(metricName, metricValue) {
    if (this.isLocalMachine) {
      return;
    }
    const instanceId = await this.getInstanceId();
    const startTime = 'MasterThread N/A';
    metricScope.logGroupName = "LoadTest_Metrics";
    const putMetric = metricScope(
      (metrics) => async (instanceId, startTime, metricName, metricValue) => {
        console.log('received message');
        metrics.putDimensions({ SId: this.LOADTEST_SESSION_NAME, IId: instanceId, StartTime: startTime });
        metrics.putMetric(metricName, metricValue);
        console.log('completed aggregation successfully.');
      }
    );
    putMetric(instanceId, startTime, metricName, metricValue);
  }

  getNoOfMeetingsBasedOnCoreSize() {
    const cpuCount = os.cpus().length;
    if (cpuCount >= 36) {
      return Math.floor(cpuCount * 0.10);
    }
    return Math.floor(cpuCount * 0.08);
  }

  getNoOThreadsBasedOnCoreSize() {
    const cpuCount = os.cpus().length;
    return Math.ceil(cpuCount);
  }

  async initializeFileToStoreMetricForMeeting(meetingId) {
    try {
      const dataToWriteToFile =
        'audioPacketsReceived,audioDecoderLoss,audioPacketsReceivedFractionLoss,audioSpeakerDelayMs,availableSendBandwidth,attendeeId,timestamp\n';
      fs.writeFile(this.fileLocation.get(meetingId) + '.csv', dataToWriteToFile, function (err) {
        if (err) {
          console.error('Failed to create file due to ' + err.message + dataToWriteToFile);
        } else {
          this.log('File created ' + meetingId);
        }
      });
    } catch (err) {
      this.error('File write: ' + err);
    }
    this.log('this.fileLocation...Master' + this.fileLocation.size);
  }

  log(str, tabNo = '') {
    let data = new Date().toString() + ' ';
    if (isMainThread) {
      data += '[Master Thread] ' + str;
      console.log(data);
    } else {
      data += workerData.threadId + '  ' + tabNo + ' [Child Thread] ' + str;
      console.log(data);
    }
    this.writeLogErrorToFile(data);
  }

  error(str, tabNo = '') {
    this.putMetricData('[ERROR]', 1);
    let data = new Date().toString() + ' ';
    if (isMainThread) {
      data += '[Master Thread ERROR] ' + str;
      console.log(data);
    } else {
      data += workerData.threadId + '  ' + tabNo + ' [Child Thread ERROR] ' + str;
      console.log(data);
    }
    this.writeLogErrorToFile(data);
  }

  async writeLogErrorToFile(data) {
    const accountId = (await this.getAccountDetails()).accountId;
    const instanceId = await this.getInstanceId();
    const filename = 'Log_' + accountId + '_' + instanceId;
    fs.appendFile(filename, data + '\n', function (err) {
      if (err) throw err;
    });
  }

  transferFileToS3(fileToUpload) {
    exec(`aws s3api put-object --bucket ${s3BucketName} --key logs/`);
    exec(`aws s3 cp ${fileToUpload} s3://${s3BucketName}/logs/ `);
  }

  delay(ms) {
    return new Promise( resolve => setTimeout(resolve, ms) );
  }
}