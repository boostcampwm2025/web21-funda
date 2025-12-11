import baseConfig from './base.js';
import globals from 'globals';
import react from 'eslint-plugin-react';

export default [
  ...baseConfig,
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: {
      react: react,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // React 17+ auto import
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
  // 이 앱의 파일들을 위한 설정
  {
    // ESLint가 React/Vite 앱의 소스 파일만 검사하도록 합니다.
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
    // ESLint 검사에서 제외할 파일 설정
    ignores: ['dist', 'node_modules'],
  },
];
