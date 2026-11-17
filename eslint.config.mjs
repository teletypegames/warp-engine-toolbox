// Strict on purpose: the toolbox writes projects, pushes repositories and holds tokens.
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'dist-test/**', 'node_modules/**', 'scripts/*.mjs', 'scripts/*.cjs', '.vscode-test/**', 'eslint.config.mjs'] },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    },
    rules: {
      // Types everywhere, including the ones TypeScript would happily infer: a
      // signature is the layer's contract, and it should be readable without
      // running the compiler in your head.
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: false }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/typedef': ['error', { parameter: true, propertyDeclaration: true }],
      // typedef and no-inferrable-types disagree about `fallback: string = ''`. The
      // annotation wins: a signature states its types even where TypeScript could
      // guess them.
      '@typescript-eslint/no-inferrable-types': ['error', { ignoreParameters: true }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // The naming patterns, enforced rather than trusted.
      '@typescript-eslint/naming-convention': ['error',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
        { selector: 'objectLiteralProperty', format: null },
        { selector: 'typeProperty', format: ['camelCase'] },
        { selector: 'classProperty', modifiers: ['static', 'readonly'], format: ['UPPER_CASE'] },
        { selector: 'classMethod', format: ['camelCase'] },
        { selector: 'function', format: ['camelCase'] }
      ],

      'no-console': 'off',
      curly: ['error', 'multi-line'],
      eqeqeq: ['error', 'always']
    }
  },
  {
    files: ['test/**/*.ts'],
    rules: { '@typescript-eslint/no-floating-promises': 'off' }
  }
)
