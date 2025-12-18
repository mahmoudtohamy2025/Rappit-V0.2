// lib/config.ts
// Centralized configuration that works in browser and server

export const config = {
  backendUrl: 'http://localhost:4000',
  useMockData: true, // DEFAULT: Use mock data (no backend needed)
  // Set to false when you want to connect to real backend
};

// You can override this by setting window.RAPPIT_CONFIG in your HTML
if (typeof window !== 'undefined' && (window as any).RAPPIT_CONFIG) {
  Object.assign(config, (window as any).RAPPIT_CONFIG);
}

// Also check for manual override in console
if (typeof window !== 'undefined') {
  (window as any).__setMockMode = (enabled: boolean) => {
    config.useMockData = enabled;
    console.log(`Mock mode ${enabled ? 'enabled' : 'disabled'}`);
  };
}