// Configuration file that can be modified without rebuilding
// This file is loaded before the app and sets the backend URL

window.RAPPIT_CONFIG = {
  backendUrl: 'http://localhost:4000',

  // Set to true to use mock data (for testing UI without backend)
  // Set to false to use real backend API
  useMockData: true  // Change to false when backend is running
};

// For production, you can modify this file on the server to point to production backend
// Or use environment-specific config files