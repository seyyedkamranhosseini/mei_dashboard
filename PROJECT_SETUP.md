# Inspection Dashboard - Complete Project Setup

## Overview

This is a full-stack inspection management system built with React, TypeScript, Express, tRPC, and MySQL. It allows employees to submit daily field reports and concrete test data, while admins can review, approve, or reject submissions.

## Project Structure

```
inspection_dashboard/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/            # Page components
│   │   ├── components/       # Reusable UI components
│   │   ├── lib/              # Utilities and tRPC client
│   │   ├── App.tsx           # Main app routing
│   │   └── index.css         # Global styles
│   ├── public/               # Static assets
│   └── index.html            # HTML entry point
├── server/                    # Express backend
│   ├── routers.ts            # tRPC procedures
│   ├── db.ts                 # Database queries
│   ├── pdf.ts                # PDF generation
│   └── _core/                # Core infrastructure
├── drizzle/                   # Database schema and migrations
│   └── schema.ts             # Table definitions
├── shared/                    # Shared types and constants
├── package.json              # Dependencies
├── vite.config.ts            # Vite configuration
└── vitest.config.ts          # Test configuration
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd inspection_dashboard
pnpm install
```

### 2. Database Setup

The project uses MySQL with Drizzle ORM. Ensure you have a MySQL database configured.

**Push database schema:**
```bash
pnpm db:push
```

**Run migrations:**
```bash
pnpm db:migrate
```

### 3. Create Admin and Employee Users

Run the setup script to create test users:

```bash
node setup-admin-app.mjs
```

This creates:
- **Admin User:** admin / admin123
- **Employee User:** employee / employee123

### 4. Start Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`

## Database Schema

### Users Table
- Stores user accounts with roles (admin/employee)
- Supports both OAuth and username/password authentication
- Tracks login activity and account status

### Daily Field Reports Table
- Captures daily on-site inspection data
- Fields: job number, permit, project, location, weather, inspection types, etc.
- Status: pending, approved, rejected
- Supports file attachments

### Concrete Tests Table
- Stores concrete specimen strength test data
- Tracks specimen numbers, strength values, averages
- Contains lab technician and manager information
- Status: pending, approved, rejected
- Supports file attachments

### Approvals Table
- Records admin decisions on submitted forms
- Tracks approval/rejection with comments
- Links to specific forms (daily or concrete)

### Attachments Table
- Stores file upload metadata
- References S3 storage for actual files
- Tracks file type, size, and upload timestamp

### Form Templates Table
- Allows admins to create reusable form templates
- Stores template data in JSON format
- Can be marked active/inactive

## Key Features

### Employee Features
- Submit daily field reports with inspection details
- Submit concrete test data with specimen information
- Upload images and documents as attachments
- View submission history and approval status
- Edit pending/rejected submissions
- Download submitted reports as PDF

### Admin Features
- View all submitted reports and tests
- Filter by status (pending, approved, rejected)
- Review detailed form data
- Approve or reject submissions with comments
- Download reports as PDF
- Manage user accounts (create, activate, deactivate, delete)
- View analytics and submission statistics

## Authentication

The system supports two authentication methods:

1. **Manus OAuth** - Enterprise single sign-on
2. **Username/Password** - Local authentication with PBKDF2 hashing

Admin users are created via the setup script. Additional users can be created through the admin panel.

## File Upload & Storage

Files are uploaded to S3 storage with the following features:
- Automatic image compression
- Thumbnail gallery display
- Download and delete capabilities
- Metadata tracking in database

## Testing

Run the test suite:

```bash
pnpm test
```

Tests cover:
- Authentication and login
- Form submission and validation
- Database operations
- PDF generation

## API Endpoints

All API endpoints are tRPC procedures under `/api/trpc`:

### Daily Reports
- `dailyReport.create` - Submit new report
- `dailyReport.edit` - Edit pending/rejected report
- `dailyReport.getUserReports` - Get employee's submissions
- `dailyReport.getAllReports` - Get all reports (admin only)
- `dailyReport.updateStatus` - Approve/reject (admin only)
- `dailyReport.downloadPDF` - Generate PDF

### Concrete Tests
- `concreteTest.create` - Submit new test
- `concreteTest.edit` - Edit pending/rejected test
- `concreteTest.getUserTests` - Get employee's submissions
- `concreteTest.getAllTests` - Get all tests (admin only)
- `concreteTest.updateStatus` - Approve/reject (admin only)
- `concreteTest.downloadPDF` - Generate PDF

### Attachments
- `attachment.upload` - Upload file
- `attachment.getByForm` - Get attachments for form
- `attachment.delete` - Delete attachment

### User Management
- `users.getAll` - Get all users (admin only)
- `users.activate` - Activate user (admin only)
- `users.delete` - Delete user (admin only)

## Environment Variables

Required environment variables (auto-configured):
- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - Session signing secret
- `VITE_APP_ID` - OAuth application ID
- `OAUTH_SERVER_URL` - OAuth server URL
- `VITE_OAUTH_PORTAL_URL` - OAuth login portal

## Deployment

The project is ready for deployment on Manus platform:

1. Create a checkpoint via the Management UI
2. Click "Publish" button to deploy
3. Custom domains can be configured in Settings

For external hosting, ensure:
- Node.js 18+ is installed
- MySQL database is accessible
- Environment variables are configured
- S3 credentials are set up

## Troubleshooting

### Forms not submitting
- Check browser console for errors
- Verify database connection
- Ensure user is logged in with correct role

### Attachments not uploading
- Check S3 configuration
- Verify file size limits
- Check browser console for upload errors

### PDF generation failing
- Ensure all required fonts are available
- Check image URLs are accessible
- Verify database has attachment records

## Support & Documentation

For more information:
- Check individual component files for implementation details
- Review test files for usage examples
- Consult Drizzle ORM documentation for database queries
- See tRPC documentation for API procedures

## License

This project is proprietary and confidential.
