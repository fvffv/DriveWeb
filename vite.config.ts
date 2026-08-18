import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from "path";
import monacoEditorPlugin from 'vite-plugin-monaco-editor';
// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()
  ],
    resolve: {
        alias: {
            // 优化：使用 __dirname 确保路径绝对（避免不同系统路径问题）
            '@': path.resolve(__dirname, './src'),
        },
        extensions: ['.ts', '.mjs', '.vue', '.json', '.less', '.css'],
    }
})
