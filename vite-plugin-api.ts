import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv, type Connect, type Plugin } from 'vite';

type Handlers = typeof import('./server/handlers');

/**
 * Serves /api/* locally so the app runs without the Vercel CLI:
 *  - `npm run dev`: handlers load through Vite, so edits apply without a restart
 *  - `npm run preview`: handlers come from the bundle made by scripts/build-preview-api.mjs
 */
export function apiDevServer(): Plugin {
  const middleware =
    (load: () => Promise<Handlers>, onError: (err: Error) => void): Connect.NextHandleFunction =>
    async (req: IncomingMessage, res: ServerResponse, next) => {
      if (!req.url?.startsWith('/api/')) return next();
      try {
        const mod = await load();
        const url = new URL(req.url, 'http://localhost');
        const route = mod.ROUTES.find(
          (r) => r.method === req.method && r.pattern.test(url.pathname),
        );
        if (!route) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'not_found', message: 'No such API route.' }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') headers.set(k, v);
        }
        const request = new Request(url, {
          method: req.method ?? 'GET',
          headers,
          ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
        });
        const response = await route.handler(request);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (err) {
        onError(err as Error);
        next(err);
      }
    };

  return {
    name: 'uniqo-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
      server.middlewares.use(
        middleware(
          () => server.ssrLoadModule('/server/handlers.ts') as Promise<Handlers>,
          (err) => server.ssrFixStacktrace(err),
        ),
      );
    },
    configurePreviewServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
      const bundle = pathToFileURL(
        join(process.cwd(), 'node_modules', '.tmp', 'preview-api.mjs'),
      ).href;
      server.middlewares.use(
        middleware(
          () => import(bundle) as Promise<Handlers>,
          () => undefined,
        ),
      );
    },
  };
}
