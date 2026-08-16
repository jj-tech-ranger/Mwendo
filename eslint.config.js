import tsPlugin from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tsPlugin.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.aistudio/**', 'apps/functions/lib/**'],
  },
  ...tsPlugin.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Allow any in mock tests and test suites for mocking third-party SDKs
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
