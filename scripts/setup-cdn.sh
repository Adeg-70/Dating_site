#!/bin/bash

# CDN Setup for static assets
set -e

# Upload static assets to S3 for CloudFront
aws s3 sync ./uploads/ s3://your-cdn-bucket/uploads/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"

echo "✅ CDN setup completed"