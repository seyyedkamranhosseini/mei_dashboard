# Quick Start Guide - Inspection Dashboard

Get the Inspection Dashboard running on your local machine in 5 minutes.

## Prerequisites

- Node.js v18+ (https://nodejs.org/)
- MySQL 5.7+ (https://www.mysql.com/)
- pnpm (recommended) or npm

## Installation

### 1. Install pnpm (if not already installed)
```bash
npm install -g pnpm
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Setup Database

Create a new MySQL database:
```bash
mysql -u root -p
```

```sql
CREATE DATABASE inspection_dashboard;
CREATE USER 'inspection_user'@'localhost' IDENTIFIED BY 'password123';
GRANT ALL PRIVILEGES ON inspection_dashboard.* TO 'inspection_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and update:
```env
DATABASE_URL="mysql://inspection_user:password123@localhost:3306/inspection_dashboard"
JWT_SECRET="your-random-secret-key-here-at-least-32-chars"
NODE_ENV="development"
```

### 5. Initialize Database
```bash
pnpm db:push
```

### 6. Start Development Server
```bash
pnpm dev
```

The application will be available at: **http://localhost:3000**

## Default Login

The system uses Manus OAuth for authentication. For local development:

1. Click "Sign In" on the home page
2. Follow the OAuth flow
3. After first login, you'll be a regular user

To make yourself an admin, update the database:
```bash
mysql -u inspection_user -p inspection_dashboard
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── lib/           # Utilities
│   │   └── App.tsx        # Main app
│   └── index.html
├── server/                # Express backend
│   ├── routers.ts         # API endpoints
│   ├── db.ts              # Database queries
│   └── _core/             # Core infrastructure
├── drizzle/               # Database schema
│   └── schema.ts
└── package.json
```

## Available Scripts

```bash
# Development
pnpm dev              # Start dev server

# Building
pnpm build            # Build for production
pnpm check            # TypeScript check

# Database
pnpm db:push          # Run migrations

# Testing
pnpm test             # Run tests

# Formatting
pnpm format           # Format code
```

## Key Features

✅ **Employee Dashboard**
- Submit daily field reports
- Submit concrete test data
- View submission history
- Download PDF reports
- Upload attachments

✅ **Admin Dashboard**
- Review all submissions
- Approve/reject forms
- Add comments
- View analytics
- Manage form templates

✅ **Analytics**
- Submission trends
- Approval rates
- Concrete strength statistics
- Inspector performance

## Troubleshooting

### Database Connection Failed
```
Error: connect ECONNREFUSED
```
**Fix**: Ensure MySQL is running and credentials in .env are correct

### Port 3000 Already in Use
```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>
```

### Build Errors
```bash
# Clear and reinstall
rm -rf node_modules dist
pnpm install
pnpm build
```

### Database Migration Failed
```bash
# Reset database
mysql -u inspection_user -p inspection_dashboard
DROP TABLE IF EXISTS users;
pnpm db:push
```

## Testing

Run the test suite:
```bash
pnpm test
```

Expected output: 11 tests passing

## Next Steps

1. **Customize Branding**: Edit `client/src/index.css` for colors
2. **Configure Email**: Set SMTP credentials in `.env`
3. **Add Users**: Create admin and employee accounts
4. **Deploy**: Follow DEPLOYMENT_GUIDE.md for production setup

## Documentation

- **DEPLOYMENT_GUIDE.md** - Production deployment instructions
- **README.md** - Full project documentation
- **server/routers.ts** - API endpoint definitions
- **drizzle/schema.ts** - Database schema

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review error logs in browser console
3. Check server logs: `pnpm dev` output
4. Review database with: `mysql -u inspection_user -p inspection_dashboard`

## Performance Tips

- Use Chrome DevTools for frontend debugging
- Check database query performance: `EXPLAIN SELECT ...`
- Monitor server logs for errors
- Use `pnpm test` to catch issues early

Happy inspecting! 🔍
