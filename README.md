# Example ACM@UIUC Node-based API using AWS Lambda/API Gateway

## Run Locally
1. `yarn -D`
2. `make local`

## Build for AWS Lambda
1. `make clean`
2. `make build`

## Deploy to AWS env
1. Get AWS credentials with `aws configure sso`
2. Ensure AWS profile is set to the right account (DEV or PROD).
3. Run `make deploy_dev` or `make deploy_prod`.