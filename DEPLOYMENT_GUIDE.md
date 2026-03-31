# Inspection Dashboard - Deployment Guide

This guide will help you deploy the Inspection Dashboard on your own website/server.

## System Requirements

- **Node.js**: v18 or higher
- **npm/pnpm**: Package manager
- **MySQL**: v5.7 or higher (or compatible database)
- **Server**: Linux/Windows/macOS with at least 2GB RAM

## Project Structure

```
inspection_dashboard/
├── client/              # React frontend
├── server/              # Express backend
├── drizzle/             # Database schema & migrations
├── package.json         # Root dependencies
├── .env.example         # Environment template
└── README.md            # Quick start guide
```

## Step 1: Prerequisites Setup

### 1.1 Install Node.js
Download from https://nodejs.org/ (LTS version recommended)

### 1.2 Install pnpm (recommended)
```bash
npm install -g pnpm
```

### 1.3 Create MySQL Database
```sql
CREATE DATABASE inspection_dashboard;
CREATE USER 'inspection_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON inspection_dashboard.* TO 'inspection_user'@'localhost';
FLUSH PRIVILEGES;
```

## Step 2: Project Setup

### 2.1 Clone/Extract Project
```bash
cd /path/to/your/project
cd inspection_dashboard
```

### 2.2 Install Dependencies
```bash
pnpm install
```

### 2.3 Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database
DATABASE_URL="mysql://inspection_user:your_secure_password@localhost:3306/inspection_dashboard"

# JWT Secret (generate a strong random string)
JWT_SECRET="your-super-secret-jwt-key-min-32-characters"

# Server
NODE_ENV="production"
PORT=3000

# Email Configuration (for notifications)
SMTP_HOST="your-smtp-server.com"
SMTP_PORT=587
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-email-password"
SMTP_FROM="noreply@yourdomain.com"

# OAuth (optional - for future integration)
OAUTH_CLIENT_ID="your-oauth-client-id"
OAUTH_CLIENT_SECRET="your-oauth-client-secret"
OAUTH_REDIRECT_URI="https://yourdomain.com/api/oauth/callback"

# Frontend URLs
VITE_APP_TITLE="Inspection Dashboard"
VITE_API_URL="https://yourdomain.com/api"
```

## Step 3: Database Setup

### 3.1 Generate Migrations
```bash
pnpm db:push
```

This will:
- Generate migration files from schema
- Create all necessary tables
- Set up relationships and indexes

### 3.2 Verify Database
```bash
mysql -u inspection_user -p inspection_dashboard
SHOW TABLES;
```

You should see:
- users
- daily_field_reports
- concrete_tests
- approvals
- attachments
- form_templates

## Step 4: Build for Production

### 4.1 Build Frontend
```bash
cd client
pnpm build
```

Output will be in `client/dist/`

### 4.2 Build Backend
```bash
cd ..
pnpm build
```

Output will be in `dist/`

## Step 5: Deployment Options

### Option A: Traditional Server (VPS/Dedicated)

#### 5A.1 Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start dist/index.js --name "inspection-dashboard"

# Save PM2 configuration
pm2 save

# Enable auto-restart on reboot
pm2 startup
```

#### 5A.2 Configure Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Frontend
    location / {
        root /path/to/inspection_dashboard/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 5A.3 SSL Certificate (Let's Encrypt)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d yourdomain.com
```

### Option B: Docker Deployment

#### 5B.1 Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

#### 5B.2 Build and Run
```bash
docker build -t inspection-dashboard .
docker run -p 3000:80 --env-file .env inspection-dashboard
```

### Option C: Heroku Deployment

#### 5C.1 Install Heroku CLI
```bash
npm install -g heroku
heroku login
```

#### 5C.2 Create Heroku App
```bash
heroku create your-app-name
heroku addons:create cleardb:ignite
```

#### 5C.3 Deploy
```bash
git push heroku main
heroku config:set JWT_SECRET="your-secret"
```

## Step 6: Post-Deployment

### 6.1 Create Admin User
```bash
# Connect to database and insert admin user
mysql -u inspection_user -p inspection_dashboard

INSERT INTO users (openId, name, email, role, createdAt, updatedAt, lastSignedIn)
VALUES ('admin-001', 'Admin User', 'admin@yourdomain.com', 'admin', NOW(), NOW(), NOW());
```

### 6.2 Test Application
1. Navigate to `https://yourdomain.com`
2. Login with admin credentials
3. Test form submission
4. Check admin dashboard

### 6.3 Set Up Monitoring
```bash
# Install monitoring tools
pm2 install pm2-auto-pull
pm2 install pm2-logrotate

# View logs
pm2 logs inspection-dashboard
```

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Solution**: Ensure MySQL is running and DATABASE_URL is correct

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist
pnpm install
pnpm build
```

### Email Notifications Not Working
- Verify SMTP credentials
- Check firewall allows SMTP port (usually 587)
- Enable "Less secure apps" if using Gmail

## Security Checklist

- [ ] Change default JWT_SECRET to strong random string
- [ ] Use HTTPS/SSL certificates
- [ ] Set strong database password
- [ ] Enable firewall rules
- [ ] Regular database backups
- [ ] Keep Node.js updated
- [ ] Use environment variables for all secrets
- [ ] Enable CORS only for your domain
- [ ] Set up rate limiting
- [ ] Regular security audits

## Backup & Recovery

### Database Backup
```bash
mysqldump -u inspection_user -p inspection_dashboard > backup.sql
```

### Database Restore
```bash
mysql -u inspection_user -p inspection_dashboard < backup.sql
```

### File Backup
```bash
tar -czf inspection-dashboard-backup.tar.gz /path/to/inspection_dashboard
```

## Performance Optimization

### 1. Enable Caching
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 2. Gzip Compression
```nginx
gzip on;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript;
gzip_vary on;
```

### 3. Database Indexing
Already configured in schema, but verify:
```sql
SHOW INDEXES FROM daily_field_reports;
SHOW INDEXES FROM concrete_tests;
```

## Support & Maintenance

- Check logs regularly: `pm2 logs`
- Monitor disk space: `df -h`
- Monitor memory: `free -h`
- Update dependencies: `pnpm update`
- Review error logs: `/var/log/nginx/error.log`

## Next Steps

1. Configure email notifications for your domain
2. Set up automated backups
3. Configure monitoring/alerting
4. Train users on the system
5. Plan for scaling as users grow

For questions or issues, refer to the README.md in the project root.
