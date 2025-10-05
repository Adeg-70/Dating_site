#!/bin/bash

# AWS ECR Deployment Script
set -e

REGION="us-east-1"
ECR_REPO="YOUR_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/loveconnect"
CLUSTER="loveconnect-cluster"
SERVICE="loveconnect-service"

# Login to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO

# Build and push image
docker build -f Dockerfile.aws -t $ECR_REPO:latest .
docker push $ECR_REPO:latest

# Update ECS service
aws ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment --region $REGION

echo "Deployment completed successfully!"