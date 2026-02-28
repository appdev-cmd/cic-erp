// @ts-nocheck
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts'],
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['node_modules', 'dist', '.git'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'tests/setup.ts',
                '**/*.d.ts',
                '**/*.config.*',
                '**/types.ts',
            ],
        },
        css: false,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
            '@components': path.resolve(__dirname, './components'),
            '@services': path.resolve(__dirname, './services'),
            '@hooks': path.resolve(__dirname, './hooks'),
            '@lib': path.resolve(__dirname, './lib'),
        },
    },
});
