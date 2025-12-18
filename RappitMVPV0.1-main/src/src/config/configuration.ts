export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix: process.env.API_PREFIX || 'api/v1',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  integrations: {
    shopify: {
      apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
    },
    woocommerce: {
      apiVersion: process.env.WOOCOMMERCE_API_VERSION || 'wc/v3',
    },
    dhl: {
      apiUrl: process.env.DHL_API_URL || 'https://api-sandbox.dhl.com',
      apiKey: process.env.DHL_API_KEY,
      apiSecret: process.env.DHL_API_SECRET,
    },
    fedex: {
      apiUrl: process.env.FEDEX_API_URL || 'https://apis-sandbox.fedex.com',
      clientId: process.env.FEDEX_CLIENT_ID,
      clientSecret: process.env.FEDEX_CLIENT_SECRET,
    },
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
});
