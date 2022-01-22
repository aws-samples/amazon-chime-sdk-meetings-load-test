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
				headless: !this.support.isLocalMachine,
				args: [
					'--use-fake-device-for-media-stream',
					'--use-fake-ui-for-media-stream',
					'--disable-dev-shm-usage',
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
				this.support.error('Browser errored out ');
			});

			browser.on('close', async (message) => {
				this.support.error('Browser closed');
			});

			browser.on('disconnect', async (message) => {
				this.support.error('Browser disconnected');
			});
		}
		return browser;
	}
}