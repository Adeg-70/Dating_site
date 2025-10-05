#!/bin/bash

# SSL Certificate setup with Let's Encrypt
set -e

DOMAIN="yourdomain.com"
EMAIL="admin@yourdomain.com"

# Install certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Obtain SSL certificate
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $EMAIL

# Setup auto-renewal
echo "0 12 * * * root certbot renew --quiet" >> /etc/crontab

echo "✅ SSL certificate setup completed"