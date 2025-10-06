# API Contracts: Services & Bookings

## Service Catalog Endpoints

### GET /api/services
**Purpose**: List available services

**Query Parameters**:
```typescript
{
  category?: 'detailing' | 'coating' | 'maintenance' | 'repair' | 'inspection';
  featured?: boolean;
  available_date?: string; // ISO date, filter by services available on date
}
```

**Response**:
```typescript
{
  services: Service[];
}

interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  base_price: number;
  currency: string;
  duration_hours: number;
  add_ons: ServiceAddOn[];
  advance_booking_days: number;
  max_advance_booking_days: number;
  available_days: number[]; // 0=Sunday, 1=Monday, etc.
  available_hours: TimeSlot[];
  featured: boolean;
}

interface ServiceAddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  required: boolean;
}

interface TimeSlot {
  start_hour: number; // 0-23
  end_hour: number; // 0-23
}
```

### GET /api/services/:id
**Purpose**: Get service details

**Response**: Service object with additional fields:
```typescript
{
  // ... all Service fields from list
  preparation_instructions?: string;
  requirements?: string;
  max_daily_bookings: number;
}
```

### GET /api/services/:id/availability
**Purpose**: Check service availability for booking

**Query Parameters**:
```typescript
{
  date?: string; // ISO date, default: tomorrow
  days?: number; // number of days to check, default: 30, max: 90
}
```

**Response**:
```typescript
{
  service_id: string;
  availability: DayAvailability[];
}

interface DayAvailability {
  date: string; // ISO date
  available_slots: TimeSlot[];
  booked_slots: TimeSlot[];
  blocked_slots: TimeSlot[]; // admin-blocked or maintenance
}
```

## Booking Management Endpoints

### POST /api/bookings
**Purpose**: Create service booking
**Auth**: Required

**Request**:
```typescript
{
  service_id: string;
  scheduled_date: string; // ISO date
  scheduled_hour: number; // 0-23
  selected_add_ons: string[]; // array of add-on IDs
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  special_instructions?: string;
  payment_method: PaymentMethodRequest;
}

interface PaymentMethodRequest {
  type: 'credit_card' | 'paypal' | 'bank_transfer';
  // Payment method specific data (handled by payment processor)
  token?: string; // tokenized payment method
  billing_address: Address;
}
```

**Response**:
```typescript
{
  booking: {
    id: string;
    booking_number: string;
    service: Service;
    scheduled_date: string;
    scheduled_hour: number;
    duration_hours: number;
    selected_add_ons: BookingAddOn[];
    base_price: number;
    add_ons_total: number;
    total_amount: number;
    currency: string;
    status: 'pending' | 'confirmed';
    vehicle_info?: {
      make: string;
      model: string;
      year: number;
    };
    special_instructions?: string;
    created_at: string;
  };
  payment: {
    id: string;
    status: 'pending' | 'processing' | 'completed';
    amount: number;
    currency: string;
  };
}
```

### GET /api/bookings
**Purpose**: List user's bookings
**Auth**: Required

**Query Parameters**:
```typescript
{
  status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  from_date?: string; // ISO date
  to_date?: string; // ISO date
  page?: number;
  limit?: number;
}
```

**Response**:
```typescript
{
  bookings: Booking[];
  pagination: PaginationInfo;
}
```

### GET /api/bookings/:id
**Purpose**: Get booking details
**Auth**: Required (own bookings only)

**Response**:
```typescript
{
  id: string;
  booking_number: string;
  service: Service;
  scheduled_date: string;
  scheduled_hour: number;
  duration_hours: number;
  selected_add_ons: BookingAddOn[];
  base_price: number;
  add_ons_total: number;
  total_amount: number;
  currency: string;
  status: BookingStatus;
  vehicle_info?: VehicleInfo;
  special_instructions?: string;
  payment: PaymentInfo;
  status_history: StatusChange[];
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  completed_at?: string;
}

interface StatusChange {
  status: BookingStatus;
  changed_at: string;
  changed_by?: string; // user or admin ID
  notes?: string;
}
```

### PUT /api/bookings/:id
**Purpose**: Update booking (limited fields)
**Auth**: Required

**Request**:
```typescript
{
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  special_instructions?: string;
  // Only allowed for pending/confirmed bookings
  // Rescheduling requires cancellation + new booking
}
```

**Response**: Updated booking

### POST /api/bookings/:id/cancel
**Purpose**: Cancel booking
**Auth**: Required

**Request**:
```typescript
{
  reason?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  refund_info?: {
    amount: number;
    processing_time: string; // e.g., "3-5 business days"
    refund_method: string;
  };
}
```

## Admin Booking Management

### GET /api/admin/bookings
**Purpose**: List all bookings (admin view)
**Auth**: Admin required

**Query Parameters**: Same as user bookings plus:
```typescript
{
  user_id?: string;
  service_id?: string;
  // ... other admin filters
}
```

### PUT /api/admin/bookings/:id/status
**Purpose**: Update booking status
**Auth**: Admin required

**Request**:
```typescript
{
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
}
```

**Response**: Updated booking

### GET /api/admin/bookings/calendar
**Purpose**: Calendar view of bookings
**Auth**: Admin required

**Query Parameters**:
```typescript
{
  from_date: string; // ISO date
  to_date: string; // ISO date
  service_id?: string;
}
```

**Response**:
```typescript
{
  calendar_events: CalendarEvent[];
}

interface CalendarEvent {
  booking_id: string;
  booking_number: string;
  service_name: string;
  customer_name: string;
  scheduled_date: string;
  scheduled_hour: number;
  duration_hours: number;
  status: BookingStatus;
  total_amount: number;
}
```

## Service Management (Admin) Endpoints

### POST /api/admin/services
**Purpose**: Create new service
**Auth**: Admin required

**Request**: Service creation data
**Response**: Created service

### PUT /api/admin/services/:id
**Purpose**: Update service
**Auth**: Admin required

### DELETE /api/admin/services/:id
**Purpose**: Deactivate service
**Auth**: Admin required

### POST /api/admin/services/:id/block-time
**Purpose**: Block time slots for maintenance
**Auth**: Admin required

**Request**:
```typescript
{
  date: string; // ISO date
  start_hour: number;
  end_hour: number;
  reason: string;
}
```

## Error Responses

### Booking-Specific Error Codes
- `SERVICE_NOT_FOUND`: Service does not exist
- `SERVICE_UNAVAILABLE`: Service not available for booking
- `TIME_SLOT_UNAVAILABLE`: Requested time slot not available
- `BOOKING_NOT_FOUND`: Booking does not exist
- `BOOKING_NOT_CANCELLABLE`: Booking cannot be cancelled (too late/already completed)
- `INVALID_BOOKING_DATE`: Date is outside allowed booking window
- `PAYMENT_REQUIRED`: Payment must be processed before booking confirmation
- `VEHICLE_INFO_REQUIRED`: Vehicle information required for this service