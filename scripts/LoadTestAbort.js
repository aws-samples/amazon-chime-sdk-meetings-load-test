import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
import accountMap from '../configs/AccountMap.js';

for (const [role, accNumber] of Object.entries(accountMap)) {
  console.log('Setting Creds for Account Number: ', accNumber);
  let cmd = `~/cli/src/UCBuzzCliTools/bin/./isencreds -a ${accNumber} -r us-east-1 -o ${role}`;
  shell.exec(cmd);
  shell.exec(`aws ssm send-command --document-name "AWS-RunShellScript" --document-version "1" --targets '[{"Key":"tag-key","Values":["LoadTest"]}]' --parameters '{"workingDirectory":[""],"executionTimeout":["3600"],"commands":["sudo ps aux | grep puppeteer | grep -v grep | awk '"'"'{print $2}'"'"' | xargs kill -9","sudo ps aux | grep node | grep -v grep | awk '"'"'{print $2}'"'"' | xargs kill -9","sudo ps aux | grep aws | grep -v grep | awk '"'"'{print $2}'"'"' | xargs kill -9"]}' --timeout-seconds 600 --max-concurrency "50" --max-errors "0" --region us-east-1`);
}
