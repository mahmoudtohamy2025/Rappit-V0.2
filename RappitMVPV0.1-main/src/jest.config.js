module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests serially to avoid race conditions
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@integrations/(.*)$': '<rootDir>/src/integrations/$1',
    '^@helpers/(.*)$': '<rootDir>/src/helpers/$1',
    '^@guards/(.*)$': '<rootDir>/src/guards/$1',
    '^@decorators/(.*)$': '<rootDir>/src/decorators/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
