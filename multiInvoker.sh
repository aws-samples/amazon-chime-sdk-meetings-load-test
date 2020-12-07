#!/bin/bash
echo "Bash version ${BASH_VERSION}..."
for i in {0..3}
do
  echo "Number: $i"
  node ClientLauncher.js --sessionPasscode 7296273153 --attendeesPerMeeting 2
  sleep 60s
  ps aux | grep puppeteer | grep -v grep | awk '{print $2}' | xargs kill -9
done
