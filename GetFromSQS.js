import { createRequire } from "module";
const require = createRequire(import.meta.url);
const AWS = require('aws-sdk');
// Set the region we will be using
AWS.config.update({region: 'us-east-1'});// Create SQS service client
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

async function createMeetingWithAttendeesBodyFromSQSResponse() {
  // var joinInfo = await getCreateMeetingWithAttendeesBodyFromSQS()
  //   .then(function (result) {
  //     if (result) {
  //       console.log("---->", result) // "Some User token"
  //       console.log("----> 11111", result.Meeting)
  //       console.log("----> 22222", result.Attendees)
  //     }
  //   })

  var joinInfo = await getCreateMeetingWithAttendeesBodyFromSQS()
  if (joinInfo && joinInfo.Meeting)
    console.log("----> 11111", joinInfo.Meeting)
  if (joinInfo && joinInfo.Attendees)
    console.log("----> 22222", joinInfo.Attendees)
}

purgeMessageQueue()

createMeetingWithAttendeesBodyFromSQSResponse().then(function(r) {console.log("$$$$$", r)})

// async function getCreateMeetingWithAttendeesBodyFromSQS() {
//   const queueUrl = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
//   let CreateMeetingWithAttendeesBody = '';
//   a = 9;
//   const params = {
//     QueueUrl: queueUrl
//   };
//   var res = await sqs.receiveMessage(params).promise();
//   //console.log(res.Messages[0].Body);
//   if (res) {
//     a = 0;
//   }
//   return a;
// }
//
//

async function getCreateMeetingWithAttendeesBodyFromSQS() {
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
        console.log('Nothing to process');
        return;
      }
      CreateMeetingWithAttendeesBody = JSON.parse(data.Messages[0].Body);
      //console.log(CreateMeetingWithAttendeesBody);
      //console.log('**1111***> ', CreateMeetingWithAttendeesBody.CreateMeetingWithAttendees);
      // const deleteParams = {
      //   QueueUrl: queueUrl,
      //   ReceiptHandle: data.Messages[0].ReceiptHandle
      // };
      // sqs.deleteMessage(deleteParams, (err, data) => {
      //   if (err) {
      //     console.log(err, err.stack);
      //   } else {
      //     console.log('Successfully deleted message from queue');
      //   }
      // });
    }
  });
  return CreateMeetingWithAttendeesBody.CreateMeetingWithAttendees;
}


// async function getCreateMeetingWithAttendeesBodyFromSQS() {
//   const queueUrl = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
//   let CreateMeetingWithAttendeesBody = '';
//   const params = {
//     QueueUrl: queueUrl,
//     MaxNumberOfMessages: 1
//   };
//   var res = await sqs.receiveMessage(params).promise();
//   console.log(res)
//   if (res && res.Messages && res.Messages[0].Body)
//     console.log(res.Messages[0].Body)
//   //return res.Messages[0].Body.CreateMeetingWithAttendees;
// }



async function purgeMessageQueue () {
  const SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
  const request = sqs.purgeQueue({
    QueueUrl: SQS_QUEUE_URL
  })
  return request.promise().catch(e => console.log('purgeQueueError', { error: e }))
}



