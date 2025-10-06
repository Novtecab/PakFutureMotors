import React from 'react';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🚗 PakFutureMotors</h1>
        <p>Premium Automotive Sales & Service Platform</p>
        
        <div className="feature-grid">
          <div className="feature-card">
            <h3>🛒 Car Catalog</h3>
            <p>Browse premium cars and accessories</p>
          </div>
          
          <div className="feature-card">
            <h3>📅 Service Booking</h3>
            <p>Book ceramic coating and detailing services</p>
          </div>
          
          <div className="feature-card">
            <h3>💳 Secure Payments</h3>
            <p>Multiple payment options with secure processing</p>
          </div>
          
          <div className="feature-card">
            <h3>👤 User Accounts</h3>
            <p>Multi-provider authentication & profile management</p>
          </div>
        </div>
        
        <div className="status-info">
          <p>🚧 Platform Status: Under Development</p>
          <p>📊 API Health: <span id="api-status">Checking...</span></p>
        </div>
      </header>
    </div>
  );
};

export default App;