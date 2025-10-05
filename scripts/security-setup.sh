#!/bin/bash

# Security hardening script
set -e

echo "🔒 Applying security settings..."

# Update system
apt-get update && apt-get upgrade -y

# Configure firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable

# Install fail2ban
apt-get install -y fail2ban

# Configure SSH security
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config

# Set file permissions
chmod 600 /etc/ssh/ssh_host_*_key
chmod 644 /etc/ssh/ssh_host_*_key.pub

# Create application user
useradd -m -s /bin/bash appuser
usermod -aG sudo appuser

echo "✅ Security setup completed"