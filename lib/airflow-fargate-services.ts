import ecspatterns = require('@aws-cdk/aws-ecs-patterns');
import ecr = require('@aws-cdk/aws-ecr');
import cdk = require('@aws-cdk/core');

import { ContainerImage, Cluster, ContainerDefinition, TaskDefinition, Compatibility, FargateService } from '@aws-cdk/aws-ecs';
import { Vpc, IVpc, ISecurityGroup } from '@aws-cdk/aws-ec2';
import { Duration, RemovalPolicy } from '@aws-cdk/core';
import { Bucket, BlockPublicAccess, BucketEncryption } from '@aws-cdk/aws-s3';
import { PolicyStatement, Effect, ServicePrincipal } from '@aws-cdk/aws-iam';
import { DatabaseCluster } from '@aws-cdk/aws-rds';

export interface AirflowFargateServiceProps {
    airflowBaseImage: ecr.IRepository
    vpc: IVpc
    db: {
        cluster: DatabaseCluster
        username: string
    }
}

export class AirflowFargateService extends cdk.Construct {
    public readonly securityGroups: ISecurityGroup[]

    constructor(scope: cdk.Construct, id: string, props: AirflowFargateServiceProps) {
        super(scope, id);
        const airflowImage = ContainerImage.fromEcrRepository(props.airflowBaseImage)
        const vpc = props.vpc;
        const cluster = new Cluster(this, "Cluster", { vpc });
        const db = props.db;

        const airflowS3 = new Bucket(this, "AirflowBucket", {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryption: BucketEncryption.KMS_MANAGED,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const airflowWebserver = new ecspatterns.LoadBalancedFargateService(this, "Webserver", {
            containerPort: 8080,
            cluster: cluster,
            image: airflowImage,
            publicLoadBalancer: false,
            environment: {
                LOAD_EX: "y", // load airflow examples? n/y
                REDIS_HOST: "",
                REDIS_PASSWORD: "",
                POSTGRES_HOST: db.cluster.clusterEndpoint.hostname,
                POSTGRES_PORT: db.cluster.clusterEndpoint.port.toString(),
                POSTGRES_USER: db.username,
                POSTGRES_PASSWORD: db.cluster.secret ? db.cluster.secret.secretValue.toString() : "",
                DAG_BUCKET: airflowS3.bucketName,
                EXECUTOR: "Sequential"
            }
        });

        airflowWebserver.targetGroup.configureHealthCheck({ healthyHttpCodes: "200,302", interval: Duration.seconds(120), unhealthyThresholdCount: 5 })

        this.securityGroups = airflowWebserver.service.cluster.connections.securityGroups
        /*
        airflowWebserver.service.taskDefinition.addContainer("SchedulerContainer", {
            command: ["scheduler"],
            //essential: true,
            image: airflowImage,
            environment: {
                LOAD_EX: "y", // load airflow examples? n/y
                FERNET_KEY: "",
                DAG_BUCKET: airflowS3.bucketName,
                EXECUTOR: "Celery"
            }
        });
        */

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

        /*
                const celeryFlower = new ecspatterns.LoadBalancedFargateService(this, "Flower", {
                    containerPort: 5555,
                    cluster: cluster,
                    image: airflowImage,
                    publicLoadBalancer: false,
                    environment: {
                        EXECUTOR: "Celery",
                        REDIS_PASSWORD: ""
                    }
                });

                celeryFlower.service.taskDefinition.defaultContainer = new ContainerDefinition(this, "ClereyContainer", {
                    image: airflowImage,
                    command: ["flower"],
                    taskDefinition: celeryFlower.service.taskDefinition
                });

                celeryFlower.targetGroup.configureHealthCheck({ healthyHttpCodes: "200,302", interval: Duration.seconds(120), unhealthyThresholdCount: 5 })

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
            environment: {
                FERNET_KEY: "",
                EXECUTOR: "Celery"
            }
        });

        const workerService = new FargateService(this, "Worker", {
            cluster: cluster,
            taskDefinition: workerTask,
        });

        /* Define Scheduler */

        /*
                const schedulerTask = new TaskDefinition(this, "SchedulerTask", {
                    compatibility: Compatibility.FARGATE,
                    cpu: "256",
                    memoryMiB: "512"
                });
                const schedulerService = new FargateService(this, "Scheduler", {
                    cluster: cluster,
                    taskDefinition: schedulerTask
                });

                schedulerTask.addContainer("SchedulerContainer", {
                    command: ["scheduler"],
                    essential: true,
                    image: airflowImage,
                    environment: {
                        LOAD_EX: "y", // load airflow examples? n/y
                        FERNET_KEY: "",
                        EXECUTOR: "Celery"
                    }
                });
                */
    }
}
