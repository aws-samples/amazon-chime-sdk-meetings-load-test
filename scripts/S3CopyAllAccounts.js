import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
import accountMap from '../configs/AccountMap.js';
const { exec } = require('child_process');

for (const [role, accNumber] of Object.entries(accountMap)) {
  console.log('Setting Creds for Account Number: ', accNumber);
  let cmd = `~/cli/src/UCBuzzCliTools/bin/./isencreds -a ${accNumber} -r us-east-1 -o ${role}`;
  shell.exec(cmd);
  shell.exec(`aws s3api create-bucket --bucket chimesdkmeetingsloadtest-${accNumber}-1 --region us-east-1`);
  shell.exec(`aws s3api put-object --bucket chimesdkmeetingsloadtest-${accNumber}-1 --key src/`);
  shell.exec(`aws s3 cp ~/ChimeSDKMeetingsLoadTest/src/ChimeSDKMeetingsLoadTest/ s3://chimesdkmeetingsloadtest-${accNumber}-1/src/ --recursive --include '*.js' --exclude '.git/*' --exclude 'node_modules/*' --exclude '.idea/*'`);
}
