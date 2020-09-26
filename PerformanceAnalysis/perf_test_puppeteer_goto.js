'use strict';
import {createRequire} from "module";
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');

const iterations = 2000;

(async () => {
  let browser = await puppeteer.launch();
  const browserWSEndpoint = browser.wsEndpoint();



  const start_time = performance.now();

  for (let i = 0; i < iterations; i++) {
    const page = await browser.newPage();
    page.on('error', err => {
      console.log('error occured: ', err);
    });

    const response = await page.goto('https://google.com/').catch(() => {
      console.log('Failed to load localhost')
    });
  }
  browser.disconnect();
  const end_time = performance.now();

  const total_time = end_time - start_time;
  const average_time = total_time / iterations;

  process.stdout.write (
    'Total Time:\t' + total_time + ' ms\n'
    + 'Average Time:\t' + average_time + ' ms\n'
    + 'Iterations:\t' + iterations.toLocaleString() + '\n'
  );

  process.exit();
})();