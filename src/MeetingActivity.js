import {createRequire} from 'module';
import SQSOperations from './SQSOperations.js';
const require = createRequire(import.meta.url);
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

export default class MeetingActivity {
  constructor(sharedConfigParameters, support) {
    this.support = support;
    this.meetingCount = sharedConfigParameters.meetingCount;
    this.attendeesPerMeeting = sharedConfigParameters.attendeesPerMeeting;
    this.activeVideosPerMeeting = sharedConfigParameters.activeVideosPerMeeting;
  }

  getMeetingsDirectory() {
    const sessionTimeStamp = new Date().toISOString();
    const meetingsDirectory = 'Readings/MeetingsDirectory_' + sessionTimeStamp;
    try {
      if (!fs.existsSync(meetingsDirectory)) {
        fs.mkdirSync(meetingsDirectory, { recursive: true });
      }
    } catch (err) {
      console.error(err);
    }
    return meetingsDirectory;
  }

  async createMeetingAttendeeListFromPasscode (passcode, noOfAttendees) {
    if (!passcode) {
      throw new Error('Need parameters: Passcode');
    }
    let meetingAttendeeArray = new Array();
    let meetingAttendeeListIndex = 0;
    let activeVideosPerMeeting = Math.min(this.activeVideosPerMeeting, this.attendeesPerMeeting);
    for (let attendees = 0; attendees < noOfAttendees; attendees += 1) {
      try {
        const requestBody = JSON.stringify({
          Passcode: passcode.toString(),
          DisplayName: uuidv4(),
          DeviceId: uuidv4(),
          DevicePlatform: 'webclient'
        });
        const response = await fetch('https://api.express.ue1.app.chime.aws/meetings/v2/anonymous/join_meeting', {
          method: 'POST',
          body: requestBody
        });
        const bodyJson = await response.json();
        const meetingAttendeeObject = this.createMeetingAttendeeObject(bodyJson);
        if (meetingAttendeeObject) {
          meetingAttendeeObject.Attendee.VideoEnable = activeVideosPerMeeting > 0;
          activeVideosPerMeeting -= 1;
          meetingAttendeeArray[meetingAttendeeListIndex] = {
            Meeting: meetingAttendeeObject.Meeting,
            Attendees: meetingAttendeeObject.Attendee,
          };
          meetingAttendeeListIndex += 1;
        } else {
          process.exit(1);
        }
      } catch (err) {
        console.log('Error while Fetching ', err)
      }
    }
    return meetingAttendeeArray;
  }

  async createMeetingAttendeeListFromSQS(sqsName) {
    const sqs = new SQSOperations();
    await sqs.init(sqsName);
    let meetingAttendeeArray = new Array();
    let meetingAttendeeListIndex = 0;
    let lastMsgReceivedFromSQS = Date.now();
    while (meetingAttendeeArray.length < this.meetingCount * this.attendeesPerMeeting) {
      try {
        const createMeetingWithAttendeesResponses = await sqs.getCreateMeetingWithAttendeesBody();
        if (createMeetingWithAttendeesResponses && createMeetingWithAttendeesResponses.Messages) {
          for (let response = 0; response < Math.min(this.meetingCount, createMeetingWithAttendeesResponses.Messages.length); response += 1) {
            const meetingAttendeeInfo = JSON.parse(createMeetingWithAttendeesResponses.Messages[response].Body);
            let activeVideosPerMeeting = Math.min(this.activeVideosPerMeeting, this.attendeesPerMeeting);
            if (meetingAttendeeInfo &&
              meetingAttendeeInfo.Meeting &&
              meetingAttendeeInfo.Attendees) {
              const meetingInfo = meetingAttendeeInfo.Meeting;
              const attendeeInfo = meetingAttendeeInfo.Attendees;
              let lock = false;
              for (let attendee = 0; attendee < attendeeInfo.length; attendee += 1) {
                if (lock === false && meetingAttendeeListIndex < this.meetingCount * this.attendeesPerMeeting) {
                  lock = true;
                  attendeeInfo[attendee].VideoEnable = activeVideosPerMeeting > 0;
                  activeVideosPerMeeting -= 1;
                  meetingAttendeeArray[meetingAttendeeListIndex] = {
                    Meeting: meetingInfo,
                    Attendees: attendeeInfo[attendee]
                  };
                  this.support.log(meetingAttendeeListIndex + ' ' + JSON.stringify(meetingAttendeeArray[meetingAttendeeListIndex]));
                  lastMsgReceivedFromSQS = Date.now();
                  meetingAttendeeListIndex += 1;
                  lock = false;
                }
              }
            }
          }
        } else {
          this.support.log('No Message received from SQS');
          if (Date.now() - lastMsgReceivedFromSQS > 60000) {
            meetingAttendeeArray = [];
            meetingAttendeeListIndex = 0;
            this.support.log('meetingAttendeeArray cleaned');
          }
        }
        console.log('----->>>>> ', meetingAttendeeArray.length)
      } catch (err) {
        this.support.error('Failed SQS retrieval ' + err);
      }
    }
    return meetingAttendeeArray;
  }

  createMeetingAttendeeObject(bodyJson) {
    if (bodyJson === null) {
      return null;
    }
    let meetingAttendeeObject = null;
    try {
      meetingAttendeeObject = {
        Meeting: {
          MeetingId: bodyJson.Meeting.JoinableMeeting.Id,
          MediaPlacement: {
            AudioHostUrl: bodyJson.Meeting.MediaPlacement.AudioDtlsUrl,
            SignalingUrl: `${bodyJson.Meeting.MediaPlacement.SignalingUrl}/control/${bodyJson.Meeting.JoinableMeeting.Id}`,
            TurnControlUrl: bodyJson.Meeting.MediaPlacement.TurnControlUrl,
            ScreenDataUrl: bodyJson.Meeting.MediaPlacement.ScreenBrowserUrl,
            ScreenViewingUrl: bodyJson.Meeting.MediaPlacement.ScreenBrowserUrl,
            ScreenSharingUrl: bodyJson.Meeting.MediaPlacement.ScreenBrowserUrl,
          }
        },
        Attendee: {
          AttendeeId: bodyJson.Meeting.CurrentAttendee.ProfileId,
          JoinToken: bodyJson.SessionToken,
        }
      };

    } catch(err) {
      console.log('Please check the meeting attendee object generated using the Passcode. Is the meeting active?\n');
      //process.exit(0);
    }
    return meetingAttendeeObject;
  }
}