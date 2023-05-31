/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    "node_modules/(?!(gzip-size)/)"
  ],
  testPathIgnorePatterns: [
    "__data__"
  ]
};
