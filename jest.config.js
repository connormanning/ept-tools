module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'src'],
  testPathIgnorePatterns: ['lib/'],
  collectCoverageFrom: ['src/**'],
  coveragePathIgnorePatterns: ['/test/', '.asm.'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
}
