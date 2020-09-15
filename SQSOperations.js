import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {v4: uuidv4} = require('uuid');
const AWS = require('aws-sdk');
// Set the region we will be using
AWS.config.update({region: 'us-east-1'});// Create SQS service client
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
const chime = new AWS.Chime({region: 'us-east-1'});
chime.endpoint = new AWS.Endpoint(process.env.ENDPOINT || 'https://service.chime.aws.amazon.com');

export default class SQSOperations {

  async getCreateMeetingWithAttendeesResponse() {
    const createMeetingWithAttendeesRequest = `
    {
       "Attendees": [ 
          { 
             "ExternalUserId": "${uuidv4().substring(0, 8)}"
          },
          { 
             "ExternalUserId": "${uuidv4().substring(0, 8)}"
          },
          { 
             "ExternalUserId": "${uuidv4().substring(0, 8)}"
          },
          { 
             "ExternalUserId": "${uuidv4().substring(0, 8)}"
          },
          { 
             "ExternalUserId": "${uuidv4().substring(0, 8)}"
          }
       ],
       "ClientRequestToken": "${uuidv4()}",
       "ExternalMeetingId": "${uuidv4().substring(0, 8)}",
       "MediaRegion": "us-east-1",
       "MeetingHostId": "string",
       "Tags": [ 
          { 
             "Key": "string",
             "Value": "string"
          }
       ]
    }`;
    const createMeetingWithAttendeesResponse = await chime.createMeetingWithAttendees(JSON.parse(createMeetingWithAttendeesRequest)).promise();
    return createMeetingWithAttendeesResponse;
  }


  async putCreateMeetingWithAttendeesResponseToSQS() {
    const createMeetingWithAttendeesResponse = {CreateMeetingWithAttendees: await this.getCreateMeetingWithAttendeesResponse()};
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
    console.log(createMeetingWithAttendeesResponse);
    var params = {
      MessageBody: JSON.stringify(createMeetingWithAttendeesResponse),
      QueueUrl: queueUrl
    };

    sqs.sendMessage(params, (err, data) => {
      if (err) {
        console.log("Error", err);
      } else {
        //console.log("Successfully added message ", data, data.MessageId);
      }
    });
  }


   async getCreateMeetingWithAttendeesBodyFromSQS() {
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
    let CreateMeetingWithAttendeesBody = '';
    const params = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1
    };
    var res = await sqs.receiveMessage(params,  (err, data) => {
      if (err) {
        console.log(err, err.stack);
      } else {
        //console.log(data.Messages[0].Body);
        if (!data.Messages) {
          console.log('Nothing to process 111');
          return;
        }
        CreateMeetingWithAttendeesBody = JSON.parse(data.Messages[0].Body);
        //console.log(CreateMeetingWithAttendeesBody);
        //console.log('*****> ', CreateMeetingWithAttendeesBody.CreateMeetingWithAttendees);
        const deleteParams = {
          QueueUrl: queueUrl,
          ReceiptHandle: data.Messages[0].ReceiptHandle
        };
        sqs.deleteMessage(deleteParams, (err, data) => {
          if (err) {
            console.log(err, err.stack);
          } else {
            console.log('Successfully deleted message from queue');
          }
        });
      }
    }).promise();
    return CreateMeetingWithAttendeesBody.CreateMeetingWithAttendees;
  }
}

// for(let i = 0; i< 10; i ++) {
//   if (i === 0){
//     purgeMessageQueue()
//   }
//   const SQSOperations1 = new SQSOperations();
//   SQSOperations1.putCreateMeetingWithAttendeesResponseToSQS();
// }


async function purgeMessageQueue () {
  const SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
  const request = sqs.purgeQueue({
    QueueUrl: SQS_QUEUE_URL
  })
  return request.promise().catch(e => console.log('purgeQueueError', { error: e }))
}