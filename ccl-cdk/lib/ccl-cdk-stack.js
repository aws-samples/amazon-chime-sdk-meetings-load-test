const cdk = require('@aws-cdk/core');
const iam = require('@aws-cdk/aws-iam');
const ec2 = require('@aws-cdk/aws-ec2');

class CclCdkStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const cclRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonChimeSDK'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationFullAccess'),
      ],
    });

    const defaultVpc = new ec2.Vpc(this, 'VPC');

    for (let count = 0; count < 2; count++) {
      new ec2.Instance(this, `ccl-instance-${count}`, {
        vpc: defaultVpc,
        role: cclRole,
        instanceName: `ccl-instance-${count}`,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.C5,
          ec2.InstanceSize.XLARGE12
        ),
        machineImage: ec2.MachineImage.lookup({
          name: 'ChimeSDKCaptionsLoadTest'
        })
      });
    }
  }
}

module.exports = { CclCdkStack };
