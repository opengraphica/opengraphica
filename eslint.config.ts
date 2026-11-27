import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin'

export default defineConfig([
    globalIgnores([
        'rust/*',
        'src/css/build.js',
        'src/css/vendor/element-plus-convert.js',
        'src/lib/clipper.js',
        'src/lib/gif.js',
        'src/lib/opentype.js',
        'src/lib/pica.js',
        'src/main-default.js',
        'src/renderers/canvas2d/drawable/*',
        'src/renderers/webgl2/layers/vector/svg-intersection.ts',
        'src/renderers/webgl2/layers/vector/svg-loader.ts',
        'src/types/webdav.d.ts',
        'src/workers/gif.worker.js',
    ]),
    {
        files: ['**/*.{js,ts}'],
        extends: [tseslint.configs.recommended],
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            'prefer-const': ['error', { destructuring: 'all' }],
            'prefer-rest-params': 'off',
            'prefer-spread': 'off',
            'semi': 'error',
            '@stylistic/array-bracket-spacing': ['error', 'never'],
            '@stylistic/comma-dangle': ['error', {
                arrays: 'always-multiline',
                objects: 'always-multiline',
                enums: 'always-multiline',
                tuples: 'always-multiline',
                functions: 'always-multiline',
            }],
            '@stylistic/comma-spacing': ['error', {
                before: false,
                after: true,
            }],
            '@stylistic/computed-property-spacing': ['error', 'never'],
            '@stylistic/function-call-spacing': ['error', 'never'],
            '@stylistic/indent': ['error', 4],
            '@stylistic/key-spacing': ['error', {
                beforeColon: false,
                afterColon: true,
                mode: 'strict',
            }],
            '@stylistic/keyword-spacing': ['error', {
                after: true,
            }],
            '@stylistic/member-delimiter-style': ['error', {
                multiline: {
                    delimiter: 'semi',
                    requireLast: true,
                },
                singleline: {
                    delimiter: 'semi',
                    requireLast: true,
                },
            }],
            '@stylistic/no-floating-decimal': 'error',
            '@stylistic/no-multi-spaces': 'error',
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/no-whitespace-before-property': 'error',
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/quotes': ['error', 'single', {
                allowTemplateLiterals: 'always',
            }],
            '@stylistic/semi-spacing': ['error', {
                before: false,
                after: true,
            }],
            '@stylistic/space-before-blocks': ['error', 'always'],
            '@stylistic/space-before-function-paren': ['error', {
                named: 'never',
                anonymous: 'never',
                catch: 'always',
            }],
            '@stylistic/space-in-parens': ['error', 'never'],
            '@stylistic/space-infix-ops': 'error',
            '@stylistic/type-annotation-spacing': ['error', {
                before: false,
                after: true,
            }],
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true }],
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-wrapper-object-types': 'off',
        },
    },
]);
