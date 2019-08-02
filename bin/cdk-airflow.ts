#!/usr/bin/env node
import cdk = require('@aws-cdk/core');
import { CdkAirflowStack } from '../lib/cdk-airflow-stack';

const app = new cdk.App();
new CdkAirflowStack(app, 'CdkAirflowStack');