import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
import {
  stackName,
  meetingName,
  attendeesPerMeetingCount,
  activeVideosPerMeetingCount
} from '../configs/Constants.js';

const ssmCmd = `aws ssm send-command --document-name "AWS-RunShellScript" --document-version "1" --targets '[{"Key":"tag:aws:cloudformation:stack-name","Values":["${stackName}"]}]' --parameters '{"commands":["cd ../../home/ec2-user/","ls","cd ChimeSDKMeetingsLoadTest/src","ls","","node ClientLauncher.js --attendeesPerMeeting ${attendeesPerMeetingCount} --loadTestSessionName '"'"'${meetingName}'"'"'"],"workingDirectory":[""],"executionTimeout":["3600"]}' --timeout-seconds 600 --max-concurrency "50" --max-errors "0" --cloud-watch-output-config '{"CloudWatchOutputEnabled":true}' --region us-east-1`;

shell.exec(ssmCmd);

