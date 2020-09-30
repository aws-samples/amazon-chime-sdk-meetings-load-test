import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {v4: uuidv4} = require('uuid');
const AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json')
AWS.config.update({region: 'us-east-1'});// Create SQS service client
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
const chime = new AWS.Chime({region: 'us-east-1'});
chime.endpoint = new AWS.Endpoint('https://service.chime.aws.amazon.com');

export default class SQSOperations {

  async getCreateMeetingWithAttendeesResponse() {
    const externalUserIdList = [];
    for (let iter = 0; iter < 10; iter +=1){
      externalUserIdList.push({
        'ExternalUserId': `${uuidv4()}`
      });
    }
    const createMeetingWithAttendeesRequest = `
    {
       "Attendees": ${JSON.stringify(externalUserIdList)},
       "ClientRequestToken": "${uuidv4()}",
       "ExternalMeetingId": "${uuidv4()}",
       "MediaRegion": "us-east-1",
       "MeetingHostId": "string",
       "Tags": [
          {
             "Key": "string",
             "Value": "string"
          }
       ]
    }`;
    //console.log('createMeetingWithAttendeesRequest ', externalUserIdList);
    const createMeetingWithAttendeesResponse = await chime.createMeetingWithAttendees(JSON.parse(createMeetingWithAttendeesRequest)).promise();
    return createMeetingWithAttendeesResponse;
  }


  async putCreateMeetingWithAttendeesResponseToSQS() {
    //const createMeetingWithAttendeesResponse = {CreateMeetingWithAttendees: await this.getCreateMeetingWithAttendeesResponse()};
    const createMeetingWithAttendeesResponse = await this.getCreateMeetingWithAttendeesResponse();
    //const queueUrl = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/770548120233/E2ELoadTestStack-ResponseQueue4DA9FAE7-H6MUZR20ZQIL';

    //console.log(createMeetingWithAttendeesResponse);
    var params = {
      MessageBody: JSON.stringify(createMeetingWithAttendeesResponse),
      QueueUrl: queueUrl
    };
    //await new Promise(resolve => setTimeout(resolve, 5000));

    sqs.sendMessage(params, (err, data) => {
      if (err) {
        console.log("Error", err);
      } else {
        console.log("Successfully added message ", data, data.MessageId);
      }
    });
  }


   async getCreateMeetingWithAttendeesBodyFromSQS() {
    //const queueUrl = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/770548120233/E2ELoadTestStack-ResponseQueue4DA9FAE7-H6MUZR20ZQIL';


    const params = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10
    };
    const CreateMeetingWithAttendeesBodyList = [];
    const CreateMeetingWithAttendeesBody = await sqs.receiveMessage(params).promise();
    // var res = await sqs.receiveMessage(params,  (err, data) => {
    //   if (err) {
    //     console.log(err, err.stack);
    //   } else {
    //
    //     //console.log(data);
    //     if (!data.Messages) {
    //       console.log(data);
    //       console.log('Nothing to process 111');
    //       return;
    //     }
    //     CreateMeetingWithAttendeesBody = data;
    //     //CreateMeetingWithAttendeesBody = JSON.parse(data.Messages[0].Body);
    //     //console.log(CreateMeetingWithAttendeesBody);
    //     //console.log('*****> ', CreateMeetingWithAttendeesBody.CreateMeetingWithAttendees);
    //     CreateMeetingWithAttendeesBodyList.push(CreateMeetingWithAttendeesBody);
    //     const deleteParams = {
    //       QueueUrl: queueUrl,
    //       ReceiptHandle: data.Messages[0].ReceiptHandle
    //     };
    //     sqs.deleteMessage(deleteParams, (err, data) => {
    //       if (err) {
    //         console.log(err, err.stack);
    //       } else {
    //         console.log('Successfully deleted message from queue');
    //       }
    //     });
    //   }
    // });
     //console.log(CreateMeetingWithAttendeesBody);

    return CreateMeetingWithAttendeesBody;
  }
}

// for (let i = 0; i < 70; i++) {
//     if (i === 0) {
//        purgeMessageQueue()
//     }
//     const sqsOperations = new SQSOperations();
//     for (let j = 0; j < 30000; j++) {}
//     sqsOperations.putCreateMeetingWithAttendeesResponseToSQS();
// }



async function purgeMessageQueue () {
  //const SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
  const SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/770548120233/E2ELoadTestStack-ResponseQueue4DA9FAE7-H6MUZR20ZQIL';

  const request = sqs.purgeQueue({
    QueueUrl: SQS_QUEUE_URL
  })
  return request.promise().catch(e => console.log('purgeQueueError', { error: e }))
}

const sqs1 = new SQSOperations();
const meetingAttendeeInfo = sqs1.getCreateMeetingWithAttendeesBodyFromSQS();
