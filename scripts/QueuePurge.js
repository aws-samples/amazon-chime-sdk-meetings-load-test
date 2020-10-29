import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
import accountMap from '../configs/AccountMap.js';
const {exec} = require('child_process');


for (const [role, accNumber] of Object.entries(accountMap)) {
  console.log('Setting Creds for Account Number: ', accNumber);
  let cmd = `~/cli/src/UCBuzzCliTools/bin/./isencreds -a ${accNumber} -r us-east-1 -o ${role}`;
  shell.exec(cmd);
  const listQueues = shell.exec('aws sqs list-queues --queue-name-prefix E2ELoadTestStack-ResponseQueue');
  const interestedQueueLink = JSON.parse(listQueues).QueueUrls[0];
  shell.exec(`aws sqs purge-queue --queue-url ${interestedQueueLink}`);

}