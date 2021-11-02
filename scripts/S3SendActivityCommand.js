import { createRequire } from 'module';
import { s3BucketName } from '../configs/Constants.js';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
const { exec } = require('child_process');
const fs = require('fs');
const activityFile = '../configs/Activity.json';
const rawData = fs.readFileSync(activityFile);
const activityJSON = JSON.parse(rawData);

if (activityJSON.hasOwnProperty('activityCommands')) {
  const activityCommandsList = activityJSON.activityCommands;
  activityCommandsList.forEach((activityCommand) => {
    if (!(activityCommand.hasOwnProperty('meetingName') && activityCommand.hasOwnProperty('attendeeName') && activityCommand.hasOwnProperty('commands'))) {
      console.error('Missing one or more parameters: meetingName | attendeeName | commands');
      return;
    }
    const meetingName = activityCommand.meetingName;
    const attendeeName = activityCommand.attendeeName;
    const commandList = activityCommand.commands;
    const downloadActivityFileToS3 = `aws s3 cp s3://${s3BucketName}/activity/${meetingName}_${attendeeName}.txt .`;
    shell.exec(downloadActivityFileToS3);

    const commands = [];
    commandList.forEach((cmd) => {
      if (!cmd.hasOwnProperty('activity')) {
        console.error('Missing activity attribute');
        return;
      }
      commands.push({ ...cmd });
    });

    const activityCommands = {
      meetingName,
      attendeeName,
      timestamp: Date.now(),
      commands
    };

    const writeActivityToFile = `echo '${JSON.stringify(activityCommands)}' > ${meetingName}_${attendeeName}.txt`;
    shell.exec(writeActivityToFile);
    const uploadActivityFileToS3 = `aws s3 cp ${meetingName}_${attendeeName}.txt s3://${s3BucketName}/activity/`;
    shell.exec(uploadActivityFileToS3);
    const removeActivityFileToS3 = `rm ${meetingName}_${attendeeName}.txt`;
    shell.exec(removeActivityFileToS3);
  });
}