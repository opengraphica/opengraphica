import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { getAliases } from 'vite-aliases';

const aliases = getAliases();

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    build: {
        manifest: true
    },
    resolve: {
        alias: [
            {
                find: '@',
                replacement: path.resolve(__dirname, './src')
            }
        ]
    }
});
