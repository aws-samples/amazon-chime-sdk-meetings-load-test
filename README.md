# ChimeSDKMeetingsLoadTest

1. Please make sure to install the dependencies mentioned in the Dependencies section.

2. Run the launcher using `node ClientLauncher.js` <optional parameters>

Optional parameters:

- meetingCount
  - number of meetings to be handled by launcher [default = constant * core size]
- noOfThreads
  - number of threads to be spawned [default = core size]
- attendeesPerMeeting
  - number of attendees each meeting will have [default = 10]
- activeVideosPerMeeting
  - number of attendees that will turn on the video after joining the meeting [default = 0]
- minDurationMin
  - minimum duration a meeting will be active [default = 20 mins]
- maxDurationMin
  - maximum duration a meeting will be active [default = 20.5 mins]
- metricGrabFrequencyMin
  - frequency at which the the metrics should be fetched from the browser running the localhost client [default = 0.016 min = 1 sec]
- putMetricDataNamespace
  - name of the namespace to view the metrics
- loadTestSessionName
  - session name assigned to the load test
- sessionPasscode
  - passcode used to set up the anonymous users
- generateMultipleAttendeesForAMeeting
  - generate batch attendees for a new or an existing meeting
- useExistingMeeting
  - use this parameter with generateMultipleAttendeesForAMeeting to use existing meeting

Usage:

```
node ClientLauncher.js --meetingCount 50 --attendeesPerMeeting 10 --minDurationMin 20 --maxDurationMin 30
```

NOTE: Scripts in the script directory can be used only in CORP network (local machine and cloud dev desktops)

Quick Links:
+ Design Doc: https://quip-amazon.com/v3PQA8iaSJPO/Chime-SDK-Meetings-Load-Test-Client-Launcher
+ Launcher: https://code.amazon.com/packages/ChimeSDKMeetingsLoadTest/
+ Client: https://code.amazon.com/packages/ChimeSDKMeetingsLoadTestClient/
+ Runbook: https://quip-amazon.com/MoB8AHIAgOl6/Load-Test-Wiki-Documentation

##Dependencies:
Dependencies needed to Run the launcher on EC2 instances are listed below. While running `npm install` will automatically install the dependencies mentioned in the package.json file, the following list can be handy.

Install the following dependencies in the local machine or the EC2 instances where you intend to run the Load Test package:

* Node js
* Puppeteer [npm i puppeteer]
* UUID [npm i uuid]
* AWS SDK [npm install aws-sdk]
* Minimist [npm i minimist]
* ShellJs [npm i shelljs]
* AWS Embedded Metrics [npm i aws-embedded-metrics]



##Structure of the ChimeSDKMeetingsLoadTest Package:

At the root level, the package consists of 4 different directory, the Client Launcher invoker file ClientLauncher.js and the Cleanup.js.

1. scripts/: The files in this directory are helper files which has to be executed from the local Mac/PC or dev desktop
2. src/: The directory consists of the Activity files that the ClientLauncher is dependent on
3. configs/ : Consists of account information and the LoadTest Status
4. cloudformation/ : This consists of the CFN template which can be modified before each test based on the requirements of the number of EC2 instances needed to be deployed in each account.

##Abort Procedure:

At any point if an active load test has to be aborted/terminated, run the ‘LoadTestImmediateAbort.js’ script in the scripts directory using the command:

`cd scripts && node LoadTestImmediateAbort.js`

Note that the LoadTestImmediateAbort script works only with the [client associated to the load test package](https://code.amazon.com/packages/ChimeSDKMeetingsLoadTestClient/).

##Running the LoadTestResult from the local machine:

As the process of running the load test, it is recommended to make a note of the LoadTestSessionID and the time at which the load test was run.
Using the LoadTestSessionID and the corresponding time, the LoadTestResult can be determined - if the LoadTest was successful or not based on the success criteria mentioned above.

To determine if a LoadTest success or fail, run the LoadTestResult.js with the following non optional parameters:

* *logGroupName* - string, log group where the put metric data puts into the cloudwatch logs
* *sessionId* - string, it refers to the LoadTestSessionID
* *startTime* - number, epoch LoadTest start timestamp in milliseconds
* *endTime* - number, epoch LoadTest end timestamp in milliseconds

node LoadTestResult.js --logGroupName Unknown-metrics --sessionId LoadTest-78958 --startTime 1608012253000 —endTime 1608062653000

