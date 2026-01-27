import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['server/**/*.test.ts', 'server/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['server/**/*.ts'],
            exclude: ['server/**/*.test.ts', 'server/**/*.spec.ts', 'server/index.ts'],
        },
        testTimeout: 10000,
        hookTimeout: 10000,
    },
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, 'shared'),
        },
    },
});
