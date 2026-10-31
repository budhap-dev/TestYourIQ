import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

/**
 * Serves /api/* from server/handlers.ts during `npm run dev`, so the app runs locally without
 * the Vercel CLI. Handlers are loaded through Vite, so edits apply without a restart.
 */
export function apiDevServer(): Plugin {
  return {
    name: 'uniqo-api-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const mod = (await server.ssrLoadModule(
            '/server/handlers.ts',
          )) as typeof import('./server/handlers');
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
          server.ssrFixStacktrace(err as Error);
          next(err);
        }
      });
    },
  };
}
