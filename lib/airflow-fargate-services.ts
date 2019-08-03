import ecspatterns = require('@aws-cdk/aws-ecs-patterns');
import ecr = require('@aws-cdk/aws-ecr');
import cdk = require('@aws-cdk/core');

import { ContainerImage, Cluster, TaskDefinition, Compatibility, FargateService, Secret, AwsLogDriver, ContainerDefinition, CfnTaskDefinition } from '@aws-cdk/aws-ecs';
import { IVpc, ISecurityGroup } from '@aws-cdk/aws-ec2';
import { Duration, RemovalPolicy } from '@aws-cdk/core';
import { Bucket, BlockPublicAccess, BucketEncryption } from '@aws-cdk/aws-s3';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { ISecret } from '@aws-cdk/aws-secretsmanager';

export interface AirflowFargateServiceProps {
    airflowBaseImage: ecr.IRepository
    vpc: IVpc
    db: {
        Secret: ISecret
        redisHost: string
    }

}

export class AirflowFargateService extends cdk.Construct {
    public readonly securityGroups: ISecurityGroup[]

    constructor(scope: cdk.Construct, id: string, props: AirflowFargateServiceProps) {
        super(scope, id);
        const airflowImage = ContainerImage.fromEcrRepository(props.airflowBaseImage)
        const vpc = props.vpc;
        const cluster = new Cluster(this, "Cluster", { vpc });
        const dbSecret = props.db.Secret;
        const redisHost = props.db.redisHost

        const airflowS3 = new Bucket(this, "AirflowBucket", {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryption: BucketEncryption.KMS_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const airflowWebserver = new ecspatterns.LoadBalancedFargateService(this, "airflow-webserver", {
            containerPort: 8080,
            cluster: cluster,
            image: airflowImage,
            publicLoadBalancer: false,
            secrets: {
                POSTGRES_SECRET: Secret.fromSecretsManager(dbSecret),
            },
            environment: {
                LOAD_EX: "y", // load airflow examples? n/y
                REDIS_HOST: redisHost,
                REDIS_PASSWORD: "",
                DAG_BUCKET: airflowS3.bucketName,
                EXECUTOR: "Celery"
            }
        });

        airflowWebserver.targetGroup.configureHealthCheck({ healthyHttpCodes: "200,302", interval: Duration.seconds(120), unhealthyThresholdCount: 5 })

        this.securityGroups = airflowWebserver.service.connections.securityGroups

        airflowWebserver.service.taskDefinition.taskRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "s3:HeadBucket",
                    "s3:ListBucket*",
                    "s3:GetBucket*",
                    "s3:GetObject*",
                    "s3:PutObject*",
                    "s3:DeleteObject*",
                ],
                resources: [
                    airflowS3.bucketArn,
                    `${airflowS3.bucketArn}/*`
                ]
            })
        );

        const celeryFlower = new ecspatterns.LoadBalancedFargateService(this, "airflow-flower", {
            containerPort: 5555,
            cluster: cluster,
            image: airflowImage,
            publicLoadBalancer: false,
            environment: {
                EXECUTOR: "Celery",
                REDIS_HOST: redisHost,
                REDIS_PASSWORD: ""
            },
        });

        /*
        celeryFlower.service.taskDefinition.defaultContainer  = new ContainerDefinition(this, "FlowerContainer", {
            image: airflowImage,
            command: ["flower"],
            taskDefinition: celeryFlower.service.taskDefinition
        });
        */

        const celeryTask = celeryFlower.service.taskDefinition.node.defaultChild as CfnTaskDefinition;
        celeryTask.addPropertyOverride("ContainerDefinitions.0.Command", ["flower"])

        celeryFlower.targetGroup.configureHealthCheck({ healthyHttpCodes: "200,302", interval: Duration.seconds(120), unhealthyThresholdCount: 5 })

        this.securityGroups = this.securityGroups.concat(celeryFlower.service.connections.securityGroups)
        /* Define Worker */

        const workerTask = new TaskDefinition(this, "WorkerTask", {
            compatibility: Compatibility.FARGATE,
            cpu: "256",
            memoryMiB: "512"
        });

        workerTask.addContainer("WorkerContainer", {
            command: ["worker"],
            essential: true,
            image: airflowImage,
            secrets: {
                POSTGRES_SECRET: Secret.fromSecretsManager(dbSecret),
            },
            environment: {
                FERNET_KEY: "",
                REDIS_HOST: redisHost,
                EXECUTOR: "Celery"
            },
            logging: new AwsLogDriver({ streamPrefix: "airflow-worker" })
        });

        const workerService = new FargateService(this, "Worker", {
            cluster: cluster,
            taskDefinition: workerTask
        });

        this.securityGroups = this.securityGroups.concat(workerService.connections.securityGroups)

        /* Define Scheduler */

        const schedulerTask = new TaskDefinition(this, "SchedulerTask", {
            compatibility: Compatibility.FARGATE,
            cpu: "256",
            memoryMiB: "512"
        });

        schedulerTask.addContainer("SchedulerContainer", {
            command: ["scheduler"],
            essential: true,
            image: airflowImage,
            secrets: {
                POSTGRES_SECRET: Secret.fromSecretsManager(dbSecret),
            },
            environment: {
                LOAD_EX: "y", // load airflow examples? n/y
                FERNET_KEY: "",
                REDIS_HOST: redisHost,
                DAG_BUCKET: airflowS3.bucketName,
                EXECUTOR: "Celery"
            },
            logging: new AwsLogDriver({ streamPrefix: "airflow-scheduler" })
        });

        const schedulerService = new FargateService(this, "Scheduler", {
            cluster: cluster,
            taskDefinition: schedulerTask
        });

        this.securityGroups = this.securityGroups.concat(schedulerService.connections.securityGroups)


    }
}
