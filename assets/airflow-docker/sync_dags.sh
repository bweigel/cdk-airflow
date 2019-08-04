#!/bin/bash

set -euo pipefail

aws s3 sync s3://${DAG_BUCKET}/dags ${AIRFLOW_HOME}/dags