import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import { includeIgnoreFile } from '@eslint/compat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';
import uuidRule from './eslint-rules/require-uuid-undefined.js';
const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

const RULES = {
	ts: {
		'@typescript-eslint/no-unused-vars': [
			'error',
			{
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
				destructuredArrayIgnorePattern: '^_'
			}
		]
	}
};

export default ts.config(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: RULES.ts
	},
	{
		files: ['**/*.svelte', 'lib/**/*.ts'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
				svelteFeatures: {
					experimentalGenerics: true
				}
			}
		},
		rules: RULES.ts
	},
	{
		files: ['**/gen.test.ts'],
		rules: {
			'custom/require-uuid-undefined': 'error'
		},
		plugins: {
			custom: {
				rules: {
					'require-uuid-undefined': uuidRule
				}
			}
		}
	}
);
