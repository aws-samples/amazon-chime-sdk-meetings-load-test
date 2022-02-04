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
sudo rpm -i https://s3.amazonaws.com/amazoncloudwatch-agent/centos/amd64/latest/amazon-cloudwatch-agent.rpm
sudo touch /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
sudo chmod 777 /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
echo '{"logs":{"metrics_collected":{"emf":{}}}}' > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

sudo systemctl start amazon-cloudwatch-agent.service
sudo systemctl status amazon-cloudwatch-agent.service
sudo systemctl enable amazon-cloudwatch-agent.service

aws s3 cp s3://amazonchimesdkmeetingsloadtest/AmazonChimeSDKMeetingsLoadTest.zip ./
unzip AmazonChimeSDKMeetingsLoadTest.zip

sudo chown -R $USER /home/
cd ~/$HOMEDIR/AmazonChimeSDKMeetingsLoadTest/
