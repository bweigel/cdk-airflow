# Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

# Deploy using different context (i.e. reusing existing VPC & subnets)

`cdk deploy -c vpcid=vpc-01700... -c azs=eu-central-1a,eu-central-1b -c privatesubnetids=subnet-04436...,subnet-0a470...`