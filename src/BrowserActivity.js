import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

export default class BrowserActivity {

  constructor(support) {
    this.support = support;
  }

  async openBrowser() {
    process.setMaxListeners(Infinity);
    const browser = await puppeteer
      .launch({
        headless: true,
        args: [
          '--use-fake-ui-for-media-stream',
          '--disable-dev-shm-usage',
          '--use-fake-device-for-media-stream',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--single-process',
          '--no-zygote',
        ],
      })
      .catch(async (err) => {
        this.support.error('Browser launch failed: ' + err);
        return this.openBrowser();
      });

    if (typeof browser !== 'undefined') {
      browser.on('error', async (message) => {
        this.support.error('Browser Errored out ');
      });

      browser.on('close', async (message) => {
        this.support.error('Browser Closed out');
      });

      browser.on('disconnect', async (message) => {
        this.support.error('Browser Disconnected out ');
      });
    }
    return browser;
  }
}