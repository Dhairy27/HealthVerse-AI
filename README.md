# Project Setup & Git Workflow

This document details the environment configuration and Git branching workflow for development.

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory (or update the existing one) with the following variables:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

---

## 🌿 Git & Pull Request Workflow

Follow these steps to pull the latest changes, make edits, push to the `setup` branch, and create a pull request:

1. **Pull Latest from Setup**:
   ```bash
   git checkout setup
   git pull origin setup
   ```

2. **Create or Switch to the Setup Branch**:
   - **After Edit in code**
   ```bash
   git checkout -b setup
   ```

3. **Stage and Commit Edits**:
   ```bash
   git init
   git add .
   git commit -m "merge"
   ```

4. **Push to the Remote Repository**:
   ```bash
   git push origin setup
   ```

5. **Create a Pull Request**:
   - Go to your repository on GitHub.
   - Click the **Compare & pull request** button for the `setup` branch.
   - Submit the pull request to merge the `setup` branch into `main`.
