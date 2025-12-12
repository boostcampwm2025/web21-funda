// apps/frontend/eslint.config.mjs 파일 내용 (수정)

import frontendConfig from '@repo/eslint-config/frontend';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  ...frontendConfig,

  {
    files: ['**/*.ts', '**/*.tsx'],

    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  },
);
