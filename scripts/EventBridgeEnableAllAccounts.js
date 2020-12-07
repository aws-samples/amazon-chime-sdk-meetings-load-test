import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
import accountMap from '../configs/AccountMap.js';

for (const [role, accNumber] of Object.entries(accountMap)) {
  console.log('Disabling Event rule E2ECommenceFeeding for Account Number: ', accNumber);
  let cmd = `CONTINGENT_AUTH=1  ~/cli/src/UCBuzzCliTools/bin/isencreds -a ${accNumber} -r us-east-1 -o ${role}`;
  shell.exec(cmd);
  shell.exec(`aws events enable-rule --name E2ECommenceFeeding`);
}
