import { createRequire } from 'module';
import { s3BucketName } from '../configs/Constants.js';
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

shell.exec(
	`aws s3 cp ~/ChimeSDKMeetingsLoadTest/src/ChimeSDKMeetingsLoadTest/configs/ s3://${s3BucketName}/src/configs --recursive --include 'LoadTestStatus.json' --exclude '*.js' --exclude '*.sh'`
);
