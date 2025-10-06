# Quickstart Guide: E-Commerce Platform

**Feature**: E-Commerce Platform for Cars and Services  
**Generated**: 2024-12-19  
**Phase**: 1 (Design)

## Development Environment Setup

### Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL 14+
- Redis 6+
- Git

### Quick Start Commands

```bash
# 1. Clone and setup backend
git clone <repo-url>
cd pakfuturemotors-backend
npm install
cp .env.example .env

# 2. Database setup
createdb pakfuturemotors_dev
npm run db:migrate
npm run db:seed

# 3. Start backend services
npm run dev    # API server on :3000
npm run redis  # Redis server on :6379

# 4. Setup frontend (separate terminal)
cd ../pakfuturemotors-frontend
npm install
npm run dev    # Frontend on :5173

# 5. Run tests
npm run test           # Unit tests
npm run test:e2e       # End-to-end tests
npm run test:coverage  # Coverage report
```

### Environment Variables (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pakfuturemotors_dev
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-token-secret
SESSION_SECRET=your-session-secret

# Payment Providers
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret

# Social Authentication
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# SMS/Phone Verification
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# File Storage
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=pakfuturemotors-assets
AWS_REGION=us-east-1

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Development
NODE_ENV=development
API_PORT=3000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

## Project Structure

```
pakfuturemotors/
├── backend/                    # Express.js/TypeScript API
│   ├── src/
│   │   ├── controllers/        # Route handlers
│   │   ├── models/            # Database models (Prisma/TypeORM)
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── routes/            # API route definitions
│   │   ├── utils/             # Helper functions
│   │   ├── types/             # TypeScript type definitions
│   │   └── app.ts             # Express app setup
│   ├── prisma/                # Database schema and migrations
│   ├── tests/                 # Backend tests
│   └── package.json
│
├── frontend/                   # React/TypeScript SPA
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API client functions
│   │   ├── store/             # State management (Redux/Zustand)
│   │   ├── types/             # TypeScript interfaces
│   │   ├── utils/             # Helper functions
│   │   └── App.tsx            # Main app component
│   ├── public/                # Static assets
│   ├── tests/                 # Frontend tests
│   └── package.json
│
├── shared/                     # Shared types and utilities
│   ├── types/                 # Common TypeScript interfaces
│   └── utils/                 # Shared helper functions
│
├── docs/                      # Documentation
│   ├── api/                   # API documentation
│   ├── deployment/            # Deployment guides
│   └── development/           # Development guides
│
└── infrastructure/            # DevOps and deployment
    ├── docker/                # Docker configurations
    ├── k8s/                   # Kubernetes manifests
    └── terraform/             # Infrastructure as code
```

## Key Development Workflows

### 1. Adding a New Feature
```bash
# 1. Create feature branch
git checkout -b feature/new-feature-name

# 2. Backend: Add model, service, controller, routes
# 3. Frontend: Add components, pages, state management
# 4. Add tests for both backend and frontend
# 5. Update API documentation

# 6. Run tests
npm run test:all

# 7. Create pull request
git push origin feature/new-feature-name
```

### 2. Database Changes
```bash
# 1. Update Prisma schema
vim prisma/schema.prisma

# 2. Generate migration
npx prisma migrate dev --name add-new-field

# 3. Update TypeScript types
npx prisma generate

# 4. Update seed data if needed
vim prisma/seed.ts
npm run db:seed
```

### 3. Payment Integration Testing
```bash
# Use Stripe test cards for development
# Successful payment: 4242424242424242
# Declined payment: 4000000000000002
# 3D Secure: 4000002760003184

# PayPal sandbox credentials in .env
# Create test accounts at developer.paypal.com
```

## Core API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token

### Products
- `GET /api/products` - List products (with filtering)
- `GET /api/products/:id` - Get product details
- `GET /api/products/search/suggestions` - Search autocomplete

### Cart & Orders
- `GET /api/cart` - Get cart contents
- `POST /api/cart/items` - Add to cart
- `POST /api/orders` - Create order from cart
- `GET /api/orders` - List user orders

### Services & Bookings
- `GET /api/services` - List services
- `GET /api/services/:id/availability` - Check availability
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - List user bookings

### Payments
- `POST /api/payments/process` - Process payment
- `GET /api/payments/:id` - Get payment status
- `POST /api/webhooks/stripe` - Stripe webhooks

## Testing Strategy

### Unit Tests
```bash
# Backend unit tests (Jest)
npm run test:unit

# Frontend unit tests (Vitest)
cd frontend && npm run test:unit

# Test coverage
npm run test:coverage
```

### Integration Tests
```bash
# API integration tests
npm run test:integration

# Database integration tests
npm run test:db
```

### End-to-End Tests
```bash
# Cypress E2E tests
npm run test:e2e

# Specific test suites
npm run test:e2e:auth
npm run test:e2e:cart
npm run test:e2e:booking
```

## Common Development Tasks

### Adding a New Product Category
1. Update database schema: Add to `ProductCategory` enum
2. Update frontend: Add to category filter component
3. Update admin: Add to product management form
4. Add migration and seed data

### Adding a New Payment Method
1. Backend: Add payment provider service
2. Frontend: Add payment method component
3. Update checkout flow
4. Add webhook handling
5. Update tests and documentation

### Adding a New Service Type
1. Update service categories in database
2. Create service-specific booking form
3. Update availability calculation
4. Add admin management interface

## Deployment Commands

### Development Deployment
```bash
# Build and deploy to staging
npm run build
npm run deploy:staging

# Run database migrations on staging
npm run db:migrate:staging
```

### Production Deployment
```bash
# Build production bundles
npm run build:prod

# Deploy to production (CI/CD)
git tag v1.0.0
git push origin v1.0.0
```

## Troubleshooting

### Common Issues
1. **Database connection issues**: Check PostgreSQL is running and credentials
2. **Redis connection issues**: Ensure Redis server is started
3. **Payment webhook failures**: Check webhook URLs and signatures
4. **CORS issues**: Verify frontend/backend URL configuration

### Debug Commands
```bash
# Check service status
npm run status

# View logs
npm run logs

# Reset development database
npm run db:reset

# Clear Redis cache
npm run cache:clear
```

## Performance Optimization

### Database
- Add indexes for frequently queried fields
- Use database connection pooling
- Implement query caching for catalog data

### Frontend
- Implement lazy loading for product images
- Use virtual scrolling for large product lists
- Cache API responses in Redux/local storage

### Backend
- Implement Redis caching for product catalog
- Use background jobs for email notifications
- Optimize database queries with proper indexing

This quickstart guide provides the essential information needed to get the e-commerce platform up and running for development, with clear commands and workflows for common tasks.