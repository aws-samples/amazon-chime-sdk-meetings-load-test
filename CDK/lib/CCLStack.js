import { Stack, Tags, RemovalPolicy } from '@aws-cdk/core';
import { Asset } from '@aws-cdk/aws-s3-assets';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement
} from '@aws-cdk/aws-iam';
import {
  AmazonLinuxGeneration,
  AmazonLinuxStorage,
  AmazonLinuxEdition,
  AmazonLinuxVirt,
  Instance,
  InstanceType,
  InstanceClass,
  InstanceSize,
  MachineImage,
  Peer,
  Port,
  SubnetType,
  SecurityGroup,
  Vpc
} from '@aws-cdk/aws-ec2';
import { Effect } from '@aws-cdk/aws-iam';
import { Bucket } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import { s3BucketName } from '../../configs/Constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const NO_OF_EC2_INSTANCES = 1;

export default class CCLStack extends Stack {
  /**
   *
   * @param {App} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // create a bucket for the launcher tool files and set the right policies
    const toolCodeBucket = new Bucket(this, 'LauncherToolCodeBucket', {
      publicReadAccess: false,
      bucketName: s3BucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
    const toolCodeBucketPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:PutObjectAcl'
      ],
      resources: [
        toolCodeBucket.bucketArn,
        `${toolCodeBucket.bucketArn}/*`
      ],
    });
    toolCodeBucketPolicy.addServicePrincipal('ec2.amazonaws.com');
    toolCodeBucket.addToResourcePolicy(toolCodeBucketPolicy);

    new BucketDeployment(this, 'LauncherToolCode', {
      sources: [Source.asset('./', { exclude: ['**', '!AmazonChimeSDKMeetingsLoadTest.zip'] } )],
      destinationBucket: toolCodeBucket,
    });

    const vpc = new Vpc(this, 'VPC', {
      natGateways: 0,
      subnetConfiguration: [{
        cidrMask: 24,
        name: 'VPC',
        subnetType: SubnetType.PUBLIC
      }]
    });

    const securityGroup = new SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Security Group for CCL EC2 instances',
      allowAllOutbound: true
    });

    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allow SSH access');

    const role = new Role(this, 'EC2Role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: {
        "ccl-ec2-roles": new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                "s3:PutObject",
                "s3:GetObject",
                "s3:List*",
                "ssm:*",
                "logs:CreateLogStream",
                "logs:DescribeLogStreams",
                "logs:PutLogEvents",
                "ec2:DescribeInstanceStatus",
                "ec2:DescribeInstances",
                "ec2:RunInstances",
                "ssm:SendCommand",
                "ssm:ListInstanceAssociations",
                "ssm:UpdateInstanceInformation",
                "ssmmessages:CreateControlChannel",
                "ssmmessages:CreateDataChannel",
                "ssmmessages:OpenControlChannel",
                "ssmmessages:OpenDataChannel",
                "ec2messages:AcknowledgeMessage",
                "ec2messages:DeleteMessage",
                "ec2messages:FailMessage",
                "ec2messages:GetEndpoint",
                "ec2messages:GetMessages",
                "ec2messages:SendReply",
                "ds:CreateComputer",
                "ds:DescribeDirectories",
                "ec2:DescribeInstanceStatus",
                "cloudwatch:PutMetricData",
              ],
              resources: [
                "*"
              ]
            })
          ]
        })
      }
    });

    const asset = new Asset(this, 'AssetConfig', { path: path.join(__dirname, '../src/config.sh') });

    for (let ec2Count = 0; ec2Count < NO_OF_EC2_INSTANCES; ec2Count++) {
      const instance = new Instance(this, `CCL-Instance-${ec2Count}`, {
        vpc,
        securityGroup,
        role,
        instanceName: `ccl-instance-${ec2Count}`,
        instanceType: InstanceType.of(
          InstanceClass.C5,
          InstanceSize.XLARGE24
        ),
        machineImage: MachineImage.latestAmazonLinux({
          generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
          edition: AmazonLinuxEdition.STANDARD,
          virtualization: AmazonLinuxVirt.HVM,
          storage: AmazonLinuxStorage.GENERAL_PURPOSE,
        })
      });

      Tags.of(instance).add('InstanceNumber', ec2Count.toString());

      const localPath = instance.userData.addS3DownloadCommand({
        bucket: asset.bucket,
        bucketKey: asset.s3ObjectKey,
      });

      instance.userData.addExecuteFileCommand({
        filePath: localPath,
        arguments: '--verbose -y'
      });

      asset.grantRead(instance.role);
    }
  }
}