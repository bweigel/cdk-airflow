import cdk = require('@aws-cdk/core');
import ssm = require('@aws-cdk/aws-ssm');
import rds = require('@aws-cdk/aws-rds');
import elasticache = require('@aws-cdk/aws-elasticache');

import { IVpc, InstanceType, InstanceSize, InstanceClass, ISecurityGroup, SecurityGroup } from '@aws-cdk/aws-ec2';
import { DatabaseClusterEngine, DatabaseInstanceEngine } from '@aws-cdk/aws-rds';
import { RemovalPolicy } from '@aws-cdk/core';
import { ISecret } from '@aws-cdk/aws-secretsmanager';

export interface AirflowDatabasesProps {
    vpc: IVpc
}

export class AirflowDatabases extends cdk.Construct {
    public readonly secret: ISecret
    public readonly securityGroupId: string
    public readonly redisSecurityGroupId: string
    public readonly postgresport: number | string
    public readonly redisPort: string
    public readonly redisHost: string

    constructor(scope: cdk.Construct, id: string, props: AirflowDatabasesProps) {
        super(scope, id);
        const vpc = props.vpc;

        /* Aurora Cluster

        const dbcluster = new rds.DatabaseCluster(this, "PostgresCluster", {
            engine: DatabaseClusterEngine.AURORA_POSTGRESQL,
            instances: 1,
            removalPolicy: RemovalPolicy.DESTROY,
            instanceProps: {
                vpc,
                instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
            },
            storageEncrypted: true,
            masterUser: {
                username: "airflow"
            },
            parameterGroup: {
                parameterGroupName: "default.aurora-postgresql10"
            } as any
        });
        */

       const dbcluster = new rds.DatabaseInstance(this, "PostgresInstance", {
           engine: DatabaseInstanceEngine.POSTGRES,
           removalPolicy: RemovalPolicy.DESTROY,
           masterUsername: "airflow",
           instanceClass: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
           vpc,
           storageEncrypted: true,
       });


        this.secret = dbcluster.secret as ISecret
        this.securityGroupId = dbcluster.securityGroupId
        this.postgresport = dbcluster.dbInstanceEndpointPort

        const redisSg = new SecurityGroup(this, "RedisSG", {
            allowAllOutbound: true,
            description: "for Redis Replication Group",
            securityGroupName: "RedisSG",
            vpc
        });
        this.redisSecurityGroupId = redisSg.securityGroupId;

        const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, "RedisSubnet", {
            subnetIds: vpc.privateSubnets.map((sn) => sn.subnetId),
            description: "RedisSubnetGroup"
         });

        const redis = new elasticache.CfnReplicationGroup(this, "Redis", {
            autoMinorVersionUpgrade: true,
            engine: 'redis',
            atRestEncryptionEnabled: true,
            automaticFailoverEnabled: false,
            engineVersion: '4.0.10',
            cacheNodeType: 'cache.t2.micro',
            numCacheClusters: 1,
            replicationGroupDescription: "Redis for Airflow",
            securityGroupIds: [this.redisSecurityGroupId],
            cacheSubnetGroupName: redisSubnetGroup.ref
        });

        this.redisHost = redis.attrPrimaryEndPointAddress
        this.redisPort = redis.attrPrimaryEndPointPort
    }
}
