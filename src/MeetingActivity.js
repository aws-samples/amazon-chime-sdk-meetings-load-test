import {createRequire} from 'module';
import SQSOperations from './SQSOperations.js';

const require = createRequire(import.meta.url);
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';

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

  async createAMeetingMultipleAttendeesList(getExistingMeetingObject) {
    const chime = new AWS.Chime({ region: 'us-east-1' });
    // Set the AWS SDK Chime endpoint to prod as per requirement: https://service.chime.aws.amazon.com.
    chime.endpoint = new AWS.Endpoint('https://tapioca.us-east-1.amazonaws.com');
    let meeting;
    if (getExistingMeetingObject === false) {
      meeting = await chime.createMeeting({
        ClientRequestToken: uuidv4(),
        MediaRegion: AWS.config.region,
        ExternalMeetingId: uuidv4().substring(0, 64),
      }).promise();
    } else {
      meeting = this.getExistingMeetingObject();
    }
    const meetingId = meeting.Meeting.MeetingId;
    console.log(meeting);
    const attendeesBatch = [];
    for (let attendee = 0; attendee < this.attendeesPerMeeting; attendee += 1) {
      attendeesBatch.push({ExternalUserId: uuidv4().substring(0, 64)})
    }
    const batchCreateAttendee = await chime.batchCreateAttendee({
      MeetingId: meetingId,
      Attendees: attendeesBatch
    }).promise();

    return await this.createMeetingAttendeeList(meeting, batchCreateAttendee);
  }

  async createMeetingAttendeeList(meeting, attendees) {
    console.log(meeting);
    const attendeesList = attendees?.Attendees;
    const meetingAttendeeArray = [];
    let meetingAttendeeListIndex = 0;
    let activeVideosPerMeeting = Math.min(this.activeVideosPerMeeting, this.attendeesPerMeeting);
    for (let attendeeIndex = 0; attendeeIndex < attendeesList?.length; attendeeIndex += 1) {
      attendeesList[attendeeIndex].VideoEnable = activeVideosPerMeeting > 0;
      activeVideosPerMeeting -= 1;
      meetingAttendeeArray[meetingAttendeeListIndex] = {
        Meeting: meeting.Meeting,
        Attendees: attendeesList[attendeeIndex],
      };
      meetingAttendeeListIndex += 1;
    }
    console.log(meetingAttendeeArray);
    return meetingAttendeeArray;
  }


  async createMeetingAttendeeListFromPasscode(passcode, noOfAttendees) {
    if (!passcode) {
      throw new Error('Need parameters: Passcode');
    }
    return await this.getMeetingAttendeeListFromExpress(passcode, noOfAttendees);
  }

  async createMeetingAttendeeListFromSQS(sqsName) {
    const sqs = new SQSOperations();
    await sqs.init(sqsName);
    let meetingAttendeeArray = [];
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
      } catch (err) {
        this.support.error('Failed SQS retrieval ' + err);
      }
    }
    return meetingAttendeeArray;
  }

  createMeetingAttendeeObjectFromExpressResponse(bodyJson) {
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

  async getMeetingAttendeeListFromExpress(passcode) {
    const meetingAttendeeArray = [];
    let activeVideosPerMeeting = Math.min(this.activeVideosPerMeeting, this.attendeesPerMeeting);
    let meetingAttendeeListIndex = 0;
    for (let attendees = 0; attendees < this.attendeesPerMeeting; attendees += 1) {
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
        const meetingAttendeeObject = this.createMeetingAttendeeObjectFromExpressResponse(bodyJson);
        if (meetingAttendeeObject) {
          meetingAttendeeObject.Attendee.VideoEnable = activeVideosPerMeeting > 0;
          activeVideosPerMeeting -= 1;
          meetingAttendeeArray[meetingAttendeeListIndex] = {
            Meeting: meetingAttendeeObject.Meeting,
            Attendees: meetingAttendeeObject.Attendee,
          };
          meetingAttendeeListIndex += 1;
        } else {
          console.log('meetingAttendeeObject could not be created, exiting... ');
          process.exit(1);
        }
      } catch (err) {
        console.error('Error while Fetching ', err)
      }
    }
    return meetingAttendeeArray;
  }

  getExistingMeetingObject() {
    //replace this with desired Meeting Object
    return {
      Meeting: {
        MeetingId: 'f9fa971f-804a-410f-91c8-4289aabc1829',
        ExternalMeetingId: '2313e32b-30d7-4d1c-9d96-ca0f6528321a',
        MediaPlacement: {
          AudioHostUrl: '673f9cc15501e2fc50771d1848492c8f.k.m2.ue1.g.app.chime.aws:4172',
          AudioFallbackUrl: 'wss://haxrp.m2.ue1.g.app.chime.aws:443/calls/f9fa971f-804a-410f-91c8-4289aabc1829',
          ScreenDataUrl: 'wss://bitpw.m2.ue1.g.app.chime.aws:443/v2/screen/f9fa971f-804a-410f-91c8-4289aabc1829',
          ScreenSharingUrl: 'wss://bitpw.m2.ue1.g.app.chime.aws:443/v2/screen/f9fa971f-804a-410f-91c8-4289aabc1829',
          ScreenViewingUrl: 'wss://bitpw.m2.ue1.g.app.chime.aws:443/ws/connect?passcode=null&viewer_uuid=null&X-BitHub-Call-Id=f9fa971f-804a-410f-91c8-4289aabc1829',
          SignalingUrl: 'wss://signal.m2.ue1.g.app.chime.aws/control/f9fa971f-804a-410f-91c8-4289aabc1829',
          TurnControlUrl: 'https://ccp.cp.ue1.g.app.chime.aws/v2/turn_sessions'
        },
        MediaRegion: 'us-east-1'
      }
    };
  }
}