'use strict';
import {createRequire} from "module";
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');

const iterations = 2000;

(async () => {
  let browser;

  const start_time = performance.now();

  for (let i = 0; i < iterations; i++) {
    browser = await puppeteer.launch();

    const page = await browser.newPage();
    page.on('error', err => {
      console.log('error occured: ', err);
    });

    //const response = await page[browserTab].goto('http://127.0.0.1:8080/?meetingInfo=' + encodeURIComponent(JSON.stringify(meetingInfo)) + '&attendeeInfo=' + encodeURIComponent(JSON.stringify(attendeeInfo)) + '').catch(() => {
    const response = await page.goto('https://www.youtube.com/watch?v=fn5x9R7lGnM')
      .then(() => {
        console.log('browser tab # ', i);
      })
      .catch(() => {
      console.log('Failed to load localhost')
    });


  }
  const end_time = performance.now();
  setTimeout(async() => {await browser.close();}, 1200000)

  const total_time = end_time - start_time;
  const average_time = total_time / iterations;

  process.stdout.write (
    'Total Time:\t' + total_time + ' ms\n'
    + 'Average Time:\t' + average_time + ' ms\n'
    + 'Iterations:\t' + iterations.toLocaleString() + '\n'
  );
})();