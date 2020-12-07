import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
const minimist = require('minimist');
const { exec } = require('child_process');

const args = minimist(process.argv.slice(2));
if(!args.hasOwnProperty('accountNumber') || !args.hasOwnProperty('accountRole')) {
  console.log(`Missing required parameters 'accountNumber' or 'accountRole'`);
  process.exit(1);
} else {
  const accountNumber = args.accountNumber;
  const accountRole = args.accountRole;
  console.log('Enabling Event Bridge E2ECommenceFeeding for Account Number: ', accountNumber);
  const cmd = `CONTINGENT_AUTH=1  ~/cli/src/UCBuzzCliTools/bin/isencreds -a ${accountNumber} -r us-east-1 -o ${accountRole}`;
  shell.exec(cmd);
  shell.exec(`aws events enable-rule --name E2ECommenceFeeding`);
}
