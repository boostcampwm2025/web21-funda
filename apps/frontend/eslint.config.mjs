import frontendConfig from '@repo/eslint-config/frontend';
import tseslint from 'typescript-eslint';
// path와 fileURLToPath는 Node.js 환경에서 현재 디렉토리 경로를 얻기 위해 필요
import { fileURLToPath } from 'url';
import path from 'path';

// 현재 파일이 위치한 디렉토리 경로를 계산
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  ...frontendConfig, // 중앙 설정에서 가져온 기본 규칙들을 모두 적용

  {
    // 이 설정이 적용될 파일 범위 (모든 TypeScript 파일)
    files: ['**/*.ts', '**/*.tsx'],

    languageOptions: {
      parserOptions: {
        // 경로의 기준점(Root)을 현재 apps/frontend 디렉토리로 설정
        tsconfigRootDir: __dirname,

        // ESLint가 참조해야 할 모든 tsconfig 파일을 명시
        // 배열에 .stories.tsx가 포함된 tsconfig 파일을 추가
        project: [
          './tsconfig.json', // 루트 참조
          './tsconfig.app.json', // 메인 앱 설정
          './tsconfig.storybook.json', // Storybook 파일 포함
        ],
      },
    },
  },
);
