export default class MeetingActivity {
  constructor(support, noOfMeetings, noOfAttendeesPerMeeting, sqs) {
    this.support = support;
    this.NO_OF_MEETINGS = noOfMeetings;
    this.NO_ATTENDEES_PER_MEETING = noOfAttendeesPerMeeting;
    this.sqs = sqs;
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

  async createMeetingAttendeeList(createMeetingWithAttendeesResponses) {
    let meetingAttendeeArray = new Array();
    let meetingAttendeeListIndex = 0;
    let lastMsgReceivedFromSQS = Date.now();
    while (meetingAttendeeArray.length < this.NO_OF_MEETINGS * this.NO_ATTENDEES_PER_MEETING) {
      try {
        const createMeetingWithAttendeesResponses = await this.sqs.getCreateMeetingWithAttendeesBody();
        if (createMeetingWithAttendeesResponses && createMeetingWithAttendeesResponses.Messages) {
          for (let response = 0; response < Math.min(this.NO_OF_MEETINGS, createMeetingWithAttendeesResponses.Messages.length); response += 1) {
            const meetingAttendeeInfo = JSON.parse(createMeetingWithAttendeesResponses.Messages[response].Body);
            if (meetingAttendeeInfo &&
              meetingAttendeeInfo.Meeting &&
              meetingAttendeeInfo.Attendees) {
              const meetingInfo = meetingAttendeeInfo.Meeting;
              const attendeeInfo = meetingAttendeeInfo.Attendees;
              let lock = false;
              for (let attendee = 0; attendee < attendeeInfo.length; attendee += 1) {
                if (lock === false && meetingAttendeeListIndex < this.NO_OF_MEETINGS * this.NO_ATTENDEES_PER_MEETING) {
                  lock = true;
                  meetingAttendeeArray[meetingAttendeeListIndex] = {
                    Meeting: meetingInfo,
                    Attendees: attendeeInfo[attendee],
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
}