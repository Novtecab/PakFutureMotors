# API Contracts: Authentication & Users

## Authentication Endpoints

### POST /api/auth/register
**Purpose**: Register new user account

**Request**:
```typescript
{
  email: string;
  phone?: string;
  password?: string; // optional for social auth
  first_name: string;
  last_name: string;
  auth_provider: 'email' | 'google' | 'facebook' | 'phone';
  verification_code?: string; // for phone auth
  social_token?: string; // for social auth
}
```

**Response**:
```typescript
{
  success: boolean;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    email_verified: boolean;
    phone_verified: boolean;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
```

### POST /api/auth/login
**Purpose**: Authenticate user

**Request**:
```typescript
{
  credential: string; // email or phone
  password?: string;
  auth_provider: 'email' | 'google' | 'facebook' | 'phone';
  verification_code?: string; // for phone auth
  social_token?: string; // for social auth
}
```

**Response**: Same as register

### POST /api/auth/logout
**Purpose**: Invalidate user session

**Request**: 
```typescript
{
  refresh_token: string;
}
```

**Response**:
```typescript
{
  success: boolean;
}
```

### POST /api/auth/refresh
**Purpose**: Refresh access token

**Request**:
```typescript
{
  refresh_token: string;
}
```

**Response**:
```typescript
{
  access_token: string;
  expires_in: number;
}
```

## User Management Endpoints

### GET /api/users/profile
**Purpose**: Get current user profile
**Auth**: Required

**Response**:
```typescript
{
  id: string;
  email: string;
  phone?: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  addresses: Address[];
  preferences: {
    newsletter_subscribed: boolean;
    preferred_language: string;
  };
}
```

### PUT /api/users/profile
**Purpose**: Update user profile
**Auth**: Required

**Request**:
```typescript
{
  first_name?: string;
  last_name?: string;
  phone?: string;
  preferences?: {
    newsletter_subscribed?: boolean;
    preferred_language?: string;
  };
}
```

**Response**: Updated user profile (same as GET)

### POST /api/users/addresses
**Purpose**: Add new address
**Auth**: Required

**Request**:
```typescript
{
  type: 'billing' | 'shipping';
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default?: boolean;
}
```

**Response**:
```typescript
{
  id: string;
  // ... address fields
}
```

### PUT /api/users/addresses/:id
**Purpose**: Update address
**Auth**: Required

**Request**: Same as POST (all fields optional)
**Response**: Updated address

### DELETE /api/users/addresses/:id
**Purpose**: Delete address
**Auth**: Required

**Response**:
```typescript
{
  success: boolean;
}
```

## Error Responses

All endpoints may return these error formats:

```typescript
{
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### Common Error Codes
- `INVALID_CREDENTIALS`: Authentication failed
- `USER_NOT_FOUND`: User does not exist
- `EMAIL_ALREADY_EXISTS`: Email already registered
- `PHONE_ALREADY_EXISTS`: Phone already registered
- `INVALID_TOKEN`: JWT token invalid or expired
- `VALIDATION_ERROR`: Request validation failed
- `VERIFICATION_REQUIRED`: Email or phone verification needed