import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
import accountMap from '../configs/AccountMap.js';
const {exec} = require('child_process');

for (const [role, accNumber] of Object.entries(accountMap)) {
  console.log('Setting Creds for Account Number: ', accNumber);
  let cmd = `~/cli/src/UCBuzzCliTools/bin/./isencreds -a ${accNumber} -r us-east-1 -o ${role}`;
  shell.exec(cmd);
  shell.exec(`aws events disable-rule --name E2ECommenceFeeding`);
}