# ChimeLoadTest

1. Please make sure to install the dependencies mentioned in the Dependencies.md file

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
  
Usage:

```
node ClientLauncher.js --meetingCount 50 --attendeesPerMeeting 10 --minDurationMin 20 --maxDurationMin 30
```

3. Scripts in the script directory can be used only in CORP network (local machine and cloud dev desktops)

Work Progress, Status & Logic:
https://quip-amazon.com/UfuYAaBo5gAp/Slack-Get-to-Green-Build-client-for-Chime-SDK-Meetings-Load-Test
