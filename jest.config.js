module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Sibling git worktrees carry their own node_modules + duplicate test files;
  // the parent run must not descend into them (haste collisions + native requires).
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/worktrees/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|react-native-svg|nativewind|@gluestack-ui/.*|@legendapp/.*))',
  ],
};
