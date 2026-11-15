import { existsSync, readdirSync, readFileSync, writeFileSync, createReadStream, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

import type { Plugin } from 'vite';

// Dev-server-only API for the admin pages. Tours are JSON files in web/tours/, committed to git,
// so a saved tweak is a reviewable diff. Production hosting will need a real backend for this;
// the built site reads the files bundled at build time instead (see src/tours.ts).
//
//   GET  /api/tours                       -> [{ name, title }]
//   GET  /api/tours/:name                 -> the tour file
//   PUT  /api/tours/:name                 -> replace the tour file
//   POST /api/tours/:name/apply-to-all    -> copy this tour's walk + look settings to every tour
//
// It also serves downloaded sample scans (/samples/...) from the engine's dev folder, so each
// scan exists on disk once.

const NAME = /^[a-z0-9][a-z0-9-]*$/;

const MIME: Record<string, string> = {
    '.json': 'application/json',
    '.sog': 'application/octet-stream',
    '.ply': 'application/octet-stream',
    '.bin': 'application/octet-stream',
    '.webp': 'image/webp',
    '.txt': 'text/plain'
};

type TourFile = {
    title?: string;
    walk?: Record<string, number>;
    viewer?: { postEffectSettings?: unknown };
    [key: string]: unknown;
};

const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage) =>
    new Promise<unknown>((resolveBody, reject) => {
        let data = '';
        req.on('data', (chunk) => {
            data += chunk;
            if (data.length > 1_000_000) reject(new Error('body too large'));
        });
        req.on('end', () => {
            try {
                resolveBody(JSON.parse(data));
            } catch {
                reject(new Error('body is not JSON'));
            }
        });
        req.on('error', reject);
    });

const devApi = (options: { toursDir: string; samplesDir: string }): Plugin => {
    const { toursDir, samplesDir } = options;
    const tourPath = (name: string) => join(toursDir, `${name}.json`);
    const listNames = () =>
        readdirSync(toursDir)
            .filter((f) => f.endsWith('.json'))
            .map((f) => f.slice(0, -5))
            .filter((n) => NAME.test(n))
            .sort();
    const readTour = (name: string) => JSON.parse(readFileSync(tourPath(name), 'utf8')) as TourFile;
    const writeTour = (name: string, tour: TourFile) => writeFileSync(tourPath(name), `${JSON.stringify(tour, null, 2)}\n`);

    return {
        name: 'splat-dev-api',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url ?? '/', 'http://localhost');
                const path = decodeURIComponent(url.pathname);

                // sample scans
                if (path.startsWith('/samples/')) {
                    const file = resolve(samplesDir, `.${path.slice('/samples'.length)}`);
                    if (!file.startsWith(samplesDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
                        return next();
                    }
                    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
                    createReadStream(file).pipe(res);
                    return;
                }

                if (!path.startsWith('/api/tours')) return next();

                try {
                    const parts = path.split('/').filter(Boolean); // ['api', 'tours', name?, action?]
                    const [, , name, action] = parts;

                    if (!name) {
                        if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
                        return send(
                            res,
                            200,
                            listNames().map((n) => ({ name: n, title: readTour(n).title ?? n }))
                        );
                    }

                    if (!NAME.test(name) || !existsSync(tourPath(name))) {
                        return send(res, 404, { error: `no tour named "${name}"` });
                    }

                    if (!action && req.method === 'GET') {
                        return send(res, 200, readTour(name));
                    }

                    if (!action && req.method === 'PUT') {
                        const body = (await readBody(req)) as TourFile;
                        if (!body || typeof body !== 'object' || typeof body.content !== 'string') {
                            return send(res, 400, { error: 'a tour needs at least a "content" url' });
                        }
                        writeTour(name, body);
                        return send(res, 200, { saved: name });
                    }

                    if (action === 'apply-to-all' && req.method === 'POST') {
                        const source = readTour(name);
                        const updated: string[] = [];
                        for (const other of listNames()) {
                            const tour = readTour(other);
                            tour.walk = { ...source.walk };
                            if (source.viewer?.postEffectSettings) {
                                tour.viewer = {
                                    ...tour.viewer,
                                    postEffectSettings: structuredClone(source.viewer.postEffectSettings)
                                };
                            }
                            writeTour(other, tour);
                            updated.push(other);
                        }
                        return send(res, 200, { updated });
                    }

                    return send(res, 405, { error: 'method not allowed' });
                } catch (err) {
                    return send(res, 500, { error: (err as Error).message });
                }
            });
        }
    };
};

export { devApi };
