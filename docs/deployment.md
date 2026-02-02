# DeepCut AI Deployment Guide

This guide explains how to deploy DeepCut AI to a Virtual Private Server (VPS) (supported: Ubuntu 20.04/22.04, Debian 11/12) using the automated installation script.

## 🚀 Quick Start

We provide a comprehensive `install.sh` script that handles everything: dependencies, database, application setup, and process management.

1. **SSH into your VPS**:
   ```bash
   ssh root@your-vps-ip
   ```

2. **Download and Run the Installer**:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/leksautomate/deepcutai/main/install.sh -o install.sh
   chmod +x install.sh
   sudo ./install.sh
   ```

3. **Follow the Prompts**:
   - The script will ask for a port (default: 5000).
   - It will automatically set up PostgreSQL and Node.js.

4. **Post-Extension Configuration**:
   After installation, the app will be running at `http://YOUR_IP:5000`.
   
   - **Environment Variables**: The installer generates a `.env` file at `/var/www/deepcut-ai/.env`. You may need to edit this file to add your API keys:
     ```bash
     nano /var/www/deepcut-ai/.env
     ```
     Add your keys (e.g., `GEMINI_API_KEY`, `GROQ_API_KEY`).

   - **Restart Application**:
     If you change the `.env` file, restart the application:
     ```bash
     pm2 restart deepcut-ai
     ```

## 🛠 Management Commands

The application is managed by **PM2**, a production process manager for Node.js.

- **Check Status**:
  ```bash
  pm2 status
  ```

- **View Logs**:
  ```bash
  pm2 logs deepcut-ai
  ```

- **Restart App**:
  ```bash
  pm2 restart deepcut-ai
  ```

- **Stop App**:
  ```bash
  pm2 stop deepcut-ai
  ```

## 🔄 Updating

To update the application to the latest version:

1. Run the installer again (it detects existing installations and updates code):
   ```bash
   sudo ./install.sh
   ```
   **OR** manually update:
   ```bash
   cd /var/www/deepcut-ai
   git pull
   npm install
   npm run build
   npm run db:push
   pm2 restart deepcut-ai
   ```
