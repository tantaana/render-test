#!/bin/bash

# Update package lists
apt-get update

# Install dependencies for Chrome
apt-get install -y wget gnupg --no-install-recommends

# Add Google Chrome's signing key
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -

# Add Chrome repository
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Update package lists again
apt-get update

# Install Google Chrome
apt-get install -y google-chrome-stable --no-install-recommends

# Install npm dependencies
npm install
