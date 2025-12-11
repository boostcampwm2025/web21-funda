import baseConfig from './base.js';
import globals from 'globals';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // NestJS 데코레이터 관련
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Node.js 환경에서는 console 허용
      'no-console': 'off',
    },
  },
  // 이 앱의 파일들을 위한 설정
  {
    // ESLint가 NestJS 앱의 소스 파일만 검사하도록 합니다.
    files: ['src/**/*.ts', 'test/**/*.ts'],
    // ESLint 검사에서 제외할 파일 설정
    ignores: ['dist', 'node_modules', 'test'],
  },
];
