const { expect, matchTemplate, MatchStyle } = require('@aws-cdk/assert');
const cdk = require('@aws-cdk/core');
const CclCdk = require('../lib/CCLStack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CclCdk.CclCdkStack(app, 'MyTestStack');
    // THEN
    expect(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
