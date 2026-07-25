// Lint config. The game ships as raw ES modules with no build step, so nothing stands
// between a typo and the browser — there is no compiler, no bundler, and no type checker
// to catch a misspelled global or an unreachable branch. That makes the linter the only
// automated static check the project has, which is why it runs in CI.
//
// The rule set is deliberately small: recommended, plus a few rules chosen for the
// failure modes this codebase actually has. Style is not policed — the house style is
// established by ~9,000 lines of existing source and a linter arguing with it would be
// noise, not signal.
import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['node_modules/**', 'coverage/**', '.vite/**'] },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.browser },
        },
        rules: {
            // `catch (e) { /* ignore */ }` is a deliberate, load-bearing idiom here:
            // every localStorage access is wrapped in one so a browser with storage
            // disabled degrades to "no saves" instead of crashing the engine.
            'no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_' }],
            'no-empty': ['error', { allowEmptyCatch: true }],

            // `x != null` (matching both null and undefined) is used on purpose in the
            // music sequencer, where a rest is null and 0 is a valid note index.
            eqeqeq: ['error', 'always', { null: 'ignore' }],

            'no-var': 'error',
            'prefer-const': 'warn',

            // Diegesis: the game speaks through the Architect's terminal, never the
            // browser console. A console call in shipped code is a leftover.
            'no-console': 'warn',
        },
    },
    {
        // Tests drive the engine through deliberately odd states and reach into private
        // fields to do it; they also run on Node, not just in a DOM.
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
        rules: {
            'no-console': 'off',
        },
    },
    {
        // audio-demos/ is an offline authoring tool, not shipped code: it runs under Node
        // to render candidate music loops to WAV, and printing what it wrote is its job.
        files: ['audio-demos/**/*.js'],
        languageOptions: {
            globals: { ...globals.node },
        },
        rules: {
            'no-console': 'off',
        },
    },
];
