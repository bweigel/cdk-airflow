import cdk = require('@aws-cdk/core');
import { AirflowDockerBuild } from './airflow-docker';
import { AirflowFargateService } from './airflow-fargate-services';
import { AirflowVpc } from './airflow-vpc';
import { AirflowDatabases } from './airflow-databases';
import { SecurityGroup, Port, Protocol } from '@aws-cdk/aws-ec2';

export class CdkAirflowStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const build = new AirflowDockerBuild(this, "DockerBuild");
    const vpc = new AirflowVpc(this, "Vpc");
    const db = new AirflowDatabases(this, "Db", { vpc: vpc.vpc })

    const dbSg = SecurityGroup.fromSecurityGroupId(this, "DbSg", db.dbcluster.securityGroupId);

    const webserver = new AirflowFargateService(this, "AirflowServer", {
      airflowBaseImage: build.imageRepo,
      vpc: vpc.vpc,
      db: {
        cluster: db.dbcluster,
        username: db.username
      }
    });

    webserver.securityGroups.forEach((sg, i) => {
      dbSg.addIngressRule(sg, Port.tcp(db.dbcluster.clusterEndpoint.port))
    });


  }
}
