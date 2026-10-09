module.exports = {
    root: true,
    env: { browser: true, es2022: true, node: true },
    parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
    plugins: ['react'],
    ignorePatterns: ['dist', 'node_modules', 'printforge/public/dist', 'src/wasm', 'rust'],
    globals: { frappe: 'readonly', __: 'readonly', $: 'readonly' },
    rules: {
        'no-undef': 'error',
        'react/jsx-no-undef': 'error',
        'react/jsx-uses-vars': 'error',
        'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
}
