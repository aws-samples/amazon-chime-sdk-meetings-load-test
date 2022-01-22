export default class ClientController {

	constructor(pages, support) {
		this.pages = pages;
		this.support = support;
	}

	async startMeetingSession(meetingId, attendeeName, inputMeetingTextBox, inputNameTextBox, authenticateButton, browserTabList = []) {
		if (browserTabList.length > 0) {
			for (const browserTab of browserTabList) {
				await this.startMeetingSessionOnPage(meetingId, attendeeName, browserTab, this.pages[browserTab], inputMeetingTextBox, inputNameTextBox, authenticateButton);
			}
		} else {
			for (const [browserTab, page] of Object.entries(this.pages)) {
				await this.startMeetingSessionOnPage(meetingId, attendeeName, browserTab, page, inputMeetingTextBox, inputNameTextBox, authenticateButton);
			}
		}
	}

	async startMeetingSessionOnPage(meetingName, attendeeName, browserTab, page, inputMeetingTextBox, inputNameTextBox, authenticateButton) {
		try {
			if (page) {
				await this.support.delay(5000);
				const meetingStartStatus = await page.evaluate(
					(attendeeName, meetingName, inputMeetingTextBox, inputNameTextBox, authenticateButton) => {
						return new Promise((resolve) => {
							try {
								document.getElementById(inputMeetingTextBox).value = meetingName;
								document.getElementById(inputNameTextBox).value = attendeeName;
								document.getElementById(authenticateButton).click();
								resolve('Success');
							} catch (err) {
								resolve('Fail');
							}
						});
					}, attendeeName, meetingName, inputMeetingTextBox, inputNameTextBox, authenticateButton );

				if (meetingStartStatus === 'Success') {
					this.support.log('Meeting start success on tab ', browserTab);
					this.support.putMetricData('MeetingStartSuccess', 1);
				} else {
					this.support.log('Meeting start failed on tab ', browserTab);
					this.support.putMetricData('MeetingStartFail', 1);
				}
			}
		} catch (err) {
			this.support.error('Exception on page evaluate ' + err, browserTab);
			this.support.putMetricData('MeetingStartFailPageEvaluate', browserTab);
		}
	}

	async joinMeeting(joinButton, browserTabList = []) {
		if (browserTabList.length > 0) {
			for (const browserTab of browserTabList) {
				await this.joinMeetingOnPage(joinButton, browserTab, this.pages[browserTab]);
			}
		} else {
			for (const [browserTab, page] of Object.entries(this.pages)) {
				await this.joinMeetingOnPage(joinButton, browserTab, page);
			}
		}
	}

	async joinMeetingOnPage(joinButton, browserTab, page) {
		try {
			if (page) {
				// await page.waitForNavigation();
				await this.support.delay(2000);
				const meetingStartStatus = await page.evaluate((joinButton) => {
					return new Promise((resolve, reject) => {
						try {
							document.getElementById(joinButton).click();
							resolve('Success');
						} catch (err) {
							resolve('Fail');
						}
					});
				}, joinButton);

				if (meetingStartStatus === 'Success') {
					this.support.log('Join meeting SUCCESS on tab ', browserTab);
					this.support.putMetricData('JoinMeetingSuccess', 1);
				} else {
					this.support.log('Join meeting FAIL on tab ', browserTab);
					this.support.putMetricData('JoinMeetingFail', 1);
				}
			}
		} catch (err) {
			this.support.error('Exception on page evaluate ' + err, browserTab);
			this.support.putMetricData('MeetingStartFailPageEvaluate', 1);
		}
	}

	async toggleLocalVideo(cameraButton, browserTabList = []) {
		if (browserTabList.length > 0) {
			for (const browserTab of browserTabList) {
				await this.toggleVideoOnPage(cameraButton, browserTab, this.pages[browserTab]);
			}
		} else {
			for (const [browserTab, page] of Object.entries(this.pages)) {
				await this.toggleVideoOnPage(cameraButton, browserTab, page);
			}
		}
	}

	async toggleVideoOnPage(cameraButton, browserTab, page) {
		try {
			if (page) {
				this.support.log('Attempting to toggle video on', browserTab);
				const videoToggle = await page.evaluate(async (cameraButton) => {
					return new Promise((resolve, reject) => {
						try {
							document.getElementById(cameraButton).click();
							resolve('Success');
						} catch (err) {
							resolve('Fail');
						}
					});
				}, cameraButton);
				if (videoToggle === 'Success') {
					this.support.log('Video toggled on tab #', browserTab);
				} else {
					this.support.error('Failed to toggle video on tab #', browserTab);
				}
			}
		} catch (err) {
			this.support.error('Failed to toggle video on tab # ', browserTab + ' due to ' + err);
		}
	}

	async toggleLocalMute(muteButton, browserTabList = []) {
		if (browserTabList.length > 0) {
			for (const browserTab of browserTabList) {
				await this.muteAttendeeOnPage(muteButton, browserTab, this.pages[browserTab]);
			}
		} else {
			for (const [browserTab, page] of Object.entries(this.pages)) {
				await this.muteAttendeeOnPage(muteButton, browserTab, page);
			}
		}
	}

	async muteAttendeeOnPage(muteButton, browserTab, page) {
		try {
			if (page) {
				this.support.log(`Attempting to toggle mute on ${browserTab}`);
				const muteToggle = await page.evaluate(async (muteButton) => {
					return new Promise((resolve, reject) => {
						try {
							document.getElementById(muteButton).click();
							resolve('Success');
						} catch (err) {
							resolve('Fail');
						}
					});
				}, muteButton);
				if (muteToggle === 'Success') {
					this.support.log(`Mute toggled on tab #${browserTab}`);
				} else {
					this.support.error(`Failed to toggle mute on tab #${browserTab}`);
				}
			}
		} catch (err) {
			this.support.error(`Failed to toggle mute on tab #${browserTab} due to ${err}`);
		}
	}

	async leaveMeeting(meetingDuration, meetingLeaveButton, browserTabList = []) {
		if (browserTabList.length > 0) {
			for (const browserTab of browserTabList) {
				setTimeout(async (meetingLeaveButton, browserTab) => {
					await this.leaveMeetingOnPage(meetingDuration, meetingLeaveButton, browserTab, this.pages[browserTab]);
				}, meetingDuration, meetingLeaveButton, browserTab);
			}
		} else {
			setTimeout(async (meetingLeaveButton) => {
				for (const [browserTab, page] of Object.entries(this.pages)) {
					await this.leaveMeetingOnPage(meetingDuration, meetingLeaveButton, browserTab, page);
				}
			}, meetingDuration, meetingLeaveButton);
		}
	}

	async leaveMeetingOnPage(meetingDuration, meetingLeaveButton, browserTab, page) {
		try {
			this.support.log('Attempting to leave meeting');
			const closeStatus = await page.evaluate(async (meetingLeaveButton) => {
				return new Promise((resolve, reject) => {
					try {
						document.getElementById(meetingLeaveButton).click();
						resolve('Success');
					} catch (err) {
						resolve('Fail');
					}
				});
			}, meetingLeaveButton);
			if (closeStatus === 'Success') {
				this.support.log('Attendee left meeting', browserTab);
				this.support.putMetricData('MeetingLeaveSuccess', 1);
			} else {
				this.support.error('Failed to leave meeting from the browser ');
				this.support.putMetricData('MeetingLeaveFail', 1);
			}
		} catch (err) {
			this.support.error('Failed to leave meeting ' + err, browserTab);
			this.support.putMetricData('MeetingLeaveFail', 1);
		}
	}
}