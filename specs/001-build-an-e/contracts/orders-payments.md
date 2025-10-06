# API Contracts: Orders & Payments

## Order Management Endpoints

### POST /api/orders
**Purpose**: Create order from cart
**Auth**: Required

**Request**:
```typescript
{
  cart_id?: string; // optional, uses current user cart if not provided
  shipping_address_id: string; // user's address ID
  billing_address_id: string; // user's address ID
  shipping_method: string; // e.g., "standard", "express", "pickup"
  payment_method: PaymentMethodRequest;
  notes?: string; // customer notes
}

interface PaymentMethodRequest {
  type: 'credit_card' | 'debit_card' | 'paypal' | 'apple_pay' | 'google_pay' | 'bank_transfer';
  token?: string; // tokenized payment method from frontend
  billing_address: Address;
  // Additional payment-specific fields handled by payment processor
}
```

**Response**:
```typescript
{
  order: {
    id: string;
    order_number: string;
    items: OrderItem[];
    subtotal: number;
    tax_amount: number;
    shipping_amount: number;
    discount_amount: number;
    total_amount: number;
    currency: string;
    status: 'pending';
    shipping_address: Address;
    billing_address: Address;
    shipping_method: string;
    created_at: string;
  };
  payment: {
    id: string;
    status: 'pending' | 'processing';
    amount: number;
    currency: string;
    payment_method: string;
  };
}

interface OrderItem {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string;
    images: ProductImage[];
  };
  quantity: number;
  unit_price: number;
  total_price: number;
}
```

### GET /api/orders
**Purpose**: List user's orders
**Auth**: Required

**Query Parameters**:
```typescript
{
  status?: OrderStatus;
  from_date?: string; // ISO date
  to_date?: string; // ISO date
  page?: number;
  limit?: number;
}
```

**Response**:
```typescript
{
  orders: Order[];
  pagination: PaginationInfo;
}
```

### GET /api/orders/:id
**Purpose**: Get order details
**Auth**: Required (own orders only)

**Response**:
```typescript
{
  id: string;
  order_number: string;
  items: OrderItem[];
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  status: OrderStatus;
  shipping_address: Address;
  billing_address: Address;
  shipping_method: string;
  tracking_number?: string;
  payment: PaymentInfo;
  status_history: StatusChange[];
  created_at: string;
  updated_at: string;
  shipped_at?: string;
  delivered_at?: string;
}

interface PaymentInfo {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: PaymentStatus;
  processed_at?: string;
  provider_fee?: number;
}
```

### POST /api/orders/:id/cancel
**Purpose**: Cancel order (if not yet shipped)
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
  refund_info?: RefundInfo;
}

interface RefundInfo {
  amount: number;
  processing_time: string;
  refund_method: string;
  expected_date: string;
}
```

## Payment Processing Endpoints

### POST /api/payments/process
**Purpose**: Process payment for order or booking
**Auth**: Required

**Request**:
```typescript
{
  order_id?: string; // either order_id OR booking_id
  booking_id?: string;
  payment_method: PaymentMethodRequest;
  return_url?: string; // for redirect-based payments
  webhook_url?: string; // for async notifications
}
```

**Response**:
```typescript
{
  payment: {
    id: string;
    status: 'pending' | 'processing' | 'requires_action';
    amount: number;
    currency: string;
    payment_method: string;
  };
  next_action?: {
    type: 'redirect' | '3d_secure' | 'verify_microdeposits';
    url?: string;
    instructions?: string;
  };
}
```

### GET /api/payments/:id
**Purpose**: Get payment status
**Auth**: Required

**Response**:
```typescript
{
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: PaymentStatus;
  created_at: string;
  processed_at?: string;
  failed_at?: string;
  failure_reason?: string;
  provider_transaction_id?: string;
  order_id?: string;
  booking_id?: string;
}
```

### POST /api/payments/:id/retry
**Purpose**: Retry failed payment
**Auth**: Required

**Request**:
```typescript
{
  payment_method?: PaymentMethodRequest; // optional, use new payment method
}
```

**Response**: Same as process payment

### POST /api/payments/:id/refund
**Purpose**: Request refund (admin or automated)
**Auth**: Admin required (or automated for cancellations)

**Request**:
```typescript
{
  amount?: number; // partial refund amount, defaults to full amount
  reason: string;
}
```

**Response**:
```typescript
{
  refund: {
    id: string;
    payment_id: string;
    amount: number;
    currency: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    reason: string;
    expected_date: string;
    created_at: string;
  };
}
```

## Webhook Endpoints (for payment providers)

### POST /api/webhooks/stripe
**Purpose**: Handle Stripe webhook events

### POST /api/webhooks/paypal
**Purpose**: Handle PayPal webhook events

## Admin Order Management

### GET /api/admin/orders
**Purpose**: List all orders (admin view)
**Auth**: Admin required

**Query Parameters**: Extended filtering options:
```typescript
{
  status?: OrderStatus;
  user_id?: string;
  payment_status?: PaymentStatus;
  from_date?: string;
  to_date?: string;
  min_amount?: number;
  max_amount?: number;
  shipping_method?: string;
  page?: number;
  limit?: number;
  sort?: 'created_desc' | 'amount_desc' | 'status';
}
```

### PUT /api/admin/orders/:id/status
**Purpose**: Update order status
**Auth**: Admin required

**Request**:
```typescript
{
  status: OrderStatus;
  tracking_number?: string; // for shipped status
  notes?: string;
  notify_customer?: boolean; // send email notification
}
```

### GET /api/admin/orders/analytics
**Purpose**: Order analytics dashboard
**Auth**: Admin required

**Query Parameters**:
```typescript
{
  period: 'today' | 'week' | 'month' | 'quarter' | 'year';
  from_date?: string;
  to_date?: string;
}
```

**Response**:
```typescript
{
  summary: {
    total_orders: number;
    total_revenue: number;
    average_order_value: number;
    pending_orders: number;
    shipped_orders: number;
    delivered_orders: number;
  };
  trends: {
    daily_orders: { date: string; count: number; revenue: number }[];
    top_products: { product_id: string; name: string; quantity_sold: number; revenue: number }[];
    payment_methods: { method: string; count: number; percentage: number }[];
  };
}
```

## Shipping & Tax Calculation

### POST /api/shipping/calculate
**Purpose**: Calculate shipping costs
**Auth**: Optional (for cart preview)

**Request**:
```typescript
{
  items: { product_id: string; quantity: number }[];
  shipping_address: Address;
  shipping_method?: string;
}
```

**Response**:
```typescript
{
  shipping_options: {
    method: string;
    name: string;
    cost: number;
    estimated_days: number;
    description: string;
  }[];
  tax_calculation: {
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
  };
}
```

## Error Responses

### Order-Specific Error Codes
- `ORDER_NOT_FOUND`: Order does not exist
- `ORDER_NOT_CANCELLABLE`: Order cannot be cancelled (already shipped)
- `PAYMENT_FAILED`: Payment processing failed
- `INSUFFICIENT_INVENTORY`: One or more items out of stock
- `INVALID_SHIPPING_ADDRESS`: Shipping address validation failed
- `INVALID_PAYMENT_METHOD`: Payment method invalid or expired
- `ORDER_ALREADY_PAID`: Attempt to pay for already paid order
- `REFUND_NOT_ALLOWED`: Refund not permitted for this payment
- `WEBHOOK_VERIFICATION_FAILED`: Webhook signature verification failed