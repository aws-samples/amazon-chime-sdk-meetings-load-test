// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');
// Set the region we will be using
AWS.config.update({region: 'us-east-1'});// Create SQS service client
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});


// // Setup the sendMessage parameter object
// var params = {
//   MessageBody: JSON.stringify({
//     order_id: 12344,
//    date: (new Date()).toISOString()
//   }),
//   MessageGroupId: '12344',
//   MessageDeduplicationId: '12344',
//   QueueUrl: queueUrl
// };
// sqs.sendMessage(params, (err, data) => {
//   if (err) {
//     console.log("Error", err);
//   } else {
//     console.log("Successfully added message", data.MessageId);
//   }
// });



// var x = getCreateMeetingWithAttendeesBodyFromSQS()
//   .then(function(result) {
//     console.log(result) // "Some User token"
//   })

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



var fs = require('fs');
const puppeteer = require('puppeteer');

const MIN_ACTIVE_TIME_MS = 10000;
const MAX_ACTIVE_TIME_MS = 15000;

function getRndDuration() {
  return Math.floor(Math.random() * (MAX_ACTIVE_TIME_MS - MIN_ACTIVE_TIME_MS + 1) ) + MIN_ACTIVE_TIME_MS;
}

run()
  .then(() => {
    console.log('Done');
  }).catch(error => {
    console.log(error);
  });

async function run() {

  var workerId = null;
  module.exports = function(options) {
    workerId = options.workerId;
  };
  const startTimeMs = Date.now();
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--hostname localhost',
      '--no-sandbox', '--disable-setuid-sandbox'
    ],
    //executablePath:'/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome'
  });

  var page = new Array();
  const randomDuration = new Array();
  var attendeesList = new Array();
  var meetingId = null;

  var createMeetingWithAttendeesBodyFromSQS = getCreateMeetingWithAttendeesBodyFromSQS();

  await createMeetingWithAttendeesBodyFromSQS.then(function(response) {
    //console.log(response);
    if(response) {
      meetingId = response.Meeting.MeetingId;
      attendeesList = response.Attendees;
    }
  });

  if(meetingId) {
    const noOfAttendee = attendeesList.length;

    for (var browserTab = 0; browserTab < noOfAttendee*10; browserTab++) {
      page[browserTab] = await browser.newPage();
      //await page[browserTab].goto('http://127.0.0.1:8080/?m='+meetingId);
      await page[browserTab].goto('https://ubb4hhqmc4.execute-api.us-east-1.amazonaws.com/Prod/v2/?m=' + meetingId);
      // await page[browserTab].goto('https://g4eowuwvpf.execute-api.us-east-1.amazonaws.com/Prod/v2/?m=dsdftyui546789');

      await page[browserTab].evaluate((attendee) => {
        // document.getElementById('inputMeeting').value = meetingId;
        document.getElementById('inputName').value = attendee.AttendeeId;
        document.getElementById('authenticate').click();
        //document.getElementById('joinButton').click();
        //setTimeout(function(){ window.location.replace("http://www.w3schools.com"); }, 3000);
      }, attendeesList[0]);
      randomDuration[browserTab] = getRndDuration();
      console.log('Worker#: '+ workerId + ' browserTab#: ' + browserTab + ' randomTime: ' + randomDuration[browserTab]);
      //await page[browserTab].evaluateOnNewDocument(fs.readFileSync('./helperFunctions.js', 'utf8'));
      //await page[browserTab].addScriptTag({path: './helperFunctions.js', arguments: '10000'});
      await page[browserTab].addScriptTag({content: 'setTimeout(function(){ document.getElementById(\'button-meeting-leave\').click(); }, ' + randomDuration[browserTab] + ');'});

      await new Promise(resolve => setTimeout(resolve, 500));
      //await page[browserTab].close();
    }
    //await new Promise(resolve => setTimeout(resolve, 3000));
    //page[browserTab-1].screenshot({path:meetingId+'.png'});

    const MAX_DURATION_FOR_ATTENDEE = Math.max(...randomDuration);
    const timeToWaitBeforeClosingTabs = MAX_DURATION_FOR_ATTENDEE
    //console.log('Waiting for ' + timeToWaitBeforeClosingTabs + 'ms before closing the tabs');

    var noOfBrowsersClosed = 0;
    setTimeout(async () => {
      console.log('Close tabs initiated')
      //close all tabs after the max duration passes
      for (var tabNo = 0; tabNo < noOfAttendee; tabNo++) {
        try {
          if (!page[tabNo].isClosed())
            await page[tabNo].close();
        } catch (e) {
          console.log(e);
        } finally {
          //await browser.close();
        }
      }
    }, timeToWaitBeforeClosingTabs);

    await new Promise(resolve => setTimeout(resolve, timeToWaitBeforeClosingTabs + 2000));
// console.log(await browser.pages().length);
//   if ((await browser.pages()).length === 1) {
    if (browser.isConnected()) {
      console.log('Close browser initiated')
      await browser.close();
    }
    const stopimeMs = Date.now();

    console.log('[Worker ' + workerId + '] Time taken from open to close of browser: ', stopimeMs-startTimeMs);
  }
  // }

}

async function getCreateMeetingWithAttendeesBodyFromSQS() {
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/272527145218/MeetingAttendee';
  let CreateMeetingWithAttendeesBody = '';
  const params = {
    QueueUrl: queueUrl
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
      // console.log('----> ', CreateMeetingWithAttendeesBody.CreateMeetingWithAttendees);
      // Lookup order data from data storage
      // Execute billing for order
      // Update data storage    // Now we must delete the message so we don't handle it again
      //   const deleteParams = {
      //     QueueUrl: queueUrl,
      //     ReceiptHandle: data.Messages[0].ReceiptHandle
      //   };
      //   sqs.deleteMessage(deleteParams, (err, data) => {
      //     if (err) {
      //       console.log(err, err.stack);
      //     } else {
      //       console.log('Successfully deleted message from queue');
      //     }
      //   });
    }
  }).promise();
  return CreateMeetingWithAttendeesBody.CreateMeetingWithAttendees;
}





/*
const puppeteer = require('puppeteer');

run().then(() => console.log('Done')).catch(error => console.log(error));

async function run() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('localhost:8080');

  // Type "JavaScript" into the search bar
  await page.evaluate(async () => {
    document.getElementById('inputMeeting').value = "NewMeetingValue76545678";
    document.getElementById('inputName').value = "NewAttendee";
    document.getElementById('authenticate').click();
    await new Promise(resolve => setTimeout(resolve, 5000));

    document.getElementById('joinButton').click();


    //if transition to next page successfull

    //if failed

  });



  await new Promise(resolve => setTimeout(resolve, 5000));
  //await browser.close();
}
*/
//
// var fs = require('fs');
// const puppeteer = require('puppeteer');
//
// run().then(() => console.log('Done')).catch(error => console.log(error));
//
// async function run() {
//   const browser = await puppeteer.launch({ headless: false });
//   var page = new Array();
//   for(var browserTab = 0; browserTab<3; browserTab++) {
//     page[browserTab] = await browser.newPage();
//     await page[browserTab].goto('https://google.com');
//
//     await page[browserTab].evaluate(() => {
//       document.querySelector('.gLFyf').value = "Amazon";
//       document.querySelector('.gNO89b').click();
//       //setTimeout(function(){ window.location.replace("http://www.w3schools.com"); }, 3000);
//     });
//
//     await page[browserTab].evaluateOnNewDocument(fs.readFileSync('./helperFunctions.js', 'utf8'));
//     //await page[browserTab].addScriptTag({path: './helperFunctions.js', type:'utf8'});
//   }
//   await new Promise(resolve => setTimeout(resolve, 15000));
//   //await browser.close();
// }
//











// const puppeteer = require('puppeteer');
//
// run().then(() => console.log('Done')).catch(error => console.log(error));
//
// async function run() {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();
//   await page.goto('https://google.com');
//
//   await page.evaluate(() => {
//     document.querySelector('.gLFyf').value = "Amazon"
//     document.querySelector('.gNO89b').click()
//   });
//
//   await new Promise(resolve => setTimeout(resolve, 5000));
//   await browser.close();
// }



/*

window.open("https://www.w3schools.com");
alert('Hi');


var opn = require('opn');// opens the url in the default browser
var tab1 = opn('http://sindresorhus.com');
var tab2 = opn('http://sindresorhus.com');

var newWindow = window.open('');

var url = 'http://google.com';
var start = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
p = require('child_process').exec(start + ' ' + url);
setTimeout(1000);
p.document.querySelector('.gLFyf').value = "Hi"
p.document.querySelector('.gNO89b').click()

require('child_process').exec('kill -9 ' + p.pid);
p.pid
process.kill(p.pid)

*/









// const meeting  = await chime.createMeeting({
//   // Use a UUID for the client request token to ensure that any request retries
//   // do not create multiple meetings.
//   ClientRequestToken: uuidv4(),
//   // Specify the media region (where the meeting is hosted).
//   // In this case, we use the region selected by the user.
//   MediaRegion: 'us-east-1',
//   // Any meeting ID you wish to associate with the meeting.
//   // For simplicity here, we use the meeting title.
//   ExternalMeetingId: "testExt id",
// }).promise();
//
// const attendee = await chime.createAttendee({
//   // The meeting ID of the created meeting to add the attendee to
//   MeetingId: meeting.Meeting.MeetingId,
//
//   // Any user ID you wish to associate with the attendeee.
//   // For simplicity here, we use a random id for uniqueness
//   // combined with the name the user provided, which can later
//   // be used to help build the roster.
//   ExternalUserId: "testExt id",
// }).promise();
