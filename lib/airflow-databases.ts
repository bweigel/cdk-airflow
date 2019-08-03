import cdk = require('@aws-cdk/core');
import ssm = require('@aws-cdk/aws-ssm');
import rds = require('@aws-cdk/aws-rds');

import { IVpc, InstanceType, InstanceSize, InstanceClass } from '@aws-cdk/aws-ec2';
import { DatabaseClusterEngine, DatabaseCluster, ParameterGroup } from '@aws-cdk/aws-rds';
import { RemovalPolicy } from '@aws-cdk/core';

export interface AirflowDatabasesProps {
    vpc: IVpc
}

export class AirflowDatabases extends cdk.Construct {
    public readonly dbcluster: DatabaseCluster
    public readonly username: string = "airflow"

    constructor(scope: cdk.Construct, id: string, props: AirflowDatabasesProps) {
        super(scope, id);
        const vpc = props.vpc;

        this.dbcluster = new rds.DatabaseCluster(this, "PostgresCluster", {
            engine: DatabaseClusterEngine.AURORA_POSTGRESQL,
            instances: 1,
            removalPolicy: RemovalPolicy.DESTROY,
            instanceProps: {
                vpc,
                instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
            },
            storageEncrypted: true,
            masterUser: {
                username: this.username
            },
            parameterGroup: {
                parameterGroupName: "default.aurora-postgresql10"
            } as any
        });

    }
}
