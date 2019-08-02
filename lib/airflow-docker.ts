import codebuild = require('@aws-cdk/aws-codebuild');
import ecr = require('@aws-cdk/aws-ecr');
import cdk = require('@aws-cdk/core');
import { PolicyStatement } from '@aws-cdk/aws-iam';


export class AirflowDockerBuild extends cdk.Construct {
    public readonly imageRepo: ecr.Repository

    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);

        this.imageRepo = new ecr.Repository(this, "AirflowRepo", { repositoryName: 'airflow/base' })

        const buildProject = new codebuild.Project(this, "AirflowDockerBuild", {
            source: codebuild.Source.gitHub({ owner: 'bweigel', repo: 'cdk-airflow' }),
            badge: true,
            environment: { buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_DOCKER_18_09_0, privileged: true },
            buildSpec: codebuild.BuildSpec.fromSourceFilename("assets/airflow-docker/buildspec.yml"),
            environmentVariables: {
                ECR_QUALIFIED_REPO_NAME: { value: this.imageRepo.repositoryUri }
            }
        });

        buildProject.addToRolePolicy(new PolicyStatement({
            actions: [
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:GetRepositoryPolicy",
                "ecr:DescribeRepositories",
                "ecr:ListImages",
                "ecr:DescribeImages",
                "ecr:BatchGetImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:PutImage"
            ],
            resources: [this.imageRepo.repositoryArn]
        }))

        buildProject.addToRolePolicy(new PolicyStatement({
            actions: [
                "ecr:GetAuthorizationToken",
            ],
            resources: ['*']
        }))
    }
}
