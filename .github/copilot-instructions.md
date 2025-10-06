# GitHub Copilot Instructions: PakFutureMotors E-Commerce Platform

## Project Context
You are working on **PakFutureMotors**, an e-commerce platform for car sales, car accessories, and automotive service bookings. This is a full-stack TypeScript application with React frontend and Express.js backend.

## Architecture Overview
- **Frontend**: React 18+ with TypeScript, state management via Redux Toolkit
- **Backend**: Express.js with TypeScript, PostgreSQL database, Redis caching
- **Authentication**: Multi-provider (email/password, social login, phone/OTP)
- **Payments**: Stripe (primary), PayPal (secondary), bank transfers
- **Services**: Hourly booking system with fixed time slots

## Code Style & Patterns

### TypeScript Standards
```typescript
// Use strict types, avoid 'any'
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

// Use enums for constants
enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped'
}

// Prefer interfaces over types for objects
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}
```

### React Component Patterns
```typescript
// Functional components with proper TypeScript
interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  // Component implementation
};

// Custom hooks for reusable logic
export const useCart = () => {
  const dispatch = useAppDispatch();
  const cart = useAppSelector(state => state.cart);
  
  const addToCart = useCallback((productId: string, quantity: number) => {
    dispatch(cartActions.addItem({ productId, quantity }));
  }, [dispatch]);
  
  return { cart, addToCart };
};
```

### Backend API Patterns
```typescript
// Express route handlers with proper typing
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const products = await productService.findMany({
      category: category as ProductCategory,
      search: search as string,
      pagination: { page: Number(page), limit: Number(limit) }
    });
    
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

// Service layer pattern
export class ProductService {
  async findMany(filters: ProductFilters): Promise<PaginatedResponse<Product>> {
    // Implementation with proper error handling
  }
}
```

## Database Patterns

### Prisma Schema Conventions
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  orders    Order[]
  bookings  Booking[]
  
  @@map("users")
}

model Product {
  id          String   @id @default(cuid())
  sku         String   @unique
  name        String
  description String   @db.Text
  price       Decimal  @db.Decimal(10, 2)
  
  @@index([category, status])
  @@map("products")
}
```

### Query Patterns
```typescript
// Use transactions for critical operations
export const createOrderWithPayment = async (orderData: CreateOrderData) => {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({ data: orderData });
    const payment = await tx.payment.create({ data: paymentData });
    await tx.cart.delete({ where: { userId: orderData.userId } });
    return { order, payment };
  });
};
```

## Authentication & Security

### JWT Implementation
```typescript
// Generate tokens with proper typing
interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export const generateTokens = (payload: TokenPayload) => {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: payload.userId }, REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};
```

### Input Validation
```typescript
// Use Zod for runtime type checking
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  category: z.enum(['cars', 'accessories', 'parts', 'tools']),
  stockQuantity: z.number().min(0).int()
});

export const validateCreateProduct = (data: unknown) => {
  return createProductSchema.parse(data);
};
```

## Payment Integration Patterns

### Stripe Integration
```typescript
// Payment processing with proper error handling
export const processStripePayment = async (paymentData: PaymentRequest) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paymentData.amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        orderId: paymentData.orderId,
        userId: paymentData.userId
      }
    });
    
    return { clientSecret: paymentIntent.client_secret };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeCardError) {
      throw new PaymentError('Card declined', error.code);
    }
    throw error;
  }
};
```

## State Management (Redux)

### Store Structure
```typescript
// Feature-based slices
interface AppState {
  auth: AuthState;
  products: ProductsState;
  cart: CartState;
  bookings: BookingsState;
  ui: UIState;
}

// Async thunks for API calls
export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (filters: ProductFilters, { rejectWithValue }) => {
    try {
      const response = await api.products.getAll(filters);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
```

## Error Handling

### Custom Error Classes
```typescript
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
```

### Error Middleware
```typescript
export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code
      }
    });
  } else {
    console.error(error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
};
```

## Testing Patterns

### Unit Tests (Jest)
```typescript
describe('ProductService', () => {
  describe('findMany', () => {
    it('should return paginated products', async () => {
      const mockProducts = [{ id: '1', name: 'Test Product' }];
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue(mockProducts);
      
      const result = await productService.findMany({});
      
      expect(result.data).toEqual(mockProducts);
      expect(prisma.product.findMany).toHaveBeenCalled();
    });
  });
});
```

### Frontend Tests (Vitest + Testing Library)
```typescript
describe('ProductCard', () => {
  it('should call onAddToCart when button is clicked', async () => {
    const mockProduct = { id: '1', name: 'Test Product', price: 100 };
    const mockAddToCart = vi.fn();
    
    render(<ProductCard product={mockProduct} onAddToCart={mockAddToCart} />);
    
    await user.click(screen.getByText('Add to Cart'));
    
    expect(mockAddToCart).toHaveBeenCalledWith('1');
  });
});
```

## Performance Optimization

### Database Optimization
```typescript
// Use select to limit fields
const products = await prisma.product.findMany({
  select: {
    id: true,
    name: true,
    price: true,
    images: { take: 1, orderBy: { sortOrder: 'asc' } }
  },
  where: { status: 'active' },
  take: 20,
  skip: (page - 1) * 20
});

// Use include strategically
const orderWithDetails = await prisma.order.findUnique({
  where: { id },
  include: {
    items: { include: { product: { select: { name: true, images: true } } } },
    payment: true
  }
});
```

### Caching Strategy
```typescript
// Redis caching for frequent queries
export const getCachedProducts = async (cacheKey: string, fetcher: () => Promise<Product[]>) => {
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const data = await fetcher();
  await redis.setex(cacheKey, 3600, JSON.stringify(data)); // 1 hour TTL
  return data;
};
```

## Key Business Logic

### Booking Availability
```typescript
// Check service availability with conflict detection
export const getAvailableSlots = async (serviceId: string, date: Date) => {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  const existingBookings = await prisma.booking.findMany({
    where: {
      serviceId,
      scheduledDate: date,
      status: { in: ['confirmed', 'in_progress'] }
    }
  });
  
  return service.availableHours.filter(slot => 
    !existingBookings.some(booking => booking.scheduledHour === slot.startHour)
  );
};
```

### Inventory Management
```typescript
// Atomic inventory updates
export const reserveInventory = async (items: CartItem[]) => {
  return await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stockQuantity: true }
      });
      
      if (product.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
      
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } }
      });
    }
  });
};
```

## Code Generation Guidelines

When generating code for this project:

1. **Always use TypeScript** with proper interfaces and types
2. **Follow the established patterns** shown above
3. **Include proper error handling** with custom error classes
4. **Add input validation** using Zod schemas
5. **Write tests** for business logic and API endpoints
6. **Use async/await** instead of promises chains
7. **Implement caching** for frequently accessed data
8. **Follow RESTful API conventions** for endpoint design
9. **Use database transactions** for operations affecting multiple tables
10. **Include proper JSDoc comments** for complex functions

## Dependencies Reference

### Backend Core
- `express` - Web framework
- `@prisma/client` - Database ORM
- `jsonwebtoken` - JWT authentication
- `bcryptjs` - Password hashing
- `zod` - Runtime type validation
- `stripe` - Payment processing
- `nodemailer` - Email sending
- `redis` - Caching

### Frontend Core
- `react` - UI framework
- `@reduxjs/toolkit` - State management
- `react-router-dom` - Routing
- `@stripe/stripe-js` - Payment UI
- `axios` - HTTP client
- `react-hook-form` - Form handling
- `@headlessui/react` - Accessible components

Always prefer these established dependencies over alternatives unless there's a specific technical requirement.