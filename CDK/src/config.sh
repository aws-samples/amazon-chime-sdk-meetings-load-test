#!/bin/bash -xe
## Copyright Amazon.com Inc. or its affiliates.
export HOMEDIR=/home/ec2-user

curl -sL https://rpm.nodesource.com/setup_14.x | sudo bash -
sudo yum install -y nodejs
sudo yum install -y git
npm i puppeteer
npm i uuid
npm install aws-sdk
npm i minimist
npm i shelljs
npm i aws-embedded-metrics

sudo amazon-linux-extras install epel -y
sudo yum install -y chromium
sudo yum update -y
sudo yum upgrade -y

cd $HOMEDIR
sudo rm -r -f ChimeSDKMeetingsLoadTest/
mkdir ChimeSDKMeetingsLoadTest
sudo chmod 777 ChimeSDKMeetingsLoadTest
aws s3 cp s3://chimesdkmeetingsloadtest/ ./ --recursive
sudo chown -R $USER /home/
cd ~/$HOMEDIR/ChimeSDKMeetingsLoadTest/
