import { Stack, Tags } from '@aws-cdk/core';
import { Asset } from '@aws-cdk/aws-s3-assets';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  Role,
  ServicePrincipal,
  ManagedPolicy
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const NO_OF_EC2_INSTANCES = 3;

export default class CCLStack extends Stack {
  /**
   *
   * @param {App} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

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

    // TODO: reduce policy to specifically what is needed instead of the Full Access
    // https://sim.amazon.com/issues/P54087257
    const role = new Role(this, 'EC2Role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonChimeSDK'),
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    const asset = new Asset(this, 'AssetConfig', { path: path.join(__dirname, '../src/config.sh') });

    // TODO: have the number of EC2 instances configurable
    // https://sim.amazon.com/issues/P54087328
    for (let ec2Count = 0; ec2Count < NO_OF_EC2_INSTANCES; ec2Count++) {
      const instance = new Instance(this, `CCL-Instance-${ec2Count}`, {
        vpc,
        keyName: 'C5XLLT1',
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

      Tags.of(instance).add('InstanceNumber', ec2Count);

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