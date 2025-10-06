/**
 * T011: User registration and authentication flow integration test
 * Complete user journey from registration through login with all auth methods
 */
import request from 'supertest';
import app from '../../src/app';

describe('Authentication Flow Integration Tests', () => {
  describe('Complete Email Authentication Flow', () => {
    const testUser = {
      email: 'integration@example.com',
      password: 'SecurePass123!',
      first_name: 'Integration',
      last_name: 'Test',
      auth_provider: 'email'
    };

    it('should complete full email authentication journey', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.user.email).toBe(testUser.email);
      expect(registerResponse.body.tokens).toHaveProperty('access_token');
      expect(registerResponse.body.tokens).toHaveProperty('refresh_token');

      const { access_token, refresh_token } = registerResponse.body.tokens;
      const userId = registerResponse.body.user.id;

      // Step 2: Access protected resource with token
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${access_token}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.id).toBe(userId);
      expect(profileResponse.body.email).toBe(testUser.email);

      // Step 3: Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .send({ refresh_token });

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      // Step 4: Verify token is invalidated
      const invalidTokenResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${access_token}`);

      expect(invalidTokenResponse.status).toBe(401);

      // Step 5: Login with credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          credential: testUser.email,
          password: testUser.password,
          auth_provider: 'email'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.tokens).toHaveProperty('access_token');

      // Step 6: Refresh token flow
      const newRefreshToken = loginResponse.body.tokens.refresh_token;
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: newRefreshToken });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body).toHaveProperty('access_token');
      expect(refreshResponse.body).toHaveProperty('expires_in');
    });
  });

  describe('Phone Authentication Flow', () => {
    const phoneUser = {
      phone: '+1234567890',
      first_name: 'Phone',
      last_name: 'User',
      auth_provider: 'phone',
      verification_code: '123456'
    };

    it('should complete phone authentication journey', async () => {
      // Step 1: Register with phone
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(phoneUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user.phone).toBe(phoneUser.phone);
      expect(registerResponse.body.user.phone_verified).toBe(true);

      const userId = registerResponse.body.user.id;

      // Step 2: Login with phone/OTP
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          credential: phoneUser.phone,
          auth_provider: 'phone',
          verification_code: '123456'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.id).toBe(userId);
    });
  });

  describe('Social Authentication Flow', () => {
    const socialUser = {
      email: 'social@example.com',
      first_name: 'Social',
      last_name: 'User',
      auth_provider: 'google',
      social_token: 'mock_google_token_12345'
    };

    it('should complete social authentication journey', async () => {
      // Step 1: Register with social provider
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(socialUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user.email).toBe(socialUser.email);
      expect(registerResponse.body.user.auth_providers).toContain('google');

      const userId = registerResponse.body.user.id;

      // Step 2: Login with social token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          credential: socialUser.email,
          auth_provider: 'google',
          social_token: 'mock_google_token_12345'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.id).toBe(userId);
    });
  });

  describe('Multi-Provider User Flow', () => {
    it('should handle user with multiple auth providers', async () => {
      const baseUser = {
        email: 'multi@example.com',
        password: 'SecurePass123!',
        first_name: 'Multi',
        last_name: 'Provider',
        auth_provider: 'email'
      };

      // Step 1: Register with email
      const emailRegister = await request(app)
        .post('/api/auth/register')
        .send(baseUser);

      expect(emailRegister.status).toBe(201);
      const userId = emailRegister.body.user.id;
      const accessToken = emailRegister.body.tokens.access_token;

      // Step 2: Add phone to existing account
      const addPhoneResponse = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phone: '+1987654321'
        });

      expect(addPhoneResponse.status).toBe(200);
      expect(addPhoneResponse.body.phone).toBe('+1987654321');

      // Step 3: Login with email
      const emailLogin = await request(app)
        .post('/api/auth/login')
        .send({
          credential: baseUser.email,
          password: baseUser.password,
          auth_provider: 'email'
        });

      expect(emailLogin.status).toBe(200);
      expect(emailLogin.body.user.id).toBe(userId);

      // Step 4: Login with phone (after verification)
      const phoneLogin = await request(app)
        .post('/api/auth/login')
        .send({
          credential: '+1987654321',
          auth_provider: 'phone',
          verification_code: '123456'
        });

      expect(phoneLogin.status).toBe(200);
      expect(phoneLogin.body.user.id).toBe(userId);
    });
  });

  describe('Profile Management Flow', () => {
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

    it('should complete profile management journey', async () => {
      // Step 1: Get initial profile
      const getProfile = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getProfile.status).toBe(200);
      expect(getProfile.body.addresses).toHaveLength(0);

      // Step 2: Add shipping address
      const addShipping = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'shipping',
          street_address: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          postal_code: '12345',
          country: 'US',
          is_default: true
        });

      expect(addShipping.status).toBe(201);
      const shippingId = addShipping.body.id;

      // Step 3: Add billing address
      const addBilling = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'billing',
          street_address: '456 Oak Ave',
          city: 'Business City',
          state: 'NY',
          postal_code: '67890',
          country: 'US'
        });

      expect(addBilling.status).toBe(201);
      const billingId = addBilling.body.id;

      // Step 4: Update profile with preferences
      const updateProfile = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          first_name: 'Updated',
          preferences: {
            newsletter_subscribed: true,
            preferred_language: 'es'
          }
        });

      expect(updateProfile.status).toBe(200);
      expect(updateProfile.body.first_name).toBe('Updated');
      expect(updateProfile.body.preferences.newsletter_subscribed).toBe(true);

      // Step 5: Verify updated profile
      const finalProfile = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(finalProfile.status).toBe(200);
      expect(finalProfile.body.first_name).toBe('Updated');
      expect(finalProfile.body.addresses).toHaveLength(2);
      expect(finalProfile.body.preferences.preferred_language).toBe('es');

      // Step 6: Update address
      const updateAddress = await request(app)
        .put(`/api/users/addresses/${shippingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          street_address: '789 Updated St'
        });

      expect(updateAddress.status).toBe(200);
      expect(updateAddress.body.street_address).toBe('789 Updated St');

      // Step 7: Delete billing address
      const deleteAddress = await request(app)
        .delete(`/api/users/addresses/${billingId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteAddress.status).toBe(200);

      // Step 8: Verify address deletion
      const finalAddresses = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(finalAddresses.body.addresses).toHaveLength(1);
      expect(finalAddresses.body.addresses[0].id).toBe(shippingId);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid credentials gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          credential: 'nonexistent@example.com',
          password: 'WrongPassword',
          auth_provider: 'email'
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should handle duplicate registration attempts', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        first_name: 'Duplicate',
        last_name: 'Test',
        auth_provider: 'email'
      };

      // First registration
      const first = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(first.status).toBe(201);

      // Duplicate registration
      const duplicate = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should handle expired tokens', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LWlkIiwiZW1haWwiOiJleHBpcmVkQGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.invalid';

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});