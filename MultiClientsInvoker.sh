#!/bin/bash
echo 'Using Meeting PinId/Passcode:' $1
node ClientLauncher.js --sessionPasscode $1 --attendeesPerMeeting 5 --maxDurationMin 20 --minDurationMin 19 --activeVideosPerMeeting 5
sleep 21m
ps aux | grep puppeteer | grep -v grep | awk '{print $2}' | xargs kill -9
