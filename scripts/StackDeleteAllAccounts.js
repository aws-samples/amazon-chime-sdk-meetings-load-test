import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
const { exec } = require('child_process');
const fs = require('fs');
import accountMap from '../configs/AccountMap.js';

for (const [role, accNumber] of Object.entries(accountMap)) {
  console.log('In Account Number: ', accNumber);
  let cmd = `CONTINGENT_AUTH=1 ~/cli/src/UCBuzzCliTools/bin/isencreds -a ${accNumber} -r us-east-1 -o ${role}`;
  const responseListStack = shell.exec('aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE');
  const responseListStackJSON = JSON.parse(responseListStack);
  for (let iter = 0; iter < responseListStackJSON.StackSummaries.length; iter += 1) {
    const stackName = responseListStackJSON.StackSummaries[iter].StackName;
    if (stackName.includes('ChimeMeetingsSDKLoadTest')) {
      console.log('Deleting stack: ', stackName);
      shell.exec(`aws cloudformation delete-stack --stack-name ${stackName}`);
    }
  }
}