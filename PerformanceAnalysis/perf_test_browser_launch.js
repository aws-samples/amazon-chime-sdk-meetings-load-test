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

    await browser.close();
  }

  const end_time = performance.now();

  const total_time = end_time - start_time;
  const average_time = total_time / iterations;

  process.stdout.write (
    'Total Time:\t' + total_time + ' ms\n'
    + 'Average Time:\t' + average_time + ' ms\n'
    + 'Iterations:\t' + iterations.toLocaleString() + '\n'
  );
})();