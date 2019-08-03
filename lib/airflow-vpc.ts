import ecspatterns = require('@aws-cdk/aws-ecs-patterns');
import cdk = require('@aws-cdk/core');
import { Vpc, IVpc } from '@aws-cdk/aws-ec2';

export class AirflowVpc extends cdk.Construct {
    public readonly vpc: IVpc

    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);
        this.vpc = new Vpc(this, "Vpc", { maxAzs: 2, natGateways: 1 });
    }
}
