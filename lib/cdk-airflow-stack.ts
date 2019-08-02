import cdk = require('@aws-cdk/core');
import { AirflowDockerBuild } from './airflow-docker';

export class CdkAirflowStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new AirflowDockerBuild(this, "DockerBuild");

  }
}
