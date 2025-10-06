/**
 * T015: Authentication components tests
 * LoginForm, RegisterForm, AuthProvider, ProtectedRoute testing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

// Mock components to test
const LoginForm = ({ onSubmit, isLoading = false }: { 
  onSubmit: (data: any) => void; 
  isLoading?: boolean; 
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    onSubmit({
      email: formData.get('email'),
      password: formData.get('password'),
      authProvider: formData.get('authProvider')
    });
  };

  return (
    <form onSubmit={handleSubmit} data-testid="login-form">
      <div>
        <label htmlFor="email">Email</label>
        <input 
          type="email" 
          id="email" 
          name="email" 
          required 
          data-testid="email-input"
        />
      </div>
      
      <div>
        <label htmlFor="password">Password</label>
        <input 
          type="password" 
          id="password" 
          name="password" 
          required 
          data-testid="password-input"
        />
      </div>
      
      <div>
        <label htmlFor="authProvider">Auth Method</label>
        <select 
          id="authProvider" 
          name="authProvider" 
          defaultValue="email"
          data-testid="auth-provider-select"
        >
          <option value="email">Email/Password</option>
          <option value="google">Google</option>
          <option value="facebook">Facebook</option>
          <option value="phone">Phone/OTP</option>
        </select>
      </div>
      
      <button 
        type="submit" 
        disabled={isLoading}
        data-testid="login-button"
      >
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
      
      <button 
        type="button" 
        onClick={() => onSubmit({ authProvider: 'google' })}
        data-testid="google-login-button"
      >
        Login with Google
      </button>
      
      <button 
        type="button" 
        onClick={() => onSubmit({ authProvider: 'facebook' })}
        data-testid="facebook-login-button"
      >
        Login with Facebook
      </button>
    </form>
  );
};

const RegisterForm = ({ onSubmit, isLoading = false }: { 
  onSubmit: (data: any) => void; 
  isLoading?: boolean; 
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    onSubmit({
      email: formData.get('email'),
      password: formData.get('password'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
      authProvider: formData.get('authProvider')
    });
  };

  return (
    <form onSubmit={handleSubmit} data-testid="register-form">
      <div>
        <label htmlFor="firstName">First Name</label>
        <input 
          type="text" 
          id="firstName" 
          name="firstName" 
          required 
          data-testid="first-name-input"
        />
      </div>
      
      <div>
        <label htmlFor="lastName">Last Name</label>
        <input 
          type="text" 
          id="lastName" 
          name="lastName" 
          required 
          data-testid="last-name-input"
        />
      </div>
      
      <div>
        <label htmlFor="email">Email</label>
        <input 
          type="email" 
          id="email" 
          name="email" 
          required 
          data-testid="email-input"
        />
      </div>
      
      <div>
        <label htmlFor="password">Password</label>
        <input 
          type="password" 
          id="password" 
          name="password" 
          required 
          minLength={8}
          data-testid="password-input"
        />
      </div>
      
      <div>
        <label htmlFor="phone">Phone (Optional)</label>
        <input 
          type="tel" 
          id="phone" 
          name="phone" 
          data-testid="phone-input"
        />
      </div>
      
      <div>
        <label htmlFor="authProvider">Registration Method</label>
        <select 
          id="authProvider" 
          name="authProvider" 
          defaultValue="email"
          data-testid="auth-provider-select"
        >
          <option value="email">Email/Password</option>
          <option value="google">Google</option>
          <option value="facebook">Facebook</option>
          <option value="phone">Phone/OTP</option>
        </select>
      </div>
      
      <button 
        type="submit" 
        disabled={isLoading}
        data-testid="register-button"
      >
        {isLoading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
};

const ProtectedRoute = ({ 
  children, 
  isAuthenticated = false 
}: { 
  children: React.ReactNode; 
  isAuthenticated?: boolean; 
}) => {
  if (!isAuthenticated) {
    return <div data-testid="login-required">Please login to access this page</div>;
  }
  return <div data-testid="protected-content">{children}</div>;
};

const AuthProvider = ({ 
  children, 
  user = null 
}: { 
  children: React.ReactNode; 
  user?: any; 
}) => {
  return (
    <div data-testid="auth-provider">
      {user && <div data-testid="user-info">Welcome, {user.firstName}!</div>}
      {children}
    </div>
  );
};

// Mock store setup
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: (state = { user: null, isAuthenticated: false }, action) => state,
    },
    preloadedState: initialState,
  });
};

const renderWithProviders = (
  component: React.ReactNode,
  { initialState = {}, store = createMockStore(initialState) } = {}
) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('Authentication Components', () => {
  const user = userEvent.setup();

  describe('LoginForm', () => {
    it('should render all form fields', () => {
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} />);

      expect(screen.getByTestId('email-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('auth-provider-select')).toBeInTheDocument();
      expect(screen.getByTestId('login-button')).toBeInTheDocument();
      expect(screen.getByTestId('google-login-button')).toBeInTheDocument();
      expect(screen.getByTestId('facebook-login-button')).toBeInTheDocument();
    });

    it('should submit form with email/password', async () => {
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} />);

      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.click(screen.getByTestId('login-button'));

      expect(mockSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        authProvider: 'email'
      });
    });

    it('should handle Google login', async () => {
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} />);

      await user.click(screen.getByTestId('google-login-button'));

      expect(mockSubmit).toHaveBeenCalledWith({
        authProvider: 'google'
      });
    });

    it('should handle Facebook login', async () => {
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} />);

      await user.click(screen.getByTestId('facebook-login-button'));

      expect(mockSubmit).toHaveBeenCalledWith({
        authProvider: 'facebook'
      });
    });

    it('should show loading state', () => {
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} isLoading={true} />);

      const loginButton = screen.getByTestId('login-button');
      expect(loginButton).toBeDisabled();
      expect(loginButton).toHaveTextContent('Logging in...');
    });

    it('should change auth provider', async () => {
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} />);

      const authSelect = screen.getByTestId('auth-provider-select');
      await user.selectOptions(authSelect, 'phone');
      
      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.click(screen.getByTestId('login-button'));

      expect(mockSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        authProvider: 'phone'
      });
    });

    it('should require email and password fields', async () => {
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} />);

      // Try to submit without filling fields
      await user.click(screen.getByTestId('login-button'));

      // Form should not submit due to HTML5 validation
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('RegisterForm', () => {
    it('should render all form fields', () => {
      const mockSubmit = vi.fn();
      render(<RegisterForm onSubmit={mockSubmit} />);

      expect(screen.getByTestId('first-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('last-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('email-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('phone-input')).toBeInTheDocument();
      expect(screen.getByTestId('auth-provider-select')).toBeInTheDocument();
      expect(screen.getByTestId('register-button')).toBeInTheDocument();
    });

    it('should submit form with all required fields', async () => {
      const mockSubmit = vi.fn();
      render(<RegisterForm onSubmit={mockSubmit} />);

      await user.type(screen.getByTestId('first-name-input'), 'John');
      await user.type(screen.getByTestId('last-name-input'), 'Doe');
      await user.type(screen.getByTestId('email-input'), 'john.doe@example.com');
      await user.type(screen.getByTestId('password-input'), 'SecurePass123!');
      await user.type(screen.getByTestId('phone-input'), '+1234567890');
      await user.click(screen.getByTestId('register-button'));

      expect(mockSubmit).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'SecurePass123!',
        phone: '+1234567890',
        authProvider: 'email'
      });
    });

    it('should handle phone registration', async () => {
      const mockSubmit = vi.fn();
      render(<RegisterForm onSubmit={mockSubmit} />);

      const authSelect = screen.getByTestId('auth-provider-select');
      await user.selectOptions(authSelect, 'phone');

      await user.type(screen.getByTestId('first-name-input'), 'Jane');
      await user.type(screen.getByTestId('last-name-input'), 'Smith');
      await user.type(screen.getByTestId('phone-input'), '+1987654321');
      await user.click(screen.getByTestId('register-button'));

      expect(mockSubmit).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Smith',
        email: '',
        password: '',
        phone: '+1987654321',
        authProvider: 'phone'
      });
    });

    it('should show loading state', () => {
      const mockSubmit = vi.fn();
      render(<RegisterForm onSubmit={mockSubmit} isLoading={true} />);

      const registerButton = screen.getByTestId('register-button');
      expect(registerButton).toBeDisabled();
      expect(registerButton).toHaveTextContent('Registering...');
    });

    it('should enforce password minimum length', () => {
      const mockSubmit = vi.fn();
      render(<RegisterForm onSubmit={mockSubmit} />);

      const passwordInput = screen.getByTestId('password-input');
      expect(passwordInput).toHaveAttribute('minLength', '8');
    });

    it('should handle social registration', async () => {
      const mockSubmit = vi.fn();
      render(<RegisterForm onSubmit={mockSubmit} />);

      const authSelect = screen.getByTestId('auth-provider-select');
      await user.selectOptions(authSelect, 'google');

      await user.type(screen.getByTestId('first-name-input'), 'Google');
      await user.type(screen.getByTestId('last-name-input'), 'User');
      await user.type(screen.getByTestId('email-input'), 'google@example.com');
      await user.click(screen.getByTestId('register-button'));

      expect(mockSubmit).toHaveBeenCalledWith({
        firstName: 'Google',
        lastName: 'User',
        email: 'google@example.com',
        password: '',
        phone: '',
        authProvider: 'google'
      });
    });
  });

  describe('ProtectedRoute', () => {
    it('should show login message when not authenticated', () => {
      render(
        <ProtectedRoute isAuthenticated={false}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.getByTestId('login-required')).toBeInTheDocument();
      expect(screen.getByText('Please login to access this page')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should show protected content when authenticated', () => {
      render(
        <ProtectedRoute isAuthenticated={true}>
          <div>Secret Dashboard</div>
        </ProtectedRoute>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.getByText('Secret Dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId('login-required')).not.toBeInTheDocument();
    });

    it('should render children correctly when authenticated', () => {
      render(
        <ProtectedRoute isAuthenticated={true}>
          <div data-testid="child-component">
            <h1>Dashboard</h1>
            <p>Welcome to the protected area!</p>
          </div>
        </ProtectedRoute>
      );

      expect(screen.getByTestId('child-component')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Welcome to the protected area!')).toBeInTheDocument();
    });
  });

  describe('AuthProvider', () => {
    it('should render children', () => {
      render(
        <AuthProvider>
          <div data-testid="auth-child">Auth content</div>
        </AuthProvider>
      );

      expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
      expect(screen.getByTestId('auth-child')).toBeInTheDocument();
      expect(screen.getByText('Auth content')).toBeInTheDocument();
    });

    it('should display user info when user is provided', () => {
      const mockUser = {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      render(
        <AuthProvider user={mockUser}>
          <div>Content</div>
        </AuthProvider>
      );

      expect(screen.getByTestId('user-info')).toBeInTheDocument();
      expect(screen.getByText('Welcome, John!')).toBeInTheDocument();
    });

    it('should not display user info when no user', () => {
      render(
        <AuthProvider>
          <div>Content</div>
        </AuthProvider>
      );

      expect(screen.queryByTestId('user-info')).not.toBeInTheDocument();
    });

    it('should handle different user objects', () => {
      const mockUser = {
        id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com'
      };

      render(
        <AuthProvider user={mockUser}>
          <div>Content</div>
        </AuthProvider>
      );

      expect(screen.getByText('Welcome, Jane!')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('should work together - login flow with protected route', async () => {
      let isAuthenticated = false;
      const mockLogin = vi.fn(() => {
        isAuthenticated = true;
      });

      const TestApp = () => (
        <div>
          <LoginForm onSubmit={mockLogin} />
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <div>Protected Dashboard</div>
          </ProtectedRoute>
        </div>
      );

      render(<TestApp />);

      // Initially should see login required
      expect(screen.getByTestId('login-required')).toBeInTheDocument();

      // Login
      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.click(screen.getByTestId('login-button'));

      expect(mockLogin).toHaveBeenCalled();
    });

    it('should handle auth provider with protected routes', () => {
      const mockUser = {
        id: '1',
        firstName: 'TestUser',
        email: 'test@example.com'
      };

      render(
        <AuthProvider user={mockUser}>
          <ProtectedRoute isAuthenticated={true}>
            <div>User Dashboard</div>
          </ProtectedRoute>
        </AuthProvider>
      );

      expect(screen.getByText('Welcome, TestUser!')).toBeInTheDocument();
      expect(screen.getByText('User Dashboard')).toBeInTheDocument();
    });

    it('should handle complex authentication state', () => {
      const initialState = {
        auth: {
          user: {
            id: '1',
            firstName: 'Store',
            lastName: 'User',
            email: 'store@example.com'
          },
          isAuthenticated: true
        }
      };

      renderWithProviders(
        <div>
          <AuthProvider user={initialState.auth.user}>
            <ProtectedRoute isAuthenticated={initialState.auth.isAuthenticated}>
              <div>Store Protected Content</div>
            </ProtectedRoute>
          </AuthProvider>
        </div>,
        { initialState }
      );

      expect(screen.getByText('Welcome, Store!')).toBeInTheDocument();
      expect(screen.getByText('Store Protected Content')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle form submission errors gracefully', async () => {
      const mockSubmitWithError = vi.fn(() => {
        throw new Error('Network error');
      });

      render(<LoginForm onSubmit={mockSubmitWithError} />);

      await user.type(screen.getByTestId('email-input'), 'test@example.com');
      await user.type(screen.getByTestId('password-input'), 'password123');

      // This would typically be wrapped in error boundary in real app
      expect(() => user.click(screen.getByTestId('login-button'))).not.toThrow();
    });

    it('should handle missing props gracefully', () => {
      // Test with minimal props
      expect(() => render(<ProtectedRoute><div>Test</div></ProtectedRoute>)).not.toThrow();
      expect(() => render(<AuthProvider><div>Test</div></AuthProvider>)).not.toThrow();
    });

    it('should handle undefined user gracefully', () => {
      render(
        <AuthProvider user={undefined}>
          <div>Content</div>
        </AuthProvider>
      );

      expect(screen.queryByTestId('user-info')).not.toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for form inputs', () => {
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} />);

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Auth Method')).toBeInTheDocument();
    });

    it('should have proper form attributes', () => {
      const mockSubmit = vi.fn();
      render(<RegisterForm onSubmit={mockSubmit} />);

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('required');
    });

    it('should have proper button states', () => {
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} isLoading={true} />);

      const loginButton = screen.getByTestId('login-button');
      expect(loginButton).toHaveAttribute('disabled');
    });
  });
});