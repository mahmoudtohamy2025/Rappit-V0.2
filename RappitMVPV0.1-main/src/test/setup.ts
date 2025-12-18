import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for all tests
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  console.log('🧪 Test suite starting...');
  console.log('📦 Database:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
  console.log('📮 Redis:', `${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
});

afterAll(async () => {
  console.log('✅ Test suite complete');
});
