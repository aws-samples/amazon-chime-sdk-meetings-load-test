import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
import accountMap from '../configs/AccountMap.js';
import { s3BucketName } from '../configs/Constants.js';

shell.exec(`cd ~`);
shell.exec(`rm -rf sdk_client`);
shell.exec(`git clone https://github.com/RidipDe/sdk_client.git`);
shell.exec(`cd ~/sdk_client/`);
shell.exec(`pwd`);
shell.exec(`cd ~/sdk_client/ && npm run build`);

for (const [role, accNumber] of Object.entries(accountMap)) {
  console.log('Setting Creds for Account Number: ', accNumber);
  shell.exec(`~/cli/src/UCBuzzCliTools/bin/./isencreds -a ${accNumber} -r us-east-1 -o ${role}`);
  shell.exec(`cd ~/sdk_client/demos/serverless && node ./deploy.js -r us-east-1 -b ${s3BucketName} -s ${s3BucketName} -a meeting`);
  console.log(`cd /Users/ridip/sdk_client/amazon-chime-sdk-js/demos/browser && npm run build && cd /Users/ridip/sdk_client/amazon-chime-sdk-js/demos/serverless && node ./deploy.js -r us-east-1 -b loadtestclient-${accNumber} -s loadtestclient-${accNumber} -a meeting`);
}
