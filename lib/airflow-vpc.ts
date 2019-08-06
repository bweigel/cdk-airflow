import cdk = require('@aws-cdk/core');
import { Vpc, IVpc } from '@aws-cdk/aws-ec2';

/**
 * This stack relies on getting the domain name from CDK context.
 * Use 'cdk synth -c domain=mystaticsite.com -c subdomain=www'
 * Or add the following to cdk.json:
 * {
 *   "context": {
 *     "domain": "mystaticsite.com",
 *     "subdomain": "www"
 *   }
 * }
**/

export class AirflowVpc extends cdk.Construct {
    public readonly vpc: IVpc

    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);

        const importedVpcId = this.node.tryGetContext('vpcid')
        const importedAzs = (this.node.tryGetContext('azs') as string) ? (this.node.tryGetContext('azs') as string).split(',') : undefined
        const importedPrivateSubnets = (this.node.tryGetContext('privatesubnetids') as string) ? (this.node.tryGetContext('privatesubnetids') as string).split(',') : undefined

        if (importedAzs && importedVpcId) {
            this.vpc = Vpc.fromVpcAttributes(this, "Vpc", {
                vpcId: importedVpcId,
                availabilityZones: importedAzs,
                privateSubnetIds: importedPrivateSubnets
            })
        } else {
            this.vpc = new Vpc(this, "Vpc", { maxAzs: 2, natGateways: 1 });
        }
    }
}
