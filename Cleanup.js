import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const {exec} = require('child_process');

exec(`sudo ps aux | grep puppeteer | grep -v grep | awk '{print $2}' | xargs kill -9`);
exec(`sudo ps aux | grep node | grep -v grep | awk '{print $2}' | xargs kill -9`);
exec(`sudo ps aux | grep aws | grep -v grep | awk '{print $2}' | xargs kill -9`);