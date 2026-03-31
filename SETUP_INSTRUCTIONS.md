# Inspection Dashboard - Complete Setup Instructions

## What You're Getting

A complete, production-ready field inspection management system with:

- **Full-Stack Application**: React frontend + Node.js/Express backend
- **Database**: MySQL schema with all tables pre-configured
- **Authentication**: JWT-based user management
- **Features**: Form submission, approvals, analytics, attachments, templates
- **Testing**: Comprehensive test suite included
- **Documentation**: Complete deployment guides

## Files Included

```
inspection_dashboard/
├── client/                    # React frontend (port 5173 dev, dist/ for production)
├── server/                    # Express backend (port 3000)
├── drizzle/                   # Database migrations and schema
├── package.json               # Root dependencies
├── QUICKSTART.md             # 5-minute setup guide
├── DEPLOYMENT_GUIDE.md       # Production deployment
├── README.md                 # Full documentation
└── node_modules/             # All dependencies pre-installed
```

## System Requirements

- **Node.js**: v18 or higher
- **MySQL**: v5.7 or higher
- **RAM**: Minimum 2GB
- **Disk**: Minimum 5GB free space
- **OS**: Windows, macOS, or Linux

## Quick Setup (5 Minutes)

### Step 1: Extract Files
```bash
# Extract the archive
tar -xzf inspection_dashboard.tar.gz
# or if using ZIP
unzip inspection_dashboard.zip

cd inspection_dashboard
```

### Step 2: Install MySQL Database

**On Windows:**
1. Download MySQL from https://dev.mysql.com/downloads/mysql/
2. Run installer and follow setup wizard
3. Note the root password you set

**On macOS:**
```bash
brew install mysql
brew services start mysql
```

**On Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install mysql-server
sudo mysql_secure_installation
```

### Step 3: Create Database

```bash
# Connect to MySQL
mysql -u root -p

# Run these commands
CREATE DATABASE inspection_dashboard;
CREATE USER 'inspection_user'@'localhost' IDENTIFIED BY 'secure_password_123';
GRANT ALL PRIVILEGES ON inspection_dashboard.* TO 'inspection_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Step 4: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your database credentials
# Windows: notepad .env
# macOS/Linux: nano .env
```

Update these lines in `.env`:
```env
DATABASE_URL="mysql://inspection_user:secure_password_123@localhost:3306/inspection_dashboard"
JWT_SECRET="generate-a-random-string-here-min-32-chars"
NODE_ENV="development"
```

### Step 5: Initialize Database

```bash
# Install dependencies (if not already done)
npm install -g pnpm
pnpm install

# Run database migrations
pnpm db:push
```

### Step 6: Start the Application

```bash
# Start development server
pnpm dev
```

You should see:
```
Server running on http://localhost:3000/
```

Open your browser to: **http://localhost:3000**

## First Login

1. Click "Sign In" on the homepage
2. Follow the authentication flow
3. After login, you'll have a user account

## Make Yourself Admin

```bash
# Connect to database
mysql -u inspection_user -p inspection_dashboard

# Find your user ID
SELECT id, email, role FROM users;

# Update your role to admin
UPDATE users SET role = 'admin' WHERE id = 1;

# Verify
SELECT * FROM users WHERE id = 1;
EXIT;
```

## Testing the Application

### Employee Features
1. Login as a regular user
2. Click "Daily Field Report" - submit a form
3. Click "Concrete Test Data" - submit test results
4. Click "My Submissions" - see your history
5. Upload attachments to your forms

### Admin Features
1. Logout and login as admin
2. Click "Reports" - see all submissions
3. Click "Approvals" - approve/reject forms
4. Click "Analytics" - view charts and statistics
5. Manage form templates

## Troubleshooting

### MySQL Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Solution:**
- Ensure MySQL is running: `mysql -u root -p`
- Check DATABASE_URL in .env
- Verify username and password

### Port 3000 Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 pnpm dev
```

### Dependencies Installation Failed
```bash
# Clear cache and retry
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Database Migration Failed
```bash
# Reset and retry
mysql -u inspection_user -p inspection_dashboard
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS daily_field_reports;
DROP TABLE IF EXISTS concrete_tests;
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS form_templates;
EXIT;

pnpm db:push
```

## Available Commands

```bash
# Development
pnpm dev              # Start dev server (http://localhost:3000)
pnpm dev:client       # Start only React frontend (http://localhost:5173)

# Building
pnpm build            # Build for production
pnpm check            # Check TypeScript types

# Database
pnpm db:push          # Run migrations
pnpm db:studio        # Open database GUI (optional)

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode

# Code Quality
pnpm format           # Format code with Prettier
pnpm lint             # Check code style
```

## Production Deployment

See **DEPLOYMENT_GUIDE.md** for detailed instructions on:
- Traditional server deployment (VPS/Dedicated)
- Docker containerization
- Heroku deployment
- Nginx configuration
- SSL/HTTPS setup
- Database backups
- Monitoring and logging

## Project Architecture

### Frontend (React)
- **Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **State Management**: React Query (tRPC)
- **Forms**: React Hook Form + Zod validation

### Backend (Node.js/Express)
- **Framework**: Express 4 with TypeScript
- **API**: tRPC (type-safe RPC)
- **Database**: Drizzle ORM with MySQL
- **Authentication**: JWT tokens
- **Validation**: Zod schemas

### Database (MySQL)
- **Users**: Authentication and roles
- **Daily Field Reports**: Inspection data
- **Concrete Tests**: Test results
- **Approvals**: Admin decisions
- **Attachments**: File metadata
- **Form Templates**: Reusable templates

## Security Best Practices

1. **Change JWT_SECRET**: Generate a strong random string
2. **Use HTTPS**: In production, always use SSL/TLS
3. **Database Password**: Use a strong, unique password
4. **Environment Variables**: Never commit .env to version control
5. **Regular Backups**: Backup database daily
6. **Update Dependencies**: Keep packages updated
7. **Firewall**: Restrict database access to application server only

## Performance Tips

1. **Database Indexing**: Already configured in schema
2. **Caching**: Browser cache enabled for static assets
3. **Compression**: Gzip enabled for responses
4. **Query Optimization**: Use database indexes for filtering
5. **Load Testing**: Test with multiple concurrent users

## Monitoring & Maintenance

### Check Application Health
```bash
# View logs
pnpm dev

# Check database
mysql -u inspection_user -p inspection_dashboard
SHOW TABLES;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM daily_field_reports;
```

### Regular Tasks
- Review error logs weekly
- Backup database daily
- Update Node.js packages monthly
- Monitor disk space
- Check application performance

## Support Resources

- **Documentation**: See README.md in project root
- **API Reference**: Check server/routers.ts
- **Database Schema**: See drizzle/schema.ts
- **Component Library**: Browse client/src/components/
- **Examples**: Check client/src/pages/ for usage examples

## Next Steps

1. ✅ Extract and setup (you are here)
2. ✅ Create database and configure environment
3. ✅ Start development server
4. ✅ Test employee and admin features
5. ⬜ Configure email notifications (optional)
6. ⬜ Customize branding and colors
7. ⬜ Deploy to production server
8. ⬜ Set up automated backups
9. ⬜ Configure monitoring and alerting
10. ⬜ Train users on the system

## Customization

### Change Application Title
Edit `.env`:
```env
VITE_APP_TITLE="Your Company Inspection System"
```

### Change Colors/Theme
Edit `client/src/index.css` and update CSS variables

### Add Custom Fields
Edit `drizzle/schema.ts` and add columns to tables

### Modify API Endpoints
Edit `server/routers.ts` to add new procedures

## License & Support

This is a complete, production-ready application. All code is included and ready to customize for your needs.

For deployment assistance or customization, refer to DEPLOYMENT_GUIDE.md or contact your development team.

---

**Ready to get started?** Follow the Quick Setup section above and you'll be up and running in 5 minutes!
