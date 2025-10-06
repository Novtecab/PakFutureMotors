# Tasks: E-Commerce Platform for Cars and Services

**Input**: Design documents from `/workspaces/PakFutureMotors/specs/001-build-an-e/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓)

## Execution Summary

**Tech Stack**: TypeScript, React 18+, Express.js, PostgreSQL, Redis, Stripe/PayPal
**Project Type**: Web application (frontend + backend + database)
**Core Entities**: User, Product, Service, Order, Booking, Payment, Cart
**API Contracts**: 4 contract files covering authentication, products, services, payments
**Testing Strategy**: TDD with Jest/Vitest, contract tests, E2E with Cypress

## Task Dependency Graph

```
Setup (T001-T006) 
    ↓
Tests (T007-T018) [P] ← Must complete before implementation
    ↓
Database & Models (T019-T026) [P]
    ↓
Core Services (T027-T034)
    ↓
API Endpoints (T035-T050)
    ↓
Frontend Core (T051-T062) [P]
    ↓
Integration & Polish (T063-T070)
```

## Phase 3.1: Project Setup

### T001 Create monorepo project structure ✅
**Files**: `/backend/`, `/frontend/`, `/shared/`, `/docs/`, `/infrastructure/`
```bash
mkdir -p backend/src/{controllers,models,services,middleware,routes,utils,types}
mkdir -p backend/{prisma,tests}
mkdir -p frontend/src/{components,pages,hooks,services,store,types,utils}
mkdir -p frontend/{public,tests}
mkdir -p shared/{types,utils}
mkdir -p docs/{api,deployment,development}
mkdir -p infrastructure/{docker,k8s,terraform}
```

### T002 Initialize backend TypeScript project ✅
**Files**: `/backend/package.json`, `/backend/tsconfig.json`
**Dependencies**: express, prisma, bcryptjs, jsonwebtoken, zod, stripe, redis, nodemailer
```bash
cd backend && npm init -y
npm install express @types/express typescript ts-node-dev
npm install prisma @prisma/client bcryptjs @types/bcryptjs
npm install jsonwebtoken @types/jsonwebtoken zod stripe redis nodemailer
npm install --save-dev jest @types/jest supertest @types/supertest
```

### T003 Initialize frontend React project ✅
**Files**: `/frontend/package.json`, `/frontend/vite.config.ts`
**Dependencies**: react, redux-toolkit, react-router-dom, axios, stripe-js
```bash
cd frontend && npm create vite@latest . -- --template react-ts
npm install @reduxjs/toolkit react-redux react-router-dom
npm install axios @stripe/stripe-js @stripe/react-stripe-js
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

### T004 [P] Configure database schema ✅
**Files**: `/backend/prisma/schema.prisma`
**Content**: Complete Prisma schema from data-model.md with 7 entities and relationships

### T005 [P] Configure development environment ✅
**Files**: `/backend/.env.example`, `/frontend/.env.example`, `/.gitignore`
**Content**: Environment variables for database, Redis, Stripe, social auth, file storage

### T006 [P] Setup linting and formatting ✅
**Files**: `/.eslintrc.js`, `/.prettierrc`, `/backend/.eslintrc.js`, `/frontend/.eslintrc.js`
**Content**: TypeScript ESLint rules, Prettier configuration, consistent code style

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### Contract Tests [P] - Can run in parallel

### T007 [P] Auth & Users contract tests ✅
**Files**: `/backend/tests/contracts/auth-users.test.ts`
**Endpoints**: POST /api/auth/register, /login, /logout, /refresh, GET/PUT /api/users/profile
**Content**: Test all authentication flows and user management endpoints from auth-users.md

### T008 [P] Products & Cart contract tests ✅  
**Files**: `/backend/tests/contracts/products-cart.test.ts`
**Endpoints**: GET /api/products, /api/cart, POST /api/cart/items, DELETE /api/cart/items
**Content**: Test product catalog, search, cart operations from products-cart.md

### T009 [P] Services & Bookings contract tests ✅
**Files**: `/backend/tests/contracts/services-bookings.test.ts` 
**Endpoints**: GET /api/services, /api/services/:id/availability, POST /api/bookings
**Content**: Test service listings, availability checking, booking creation from services-bookings.md

### T010 [P] Orders & Payments contract tests ✅
**Files**: `/backend/tests/contracts/orders-payments.test.ts`
**Endpoints**: POST /api/orders, /api/payments/process, GET /api/orders, /api/payments
**Content**: Test order creation, payment processing, order management from orders-payments.md

### Integration Test Scenarios [P] - Can run in parallel

### T011 [P] User registration and authentication flow ✅
**Files**: `/backend/tests/integration/auth-flow.test.ts`
**Scenario**: Complete user journey from registration through login with all auth methods

### T012 [P] Product browsing and cart management flow ✅
**Files**: `/backend/tests/integration/shopping-flow.test.ts`
**Scenario**: Browse products, add to cart, modify quantities, cart persistence

### T013 [P] Service booking complete flow ✅
**Files**: `/backend/tests/integration/booking-flow.test.ts`
**Scenario**: Browse services, check availability, create booking, payment processing

### T014 [P] Order processing complete flow ✅
**Files**: `/backend/tests/integration/order-flow.test.ts`
**Scenario**: Cart to order conversion, payment processing, order status updates

### Frontend Component Tests [P] - Can run in parallel

### T015 [P] Authentication components tests ✅
**Files**: `/frontend/tests/components/auth.test.tsx`
**Components**: LoginForm, RegisterForm, AuthProvider, ProtectedRoute

### T016 [P] Product catalog components tests
**Files**: `/frontend/tests/components/products.test.tsx`
**Components**: ProductCard, ProductList, SearchBar, CategoryFilter

### T017 [P] Shopping cart components tests
**Files**: `/frontend/tests/components/cart.test.tsx`
**Components**: CartItem, CartSummary, CartDropdown, CheckoutButton

### T018 [P] Service booking components tests
**Files**: `/frontend/tests/components/booking.test.tsx`
**Components**: ServiceCard, AvailabilityCalendar, BookingForm, BookingConfirmation

## Phase 3.3: Database & Models ⚠️ REQUIRES TESTS FROM 3.2

### Database Setup & Models [P] - Can run in parallel (different entities)

### T019 [P] User model and authentication ✅
**Files**: `/backend/src/models/User.ts`, `/backend/src/models/Address.ts`
**Content**: User entity with multi-auth support, address management, validation

### T020 [P] Product model and catalog ✅
**Files**: `/backend/src/models/Product.ts`, `/backend/src/models/ProductImage.ts`  
**Content**: Product entity with categories, inventory tracking, media management

### T021 [P] Service model and scheduling ✅
**Files**: `/backend/src/models/Service.ts`, `/backend/src/models/ServiceAddOn.ts`
**Content**: Service entity with pricing structure, availability, add-ons

### T022 [P] Order model and processing ✅
**Files**: `/backend/src/models/Order.ts`, `/backend/src/models/OrderItem.ts`
**Content**: Order entity with items, status tracking, fulfillment

### T023 [P] Booking model and appointments
**Files**: `/backend/src/models/Booking.ts`, `/backend/src/models/BookingAddOn.ts`
**Content**: Booking entity with scheduling, vehicle info, status tracking

### T024 [P] Payment model and transactions
**Files**: `/backend/src/models/Payment.ts`
**Content**: Payment entity with provider integration, status tracking, refunds

### T025 [P] Cart model and session management ✅
**Files**: `/backend/src/models/Cart.ts`, `/backend/src/models/CartItem.ts`
**Content**: Cart entity with Redis integration, expiration, guest support

### T026 Database migrations and seeding
**Files**: `/backend/prisma/migrations/`, `/backend/prisma/seed.ts`
**Content**: Initial migration, seed data for products, services, test users

## Phase 3.4: Core Services ⚠️ REQUIRES MODELS FROM 3.3

### T027 Authentication service
**Files**: `/backend/src/services/AuthService.ts`
**Content**: JWT handling, password hashing, social auth integration, session management

### T028 User management service
**Files**: `/backend/src/services/UserService.ts`
**Content**: User CRUD, profile management, address handling, preferences

### T029 Product catalog service
**Files**: `/backend/src/services/ProductService.ts` 
**Content**: Product search, filtering, inventory management, catalog operations

### T030 Shopping cart service
**Files**: `/backend/src/services/CartService.ts`
**Content**: Cart operations, guest/user merge, persistence, expiration handling

### T031 Service booking service
**Files**: `/backend/src/services/BookingService.ts`
**Content**: Availability checking, conflict resolution, appointment scheduling

### T032 Order processing service
**Files**: `/backend/src/services/OrderService.ts`
**Content**: Order creation, status management, inventory reservation, fulfillment

### T033 Payment processing service
**Files**: `/backend/src/services/PaymentService.ts`
**Content**: Stripe/PayPal integration, webhook handling, refund processing

### T034 Email notification service
**Files**: `/backend/src/services/EmailService.ts`
**Content**: Order confirmations, booking reminders, password resets, templates

## Phase 3.5: API Endpoints ⚠️ REQUIRES SERVICES FROM 3.4

### Authentication & User Routes

### T035 Authentication endpoints
**Files**: `/backend/src/routes/auth.ts`, `/backend/src/controllers/AuthController.ts`
**Endpoints**: /api/auth/register, /login, /logout, /refresh from auth-users.md

### T036 User management endpoints
**Files**: `/backend/src/routes/users.ts`, `/backend/src/controllers/UserController.ts`
**Endpoints**: /api/users/profile, /addresses from auth-users.md

### Product & Cart Routes

### T037 Product catalog endpoints
**Files**: `/backend/src/routes/products.ts`, `/backend/src/controllers/ProductController.ts`
**Endpoints**: /api/products, /api/products/:id, /api/products/search from products-cart.md

### T038 Shopping cart endpoints
**Files**: `/backend/src/routes/cart.ts`, `/backend/src/controllers/CartController.ts`
**Endpoints**: /api/cart, /api/cart/items, /api/cart/merge from products-cart.md

### Service & Booking Routes

### T039 Service catalog endpoints
**Files**: `/backend/src/routes/services.ts`, `/backend/src/controllers/ServiceController.ts`
**Endpoints**: /api/services, /api/services/:id, /api/services/:id/availability from services-bookings.md

### T040 Booking management endpoints  
**Files**: `/backend/src/routes/bookings.ts`, `/backend/src/controllers/BookingController.ts`
**Endpoints**: /api/bookings, /api/bookings/:id, /api/bookings/:id/cancel from services-bookings.md

### Order & Payment Routes

### T041 Order processing endpoints
**Files**: `/backend/src/routes/orders.ts`, `/backend/src/controllers/OrderController.ts`
**Endpoints**: /api/orders, /api/orders/:id, /api/orders/:id/cancel from orders-payments.md

### T042 Payment processing endpoints
**Files**: `/backend/src/routes/payments.ts`, `/backend/src/controllers/PaymentController.ts`
**Endpoints**: /api/payments/process, /api/payments/:id, /api/payments/:id/retry from orders-payments.md

### T043 Webhook endpoints
**Files**: `/backend/src/routes/webhooks.ts`, `/backend/src/controllers/WebhookController.ts`
**Endpoints**: /api/webhooks/stripe, /api/webhooks/paypal for payment confirmations

### Admin Routes

### T044 Admin product management
**Files**: `/backend/src/routes/admin/products.ts`, `/backend/src/controllers/admin/ProductAdminController.ts`
**Endpoints**: Admin CRUD for products, inventory management, media upload

### T045 Admin service management
**Files**: `/backend/src/routes/admin/services.ts`, `/backend/src/controllers/admin/ServiceAdminController.ts`
**Endpoints**: Admin CRUD for services, schedule management, pricing

### T046 Admin order management
**Files**: `/backend/src/routes/admin/orders.ts`, `/backend/src/controllers/admin/OrderAdminController.ts`
**Endpoints**: Order status updates, tracking, analytics from orders-payments.md

### T047 Admin booking management
**Files**: `/backend/src/routes/admin/bookings.ts`, `/backend/src/controllers/admin/BookingAdminController.ts`
**Endpoints**: Booking status updates, calendar view, customer management

### Middleware & Integration

### T048 Authentication middleware
**Files**: `/backend/src/middleware/auth.ts`, `/backend/src/middleware/admin.ts`
**Content**: JWT validation, role-based access control, session handling

### T049 Validation middleware
**Files**: `/backend/src/middleware/validation.ts`
**Content**: Zod schema validation, request sanitization, error formatting

### T050 Error handling middleware
**Files**: `/backend/src/middleware/errorHandler.ts`, `/backend/src/utils/errors.ts`
**Content**: Custom error classes, error responses, logging integration

## Phase 3.6: Frontend Core ⚠️ REQUIRES API FROM 3.5

### State Management & API [P] - Can run in parallel

### T051 [P] Redux store setup
**Files**: `/frontend/src/store/index.ts`, `/frontend/src/store/rootReducer.ts`
**Content**: Store configuration, middleware setup, type-safe hooks

### T052 [P] Authentication state management
**Files**: `/frontend/src/store/slices/authSlice.ts`, `/frontend/src/hooks/useAuth.ts`
**Content**: Auth state, login/logout actions, token management, protected routes

### T053 [P] Product catalog state management
**Files**: `/frontend/src/store/slices/productsSlice.ts`, `/frontend/src/hooks/useProducts.ts`
**Content**: Product listing, search, filtering, pagination state

### T054 [P] Shopping cart state management
**Files**: `/frontend/src/store/slices/cartSlice.ts`, `/frontend/src/hooks/useCart.ts`
**Content**: Cart operations, item management, checkout state

### T055 [P] Service booking state management
**Files**: `/frontend/src/store/slices/bookingsSlice.ts`, `/frontend/src/hooks/useBookings.ts`
**Content**: Service listings, availability, booking flow state

### T056 [P] API client services
**Files**: `/frontend/src/services/api.ts`, `/frontend/src/services/{auth,products,cart,bookings,orders}.ts`
**Content**: Axios configuration, API endpoints, error handling, interceptors

### Core Components [P] - Can run in parallel

### T057 [P] Authentication components
**Files**: `/frontend/src/components/auth/`, `/frontend/src/pages/auth/`
**Components**: LoginForm, RegisterForm, ProtectedRoute, AuthProvider, social login buttons

### T058 [P] Product catalog components
**Files**: `/frontend/src/components/products/`, `/frontend/src/pages/products/`
**Components**: ProductCard, ProductList, ProductDetail, SearchBar, CategoryFilter, Pagination

### T059 [P] Shopping cart components
**Files**: `/frontend/src/components/cart/`, `/frontend/src/pages/cart/`
**Components**: CartItem, CartSummary, CartDrawer, CheckoutPage, AddToCartButton

### T060 [P] Service booking components
**Files**: `/frontend/src/components/booking/`, `/frontend/src/pages/booking/`
**Components**: ServiceCard, AvailabilityCalendar, BookingForm, BookingConfirmation, VehicleInfoForm

### T061 [P] Payment components
**Files**: `/frontend/src/components/payment/`
**Components**: StripeCheckout, PayPalButton, PaymentMethodSelector, PaymentForm

### T062 [P] Layout and navigation
**Files**: `/frontend/src/components/layout/`, `/frontend/src/components/navigation/`
**Components**: Header, Footer, Sidebar, NavBar, BreadcrumbNav, MobileMenu

## Phase 3.7: Integration & Polish

### T063 Payment gateway integration
**Files**: `/backend/src/integrations/stripe.ts`, `/backend/src/integrations/paypal.ts`
**Content**: Payment processing, webhook verification, refund handling, error management

### T064 File upload and storage
**Files**: `/backend/src/services/FileService.ts`, `/backend/src/middleware/upload.ts`
**Content**: AWS S3 integration, image processing, secure uploads, file validation

### T065 Email templates and notifications
**Files**: `/backend/src/templates/`, `/backend/src/services/EmailService.ts`
**Content**: HTML email templates, notification triggers, template rendering

### T066 Frontend routing and navigation
**Files**: `/frontend/src/routes/`, `/frontend/src/App.tsx`
**Content**: React Router setup, route guards, lazy loading, 404 handling

### T067 Error boundaries and handling
**Files**: `/frontend/src/components/ErrorBoundary.tsx`, `/frontend/src/utils/errorHandling.ts`
**Content**: Error boundaries, toast notifications, user-friendly error messages

### T068 Performance optimization
**Files**: Cache implementation, image optimization, bundle splitting
**Content**: Redis caching, image compression, code splitting, lazy loading

### T069 Security implementation
**Files**: Rate limiting, CORS, helmet, input sanitization
**Content**: Security headers, rate limiting, CORS configuration, XSS protection

### T070 Documentation and deployment
**Files**: `/docs/api/`, `docker-compose.yml`, deployment scripts
**Content**: API documentation, Docker configuration, deployment guides

## Parallel Execution Examples

### Phase 3.2 Tests (All parallel)
```bash
# Can run simultaneously - different test files
npm run test T007 T008 T009 T010 &
npm run test T011 T012 T013 T014 &
npm run test T015 T016 T017 T018 &
wait
```

### Phase 3.3 Models (All parallel)  
```bash
# Can run simultaneously - different entity files
code T019 T020 T021 T022 T023 T024 T025 &
npm run db:migrate T026 &
wait
```

### Phase 3.6 Frontend (Parallel by feature)
```bash
# State management tasks
code T051 T052 T053 T054 T055 T056 &
# Component tasks  
code T057 T058 T059 T060 T061 T062 &
wait
```

## Validation Checklist

- [ ] All contract endpoints have tests (T007-T010)
- [ ] All entities have models (T019-T025)
- [ ] All API endpoints implemented (T035-T047)
- [ ] All core UI components built (T057-T062)
- [ ] Payment integration working (T063)
- [ ] File upload functional (T064)
- [ ] Email notifications working (T065)
- [ ] Security measures implemented (T069)

## Ready for Implementation

**Total Tasks**: 70 numbered tasks
**Estimated Timeline**: 8-12 weeks with 2-3 developers
**Parallel Opportunities**: 35+ tasks marked [P] for concurrent execution
**Critical Path**: Setup → Tests → Models → Services → APIs → Frontend → Integration

Execute tasks in dependency order, leveraging parallel execution for maximum efficiency.