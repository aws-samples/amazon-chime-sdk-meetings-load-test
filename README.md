### About
This tool simulates real attendees by launching Amazon Chime SDK for Javascript (Amazon Chime SDK for JS) clients and enabling them to join meetings and control the features of the meeting.
The tool can be helpful if you wish to:
 1. simulate attendees in a meeting
 2. test multiple scenarios to see how the app built on Amazon Chime SDK for JS behaves for larger loads
 

### Setting up the tool:

1. Download the package from this repository to your local machine
2. In the package, run `npm install` to install all the necessary packages
3. Update the client url link with the builder created app link (in configs/Constants.js)
4. Update the constants with the names used in the builder created app. The ones that have been set now are with respect to the Amazon Chime for JS demo app.



### ChimeSDKMeetingsLoadTest

Run the launcher using `node ClientLauncher.js` <optional parameters> in the src directory

Optional parameters:

- meetingCount
  - number of meetings to be handled by launcher [default = constant * core size]
- threadsCount
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

Usage:

```
node ClientLauncher.js --meetingCount 50 --attendeesPerMeeting 10 --minDurationMin 20 --maxDurationMin 30
```


### Structure of the ChimeSDKMeetingsLoadTest Package:

At the root level, the package consists of 4 different directory, the Client Launcher invoker file ClientLauncher.js and the Cleanup.js.

1. scripts/: The files in this directory are helper files which has to be executed from the local Mac/PC or dev desktop
2. src/: The directory consists of the Activity files that the ClientLauncher is dependent on
3. configs/ : Consists of account information and the LoadTest Status
4. CDK/ : This consists of the infra setup code, needed for running the load test which can be modified before each test based on the requirements of the number of EC2 instances needed to be deployed in an account.

### Running the LoadTestResult from the local machine:

Using the --localMachine as an optional parameter will let the user run the tool in the local machine.
Recommend not to run more than 10 attendees on the local Mac/Windows machines which has less than 10 cores. 