import ecspatterns = require('@aws-cdk/aws-ecs-patterns');
import ecr = require('@aws-cdk/aws-ecr');
import cdk = require('@aws-cdk/core');
import { ContainerImage, Cluster } from '@aws-cdk/aws-ecs';
import { Vpc } from '@aws-cdk/aws-ec2';
import { Duration } from '@aws-cdk/core';

export interface AirflowFargateServiceProps {
    airflowBaseImage: ecr.Repository
}

export class AirflowFargateService extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: AirflowFargateServiceProps) {
        super(scope, id);

        const airflowImageRepo = props.airflowBaseImage

        const vpc = new Vpc(this, "Vpc", { maxAzs: 2, natGateways: 1 })

        const airflowWebserver = new ecspatterns.LoadBalancedFargateService(this, "AirFlowWebserver", {
            containerPort: 8080,
            vpc: vpc,
            image: ContainerImage.fromEcrRepository(airflowImageRepo),
            publicLoadBalancer: false
        })

        airflowWebserver.targetGroup.configureHealthCheck({ healthyHttpCodes: "200,302", interval: Duration.seconds(120), unhealthyThresholdCount: 5 })
    }
}
