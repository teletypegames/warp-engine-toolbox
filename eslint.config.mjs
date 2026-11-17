// Strict on purpose: the toolbox writes projects, pushes repositories and holds tokens.
import tseslint from 'typescript-eslint'

const DOMAIN_FORBIDDEN = ['vscode', 'node:*', '**/infrastructure/**', '**/extension/**']

function layer(files, patterns, ignores = []) {
  return {
    files: [files],
    ignores,
    rules: { 'no-restricted-imports': ['error', { patterns: patterns.map((group) => ({ group: [group], message: 'This import crosses a layer boundary: see STRUCTURE.md.' })) }] }
  }
}

export default tseslint.config(
  { ignores: ['dist/**', 'dist-test/**', 'node_modules/**', 'scripts/*.mjs', 'scripts/*.cjs', 'media/**', '.vscode-test/**', 'eslint.config.mjs'] },
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
      eqeqeq: ['error', 'always'],

      // Small pieces: STRUCTURE.md, "Size".
      'max-lines-per-function': ['error', { max: 25, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 8],
      'max-params': ['error', 4],
      // A class of static methods names one concept (Version, FilePath, Dialogs) where loose functions would not.
      '@typescript-eslint/no-extraneous-class': ['error', { allowStaticOnly: true }]
    }
  },

  // The layers: STRUCTURE.md. Each block states the whole list for its folder.
  layer('src/domain/model/**', [...DOMAIN_FORBIDDEN, '../repository/*', '../service/*']),
  layer('src/domain/repository/**', [...DOMAIN_FORBIDDEN, '../service/*']),
  layer('src/domain/service/**', DOMAIN_FORBIDDEN),
  layer('src/infrastructure/**', ['**/extension/**', '**/domain/service/**', 'vscode'], ['src/infrastructure/vscode/**']),
  layer('src/infrastructure/vscode/**', ['**/extension/**', '**/domain/service/**']),
  layer('src/extension/**', ['**/infrastructure/**'], ['src/extension/bootstrap/container.ts']),
  {
    files: ['test/**/*.ts'],
    rules: { '@typescript-eslint/no-floating-promises': 'off', 'max-lines-per-function': 'off', 'max-lines': 'off' }
  }
)
