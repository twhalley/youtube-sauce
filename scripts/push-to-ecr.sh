#!/bin/bash

# Exit on error
set -e

# Configuration
AWS_REGION="eu-north-1"  # Change this to match your region
IMAGE_NAME="youtube-sauce"
IMAGE_TAG="latest"

# Check if AWS credentials are set
if [ -z "${AWS_ACCESS_KEY_ID}" ] || [ -z "${AWS_SECRET_ACCESS_KEY}" ]; then
    echo "⚠️  AWS credentials not found in environment variables."
    echo "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY before running this script."
    echo "You can get these values after running 'terraform output' in the terraform directory."
    exit 1
fi

# Get AWS account ID
echo "🔍 Getting AWS account ID..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

if [ $? -ne 0 ]; then
    echo "❌ Failed to get AWS account ID. Please check your credentials."
    exit 1
fi

# ECR repository URL
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${IMAGE_NAME}"

echo "🔑 Logging in to Amazon ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

if [ $? -ne 0 ]; then
    echo "❌ Failed to log in to ECR. Please check your credentials and permissions."
    exit 1
fi

echo "🏗️ Building Docker image..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} ./server

if [ $? -ne 0 ]; then
    echo "❌ Failed to build Docker image."
    exit 1
fi

echo "🏷️ Tagging image..."
docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${ECR_REPO}:${IMAGE_TAG}

echo "⬆️ Pushing image to ECR..."
docker push ${ECR_REPO}:${IMAGE_TAG}

if [ $? -ne 0 ]; then
    echo "❌ Failed to push image to ECR."
    exit 1
fi

echo "✅ Successfully pushed image to ECR!"
echo "Repository URL: ${ECR_REPO}" 