/**
 * T007: Auth & Users Contract Tests
 * Tests all authentication flows and user management endpoints from auth-users.md
 */
import request from 'supertest';
import app from '../../src/app';

describe('Auth & Users Contract Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should register user with email/password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        first_name: 'John',
        last_name: 'Doe',
        auth_provider: 'email'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect('Content-Type', /json/);

      // Should return 201 for successful registration
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).toHaveProperty('first_name', userData.first_name);
      expect(response.body.user).toHaveProperty('last_name', userData.last_name);
      expect(response.body.user).not.toHaveProperty('password_hash');
      
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('access_token');
      expect(response.body.tokens).toHaveProperty('refresh_token');
      expect(response.body.tokens).toHaveProperty('expires_in');
    });

    it('should register user with phone/OTP', async () => {
      const userData = {
        phone: '+1234567890',
        first_name: 'Jane',
        last_name: 'Smith',
        auth_provider: 'phone',
        verification_code: '123456'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.phone).toBe(userData.phone);
    });

    it('should register user with social auth', async () => {
      const userData = {
        email: 'social@example.com',
        first_name: 'Social',
        last_name: 'User',
        auth_provider: 'google',
        social_token: 'mock_google_token'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'incomplete@example.com'
          // Missing first_name, last_name, auth_provider
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        first_name: 'John',
        last_name: 'Doe',
        auth_provider: 'email'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a test user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login@example.com',
          password: 'SecurePass123!',
          first_name: 'Login',
          last_name: 'Test',
          auth_provider: 'email'
        });
    });

    it('should login with email/password', async () => {
      const loginData = {
        credential: 'login@example.com',
        password: 'SecurePass123!',
        auth_provider: 'email'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          credential: 'login@example.com',
          password: 'WrongPassword',
          auth_provider: 'email'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          credential: 'nonexistent@example.com',
          password: 'AnyPassword',
          auth_provider: 'email'
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'refresh@example.com',
          password: 'SecurePass123!',
          first_name: 'Refresh',
          last_name: 'Test',
          auth_provider: 'email'
        });

      refreshToken = response.body.tokens.refresh_token;
    });

    it('should refresh access token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('expires_in');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: 'invalid_token' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/auth/logout', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logout@example.com',
          password: 'SecurePass123!',
          first_name: 'Logout',
          last_name: 'Test',
          auth_provider: 'email'
        });

      refreshToken = response.body.tokens.refresh_token;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refresh_token: refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/users/profile', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'profile@example.com',
          password: 'SecurePass123!',
          first_name: 'Profile',
          last_name: 'Test',
          auth_provider: 'email'
        });

      accessToken = response.body.tokens.access_token;
      userId = response.body.user.id;
    });

    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('email', 'profile@example.com');
      expect(response.body).toHaveProperty('first_name', 'Profile');
      expect(response.body).toHaveProperty('addresses');
      expect(response.body).toHaveProperty('preferences');
    });

    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .get('/api/users/profile');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('PUT /api/users/profile', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'update@example.com',
          password: 'SecurePass123!',
          first_name: 'Update',
          last_name: 'Test',
          auth_provider: 'email'
        });

      accessToken = response.body.tokens.access_token;
    });

    it('should update user profile', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Name',
        preferences: {
          newsletter_subscribed: true,
          preferred_language: 'es'
        }
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.first_name).toBe('Updated');
      expect(response.body.last_name).toBe('Name');
      expect(response.body.preferences.newsletter_subscribed).toBe(true);
      expect(response.body.preferences.preferred_language).toBe('es');
    });
  });

  describe('Address Management', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'address@example.com',
          password: 'SecurePass123!',
          first_name: 'Address',
          last_name: 'Test',
          auth_provider: 'email'
        });

      accessToken = response.body.tokens.access_token;
    });

    it('should add new address', async () => {
      const addressData = {
        type: 'shipping',
        street_address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        postal_code: '12345',
        country: 'US',
        is_default: true
      };

      const response = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(addressData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.street_address).toBe(addressData.street_address);
      expect(response.body.is_default).toBe(true);
    });

    it('should update address', async () => {
      // First create an address
      const createResponse = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'billing',
          street_address: '456 Oak Ave',
          city: 'Test City',
          state: 'NY',
          postal_code: '67890',
          country: 'US'
        });

      const addressId = createResponse.body.id;

      // Then update it
      const updateData = {
        street_address: '789 Pine St',
        city: 'Updated City'
      };

      const response = await request(app)
        .put(`/api/users/addresses/${addressId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.street_address).toBe('789 Pine St');
      expect(response.body.city).toBe('Updated City');
    });

    it('should delete address', async () => {
      // First create an address
      const createResponse = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'shipping',
          street_address: 'Delete Me St',
          city: 'Delete City',
          state: 'TX',
          postal_code: '00000',
          country: 'US'
        });

      const addressId = createResponse.body.id;

      // Then delete it
      const response = await request(app)
        .delete(`/api/users/addresses/${addressId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});