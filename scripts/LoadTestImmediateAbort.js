import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');

const fs = require('fs');

const data = JSON.stringify({
  LoadTestStatus: 'Abort',
});

const file = '../configs/LoadTestStatus.json';

try {
  fs.writeFileSync(file, data);
  console.log(file + ' created');
} catch (err) {
  console.log(err);
}

let cmd = `CONTINGENT_AUTH=1 ~/cli/src/UCBuzzCliTools/bin/isencreds -a 306496942465 -r us-east-1 -o aws-uc-loadtest-gamma-iad-001-admin`;
shell.exec(cmd);
shell.exec(
  `aws s3 cp ~/ChimeSDKMeetingsLoadTest/src/ChimeSDKMeetingsLoadTest/configs/ s3://chimesdkmeetingsloadtest/src/configs --recursive --include 'LoadTestStatus.json' --exclude '*.js' --exclude '*.sh'`
);
