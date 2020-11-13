import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
const { exec } = require('child_process');
const fs = require('fs');

const data = JSON.stringify({
  LoadTestStatus: 'Active',
});

const file = '../configs/LoadTestStatus.json';

try {
  fs.writeFileSync(file, data);
  console.log(file + ' created');
} catch (err) {
  console.log(err);
}

let cmd = `cd ~/cli/src/UCBuzzCliTools/bin/ && CONTINGENT_AUTH=1 ./isencreds -a 306496942465 -r us-east-1 -o aws-uc-loadtest-gamma-iad-001-admin`;
shell.exec(cmd);
shell.exec(`aws s3api create-bucket --bucket chimesdkmeetingsloadtest --region us-east-1`);
shell.exec(`aws s3api put-object --bucket chimesdkmeetingsloadtest --key src/`);
shell.exec(`aws s3 cp ~/ChimeSDKMeetingsLoadTest/src/ChimeSDKMeetingsLoadTest/ s3://chimesdkmeetingsloadtest/src/ --recursive --include '*.js' --exclude '.git/*' --exclude 'node_modules/*' --exclude '.idea/*'`);
