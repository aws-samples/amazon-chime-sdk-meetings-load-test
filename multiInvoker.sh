#!/bin/bash
#echo "Bash version ${BASH_VERSION}..."
#for i in {0..10}
#do
#  echo "Number: $i"
node ClientLauncher.js --sessionPasscode 7296273153 --attendeesPerMeeting 1 --maxDurationMin 0.10 --minDurationMin 0.05
sleep 20s
ps aux | grep puppeteer | grep -v grep | awk '{print $2}' | xargs kill -9
#done