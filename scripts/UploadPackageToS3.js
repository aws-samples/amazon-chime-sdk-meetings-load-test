import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
const fs = require('fs');
import { s3BucketName } from '../configs/Constants.js';

const file = '../configs/LoadTestStatus.json';

const rawData = fs.readFileSync(file);
const jsonData = JSON.parse(rawData);
let newLoadTestSessionIdNumber = 0;
if(jsonData.hasOwnProperty('LoadTestSessionId')) {
	const loadTestSessionId = jsonData.LoadTestSessionId.toString();
	const loadTestSessionNumber = loadTestSessionId.split('-').length > 1 ? loadTestSessionId.split('-').pop() : undefined;
	newLoadTestSessionIdNumber = loadTestSessionNumber ? parseInt(loadTestSessionNumber) + 1 : 0;
}

const data = JSON.stringify({
	LoadTestStatus: 'Active',
	LoadTestSessionId: 'LoadTest-' + newLoadTestSessionIdNumber
});


try {
	fs.writeFileSync(file, data);
	console.log(file + ' created');
} catch (err) {
	console.log(err);
}

shell.exec(`aws s3api create-bucket --bucket ${s3BucketName} --region us-east-1 --acl private`);
shell.exec(`aws s3api put-object --bucket ${s3BucketName} --key src/`);
shell.exec(`aws s3 cp ~/ChimeSDKMeetingsLoadTest/src/ChimeSDKMeetingsLoadTest/ s3://${s3BucketName}/src/ --recursive --include '*.js' --exclude '.git/*' --exclude 'node_modules/*' --exclude 'CDK/*' --exclude '.idea/*'`);
