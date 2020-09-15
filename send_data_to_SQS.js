// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');
// Set the region we will be using
AWS.config.update({region: 'us-east-1'});// Create SQS service client
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});



async function getCreateMeetingWithAttendeesBodyFromSQS() {
// Setup the sendMessage parameter object
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
  var params = {
    MessageBody:
`
      {
        "CreateMeetingWithAttendees": {
          "Attendees": [
            {
              "AttendeeId": "string",
              "ExternalUserId": "string",
              "JoinToken": "string"
            }
          ],
          "Errors": [
            {
              "ErrorCode": "string",
              "ErrorMessage": "string",
              "ExternalUserId": "string"
            }
          ],
          "Meeting": {
            "ExternalMeetingId": "string",
            "MediaPlacement": {
              "AudioFallbackUrl": "string",
              "AudioHostUrl": "string",
              "ScreenDataUrl": "string",
              "ScreenSharingUrl": "string",
              "ScreenViewingUrl": "string",
              "SignalingUrl": "string",
              "TurnControlUrl": "string"
            },
            "MediaRegion": "string",
            "MeetingId": "string"
          }
        }
      }
`
    ,
    QueueUrl: queueUrl
  };
  sqs.sendMessage(params, (err, data) => {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Successfully added message", data.MessageId);
    }
  });
}

for (var i = 0; i < 600; i++)
{
  getCreateMeetingWithAttendeesBodyFromSQS();

}