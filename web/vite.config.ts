import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

import { devApi } from './dev-api';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    plugins: [
        devApi({
            toursDir: here('./tours'),
            samplesDir: here('../engine/supersplat-viewer/public/samples')
        })
    ],
    resolve: {
        // the viewer (linked from engine/) and this app must share one copy of the engine
        dedupe: ['playcanvas']
    },
    server: {
        port: 5173,
        strictPort: true,
        watch: {
            // saving from the admin page rewrites these; don't reload the page under the user
            ignored: ['**/tours/**']
        }
    }
});
