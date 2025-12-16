import path from 'node:path';
import { fileURLToPath } from 'node:url';
import frontendConfig from '@repo/eslint-config/frontend';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  ...frontendConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: path.join(dirname, 'tsconfig.eslint.json'),
        tsconfigRootDir: dirname,
      },
    },
  },
];
