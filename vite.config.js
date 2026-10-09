import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `vite build --mode frappe` writes a single bundle into the Frappe app's public
// folder, where the site serves it at /assets/printforge/dist/printforge.js.
const frappeBuild = {
    base: '/assets/printforge/dist/',
    build: {
        outDir: 'printforge/public/dist',
        emptyOutDir: true,
        rollupOptions: {
            input: 'src/main.jsx',
            output: {
                entryFileNames: 'printforge.js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name][extname]',
            },
        },
    },
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [react()],
    ...(mode === 'frappe' ? frappeBuild : {}),
}))
