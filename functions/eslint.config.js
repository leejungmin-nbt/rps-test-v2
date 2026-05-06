// ESLint flat config for Firebase Cloud Functions (Node.js, TypeScript, no React).
// Mirrors the web/ project's conventions minus the React-specific rules.

const js = require('@eslint/js')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const prettier = require('eslint-config-prettier')
const importPlugin = require('eslint-plugin-import-x')
const simpleImportSort = require('eslint-plugin-simple-import-sort')
const globals = require('globals')
const tseslint = require('typescript-eslint')

module.exports = [
  { ignores: ['lib', 'node_modules', 'eslint.config.js', '.prettierrc.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended.map(c => ({ ...c, files: ['**/*.{ts,tsx}'] })),
  { ...prettier, files: ['**/*.{ts,tsx}'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.json']
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      'simple-import-sort': simpleImportSort
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'import/no-anonymous-default-export': 'off',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'lines-around-comment': [
        'error',
        {
          beforeLineComment: false,
          beforeBlockComment: true,
          allowBlockStart: true,
          allowClassStart: true,
          allowObjectStart: true,
          allowArrayStart: true
        }
      ],
      'newline-before-return': 'error',
      'import/newline-after-import': [
        'error',
        {
          count: 1
        }
      ]
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx']
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.json']
        }
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    }
  }
]
