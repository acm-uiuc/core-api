# Example ACM@UIUC Node-based API using AWS Lambda/API Gateway

## Run Locally
1. `yarn -D`
2. `make check_account_dev` - If this fails make sure that AWS is configured.
3. `make local`

## Build for AWS Lambda
1. `make clean`
2. `make build`

## Deploy to AWS env

1. Get AWS credentials with `aws configure sso`
2. Ensure AWS profile is set to the right account (DEV or PROD).
3. Run `make deploy_dev` or `make deploy_prod`.

## Generating JWT token

Create a `.env` file containing your `CLIENT_SECRET`.

```bash
node --env-file=.env get_msft_jwt.js
```

## Configuring AWS

```
aws configure sso
```

Go to AWS Access Portal > "acmdev" > Access keys and copy the values for 
"AWS start URL" and "AWS Region"

Add your profile to your `.zshrc` / `.bashrc`.

```bash
export AWS_PROFILE=ABC-DEV
```

and then `source ~/.zshrc` / `source ~/.bashrc`.
