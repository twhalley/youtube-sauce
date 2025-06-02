#!/bin/bash
set -euo pipefail

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Create IAM user for Terraform
echo "Creating IAM user for Terraform..."
aws iam create-user --user-name youtube-sauce-terraform

# Attach policy
echo "Creating and attaching IAM policy..."
POLICY_ARN=$(aws iam create-policy \
    --policy-name youtube-sauce-terraform-policy \
    --policy-document file://terraform-user-policy.json \
    --query 'Policy.Arn' \
    --output text)

aws iam attach-user-policy \
    --user-name youtube-sauce-terraform \
    --policy-arn "$POLICY_ARN"

# Create access key
echo "Creating access key..."
aws iam create-access-key \
    --user-name youtube-sauce-terraform \
    > terraform-credentials.json

# Set up AWS credentials file
mkdir -p ~/.aws

# Check if credentials file exists and has [youtube-sauce] profile
if grep -q "\[youtube-sauce\]" ~/.aws/credentials 2>/dev/null; then
    echo "Profile [youtube-sauce] already exists in credentials file."
else
    # Add new profile
    echo -e "\n[youtube-sauce]" >> ~/.aws/credentials
    ACCESS_KEY=$(jq -r .AccessKey.AccessKeyId terraform-credentials.json)
    SECRET_KEY=$(jq -r .AccessKey.SecretAccessKey terraform-credentials.json)
    echo "aws_access_key_id = $ACCESS_KEY" >> ~/.aws/credentials
    echo "aws_secret_access_key = $SECRET_KEY" >> ~/.aws/credentials
fi

# Create/update config file
if grep -q "\[profile youtube-sauce\]" ~/.aws/config 2>/dev/null; then
    echo "Profile [youtube-sauce] already exists in config file."
else
    echo -e "\n[profile youtube-sauce]" >> ~/.aws/config
    echo "region = eu-north-1" >> ~/.aws/config
    echo "output = json" >> ~/.aws/config
fi

echo "Credentials saved to ~/.aws/credentials and ~/.aws/config"
echo "IMPORTANT: The access key details are also saved in terraform-credentials.json"
echo "Please save these credentials securely and then delete terraform-credentials.json"
echo ""
echo "To use these credentials:"
echo "export AWS_PROFILE=youtube-sauce" 