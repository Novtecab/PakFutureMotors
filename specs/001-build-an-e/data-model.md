# Data Model: E-Commerce Platform

**Feature**: E-Commerce Platform for Cars and Services  
**Generated**: 2024-12-19  
**Phase**: 1 (Design)

## Entity Relationship Overview

```
User ──┐
       │
       ├──→ Order ────→ OrderItem ────→ Product
       │      │
       │      └────→ Payment
       │
       └──→ Booking ───→ Service
              │
              └────→ Payment

Admin ──→ manages ──→ Product, Service, User, Order, Booking
```

## Core Entities

### User
**Purpose**: Customer accounts and authentication
**Relationships**: One-to-many with Orders and Bookings

```typescript
interface User {
  id: string (UUID)
  email: string (unique, indexed)
  phone?: string (unique when present)
  password_hash?: string (nullable for social auth)
  first_name: string
  last_name: string
  avatar_url?: string
  
  // Authentication metadata
  email_verified: boolean
  phone_verified: boolean
  auth_providers: AuthProvider[] // email, google, facebook, phone
  
  // Account management
  created_at: timestamp
  updated_at: timestamp
  last_login: timestamp
  status: 'active' | 'suspended' | 'deleted'
  
  // Preferences
  newsletter_subscribed: boolean
  preferred_language: string (default 'en')
  
  // Address information
  addresses: Address[]
}

interface Address {
  id: string
  user_id: string (FK)
  type: 'billing' | 'shipping'
  street_address: string
  city: string
  state: string
  postal_code: string
  country: string
  is_default: boolean
}
```

### Product
**Purpose**: Cars and accessories for sale
**Relationships**: Many-to-many with Orders via OrderItem

```typescript
interface Product {
  id: string (UUID)
  sku: string (unique, indexed)
  name: string (indexed for search)
  description: text
  category: ProductCategory
  subcategory?: string
  
  // Pricing
  price: decimal(10,2)
  currency: string (default 'USD')
  sale_price?: decimal(10,2)
  
  // Inventory
  stock_quantity: integer
  low_stock_threshold: integer
  track_inventory: boolean
  
  // Media
  images: ProductImage[]
  documents: ProductDocument[] // specs, manuals
  
  // Metadata
  brand: string
  model?: string (for cars)
  year?: integer (for cars)
  specifications: Record<string, any> // JSON field
  
  // SEO and discovery
  slug: string (unique, URL-friendly)
  tags: string[]
  search_keywords: string[]
  
  // Management
  status: 'active' | 'inactive' | 'discontinued'
  featured: boolean
  created_at: timestamp
  updated_at: timestamp
  created_by: string (FK to admin user)
}

type ProductCategory = 'cars' | 'accessories' | 'parts' | 'tools'

interface ProductImage {
  id: string
  product_id: string (FK)
  url: string
  alt_text: string
  sort_order: integer
  is_primary: boolean
}
```

### Service
**Purpose**: Bookable automotive services
**Relationships**: One-to-many with Bookings

```typescript
interface Service {
  id: string (UUID)
  name: string
  description: text
  category: ServiceCategory
  
  // Pricing structure (base + add-ons)
  base_price: decimal(10,2)
  currency: string (default 'USD')
  add_ons: ServiceAddOn[]
  
  // Scheduling
  duration_hours: integer (default 1)
  advance_booking_days: integer (minimum notice)
  max_advance_booking_days: integer
  
  // Availability
  available_days: DayOfWeek[] // which days service is offered
  available_hours: TimeSlot[] // which hours each day
  max_daily_bookings: integer
  
  // Requirements
  preparation_instructions?: text
  requirements?: text // customer should bring, etc.
  
  // Management
  status: 'active' | 'inactive'
  featured: boolean
  created_at: timestamp
  updated_at: timestamp
  created_by: string (FK to admin user)
}

type ServiceCategory = 'detailing' | 'coating' | 'maintenance' | 'repair' | 'inspection'

interface ServiceAddOn {
  id: string
  name: string
  description: string
  price: decimal(10,2)
  required: boolean
}

interface TimeSlot {
  start_hour: integer (0-23)
  end_hour: integer (0-23)
}
```

### Order
**Purpose**: Product purchases
**Relationships**: Belongs to User, has many OrderItems, has one Payment

```typescript
interface Order {
  id: string (UUID)
  order_number: string (unique, human-readable)
  user_id: string (FK)
  
  // Order details
  items: OrderItem[]
  subtotal: decimal(10,2)
  tax_amount: decimal(10,2)
  shipping_amount: decimal(10,2)
  discount_amount: decimal(10,2)
  total_amount: decimal(10,2)
  currency: string
  
  // Fulfillment
  status: OrderStatus
  shipping_address: Address
  billing_address: Address
  shipping_method: string
  tracking_number?: string
  
  // Timestamps
  created_at: timestamp
  updated_at: timestamp
  shipped_at?: timestamp
  delivered_at?: timestamp
  
  // References
  payment_id?: string (FK)
  notes?: text (internal admin notes)
}

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

interface OrderItem {
  id: string
  order_id: string (FK)
  product_id: string (FK)
  quantity: integer
  unit_price: decimal(10,2) // price at time of order
  total_price: decimal(10,2)
  
  // Snapshot data (in case product changes)
  product_name: string
  product_sku: string
}
```

### Booking
**Purpose**: Service appointments
**Relationships**: Belongs to User and Service, has one Payment

```typescript
interface Booking {
  id: string (UUID)
  booking_number: string (unique, human-readable)
  user_id: string (FK)
  service_id: string (FK)
  
  // Appointment details
  scheduled_date: date
  scheduled_hour: integer (0-23)
  duration_hours: integer
  
  // Selected options
  selected_add_ons: BookingAddOn[]
  base_price: decimal(10,2)
  add_ons_total: decimal(10,2)
  total_amount: decimal(10,2)
  currency: string
  
  // Customer information
  vehicle_make?: string
  vehicle_model?: string
  vehicle_year?: integer
  special_instructions?: text
  
  // Status tracking
  status: BookingStatus
  created_at: timestamp
  updated_at: timestamp
  confirmed_at?: timestamp
  completed_at?: timestamp
  
  // References
  payment_id?: string (FK)
  notes?: text (internal admin notes)
}

type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

interface BookingAddOn {
  add_on_id: string
  name: string // snapshot
  price: decimal(10,2) // snapshot
}
```

### Payment
**Purpose**: Payment processing records
**Relationships**: Belongs to Order or Booking

```typescript
interface Payment {
  id: string (UUID)
  
  // Association (either order OR booking)
  order_id?: string (FK)
  booking_id?: string (FK)
  
  // Payment details
  amount: decimal(10,2)
  currency: string
  payment_method: PaymentMethod
  
  // Provider data
  provider: PaymentProvider
  provider_transaction_id?: string
  provider_fee?: decimal(10,2)
  
  // Status tracking
  status: PaymentStatus
  created_at: timestamp
  processed_at?: timestamp
  failed_at?: timestamp
  refunded_at?: timestamp
  
  // Failure handling
  failure_reason?: string
  retry_count: integer (default 0)
  
  // Customer data (encrypted/tokenized)
  billing_address: Address
  payment_metadata: Record<string, any> // provider-specific data
}

type PaymentMethod = 'credit_card' | 'debit_card' | 'paypal' | 'apple_pay' | 'google_pay' | 'bank_transfer'
type PaymentProvider = 'stripe' | 'paypal' | 'manual'
type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded'
```

### Cart (Session-based)
**Purpose**: Temporary shopping cart before order creation
**Storage**: Redis for performance, PostgreSQL for persistence

```typescript
interface Cart {
  id: string (UUID)
  user_id?: string (FK, nullable for guest carts)
  session_id: string (for guest users)
  
  items: CartItem[]
  subtotal: decimal(10,2) (calculated)
  expires_at: timestamp
  created_at: timestamp
  updated_at: timestamp
}

interface CartItem {
  product_id: string (FK)
  quantity: integer
  added_at: timestamp
}
```

## Indexes and Performance

### Critical Indexes
```sql
-- User lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;

-- Product search and filtering
CREATE INDEX idx_products_category ON products(category, status);
CREATE INDEX idx_products_search ON products USING gin(search_keywords);
CREATE INDEX idx_products_featured ON products(featured, status) WHERE featured = true;

-- Service availability
CREATE INDEX idx_services_category ON services(category, status);
CREATE INDEX idx_bookings_date_service ON bookings(service_id, scheduled_date, status);

-- Order management
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status, created_at);

-- Payment tracking
CREATE INDEX idx_payments_provider_transaction ON payments(provider, provider_transaction_id);
CREATE INDEX idx_payments_status_created ON payments(status, created_at);
```

### Data Integrity Constraints
- Prevent double-booking: UNIQUE constraint on (service_id, scheduled_date, scheduled_hour)
- Inventory tracking: CHECK constraint ensuring stock_quantity >= 0
- Payment amount validation: CHECK constraint ensuring amount > 0
- Status transitions: Database triggers for valid state changes

## Scalability Considerations

### Partitioning Strategy
- Orders: Partition by created_at (monthly)
- Bookings: Partition by scheduled_date (monthly)
- Payments: Partition by created_at (monthly)

### Caching Strategy
- Product catalog: Redis cache with 1-hour TTL
- Service availability: Redis cache with 15-minute TTL
- User sessions: Redis with configurable TTL
- Search results: Redis cache with 30-minute TTL

### Archive Strategy
- Orders older than 7 years: Move to archive tables
- Payments older than 10 years: Move to compliance archive
- User accounts: Soft delete with GDPR compliance (30-day retention after deletion request)