import {createRequire} from "module";
const require = createRequire(import.meta.url);
const {v4: uuidv4} = require('uuid');
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

export default class SQSOperations {

  async getCreateMeetingWithAttendeesResponse() {
    const externalUserIdList = [];
    for (let iter = 0; iter < 10; iter += 1) {
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
    const createMeetingWithAttendeesResponse = await chime.createMeetingWithAttendees(JSON.parse(createMeetingWithAttendeesRequest)).promise();
    return createMeetingWithAttendeesResponse;
  }

  async putCreateMeetingWithAttendeesResponseToSQS() {
    const SQS_QUEUE_URL = await this.getSQSQueryURL('E2ELoadTestStack-ResponseQueue');
    console.log('putCreateMeetingWithAttendeesResponseToSQS ', SQS_QUEUE_URL);
    const createMeetingWithAttendeesResponse = await this.getCreateMeetingWithAttendeesResponse();
    var params = {
      MessageBody: JSON.stringify(createMeetingWithAttendeesResponse),
      QueueUrl: SQS_QUEUE_URL
    };
    sqs.sendMessage(params, (err, data) => {
      if (err) {
        console.log("Error", err);
      } else {
        console.log("Successfully added message ", data, data.MessageId);
      }
    });
  }

  async getSQSQueryURL(queueNamePrefix) {
    const params = {
      MaxResults: 1,
      QueueNamePrefix: queueNamePrefix
    };
    const listQueues = await sqs.listQueues(params).promise();
    if(listQueues && listQueues.QueueUrls)
      return listQueues.QueueUrls[0];
    return null;
  }

  async getCreateMeetingWithAttendeesBody() {
    const SQS_QUEUE_URL = await this.getSQSQueryURL('E2ELoadTestStack-ResponseQueue');
    console.log('getCreateMeetingWithAttendeesBody ', SQS_QUEUE_URL);
    const params = {
      QueueUrl: SQS_QUEUE_URL,
      MaxNumberOfMessages: 10
    };
    const CreateMeetingWithAttendeesBodyList = [];
    const CreateMeetingWithAttendeesBody = await sqs.receiveMessage(params).promise();
    return CreateMeetingWithAttendeesBody;
  }
}

async function purgeMessageQueue() {
  const SQS_QUEUE_URL = await this.getSQSQueryURL('E2ELoadTestStack-ResponseQueue');
  const request = sqs.purgeQueue({
    QueueUrl: SQS_QUEUE_URL
  });
  return request.promise().catch(e => console.log('purgeQueueError', {error: e}))
}