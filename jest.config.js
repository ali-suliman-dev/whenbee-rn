module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Sibling git worktrees carry their own node_modules + duplicate test files;
  // the parent run must not descend into them (haste collisions + native requires).
  // Both worktree roots are covered: `.claude/worktrees/` and the `.worktrees/`
  // convention (see .gitignore) — either would otherwise run stale duplicates.
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/', '<rootDir>/.worktrees/'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/worktrees/', '<rootDir>/.worktrees/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|react-native-svg|nativewind|@gluestack-ui/.*|@legendapp/.*))',
  ],
};
