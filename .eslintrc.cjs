module.exports = {
  extends: '@antfu',
  rules: {
    'no-console': 'off',
    'curly': [
      'error',
      'all',
    ],
    'no-fallthrough': 'warn',
    'prefer-promise-reject-errors': 'off',
    'jsonc/sort-keys': 'off',
    'brace-style': [
      'error',
      '1tbs',
      {
        allowSingleLine: true,
      },
    ],
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/consistent-type-definitions': 'off',
    '@typescript-eslint/brace-style': [
      'error',
      '1tbs',
      {
        allowSingleLine: true,
      },
    ],
  },
}
