import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.vercel', 'playwright-report', 'test-results'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // The engine is shared with the server and must stay framework-free.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-*', 'react/*', '@/components/*', '../features/*'] },
      ],
    },
  },
  {
    // Generators know the answers. UI code may import content types and renderers only.
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    ignores: ['src/app/routes/Dev*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/engine/generators',
                '**/engine/*/generate',
                '**/engine/*/solve',
                '**/engine/*/rules',
              ],
              message: 'Answer-generating engine code must stay on the server.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
