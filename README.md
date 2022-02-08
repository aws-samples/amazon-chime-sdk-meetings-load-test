### About
This tool simulates real attendees by launching Amazon Chime SDK for Javascript (Amazon Chime SDK for JS) clients and enabling them to join meetings and control the features of the meeting.
The tool can be helpful if you wish to:
 1. simulate attendees in a meeting
 2. test multiple scenarios to see how the app built on Amazon Chime SDK for JS behaves for larger loads
 

### Setting up the tool:

1. Download the package from this repository to your local machine
2. In the package, run `yarn install` to install all the necessary packages
3. Update the client url link with the builder created app link (in configs/Constants.js)
4. Update the constants with the names used in the builder created app. The ones that have been set now are with respect to the Amazon Chime for JS demo app.


### Running the Amazon Chime SDK Meetings load test tool launcher

Run the launcher using `node ClientLauncher.js` <optional parameters> in the src directory

Optional parameters:

||||
|--- |--- |--- |
|Parameter|Meaning|Default Value|
|threadsCount|Defines the number of threads to be spawned per Amazon EC2 instance for launching the clients. A number smaller than the instance core size will simulate scenarios of a machine running multiple applications in the background. Note: A higher number than the instance core size is not recommended in this scenario.|An integer, equal to the virtual CPU count of the EC2 instance.|
|attendeesPerMeeting|Defines the number of attendees to be spawned per Amazon EC2 instance running against a meeting name.|10|
|loadTestSessionName|Defines the meetingName when launching the clients. on the Session name assigned to the load test.|"MeetingLoadTest"|
|attendeeNamePrefix|Defines the fixed prefix name for all attendees in a meeting. Attendee names in the client appear with the prefix followed by a number.|"Attendee"|
|localMachine|Use this parameter if running the load test from the local machine.|false|

  
Usage:

```
node ClientLauncher.js --attendeesPerMeeting 10 
```


### Structure of the AmazonChimeSDKMeetingsLoadTest Package:

At the root level, the package consists of 4 different directory, the Client Launcher invoker file ClientLauncher.js and the Cleanup.js.

1. scripts/: The files in this directory are helper files which has to be executed from the local Mac/PC or dev desktop
2. src/: The directory consists of the Activity files that the ClientLauncher is dependent on
3. configs/ : Consists of account information and the LoadTest Status
4. CDK/ : This consists of the infra setup code, needed for running the load test which can be modified before each test based on the requirements of the number of EC2 instances needed to be deployed in an account.


### Running the LoadTestResult from the local machine:

Using the --localMachine as an optional parameter will let the user run the tool in the local machine.
Recommend not to run more than 10 attendees on the local Mac/Windows machines which has less than 10 cores. 