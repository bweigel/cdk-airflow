import cdk = require('@aws-cdk/core');
import { AirflowDockerBuild } from './airflow-docker';
import { AirflowFargateService } from './airflow-fargate-services';

export class CdkAirflowStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const build = new AirflowDockerBuild(this, "DockerBuild");
    new AirflowFargateService(this, "AirflowServer", { airflowBaseImage: build.imageRepo })


  }
}
