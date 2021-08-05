module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'src'],
  testPathIgnorePatterns: ['lib/'],
  collectCoverageFrom: ['src/**'],
  coveragePathIgnorePatterns: ['/test/', '.asm.'],
  watchPathIgnorePatterns: ['/test/data/']
}
