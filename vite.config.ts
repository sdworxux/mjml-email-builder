import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * Vite plugin that adds a POST /api/compile-mjml middleware to the dev server.
 * Because this runs inside Vite's Node.js process, we can safely require `mjml`
 * without any bundling or browser-compat issues.
 */
function mjmlCompilerPlugin(): Plugin {
  return {
    name: 'mjml-compiler',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/compile-mjml', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          // Collect body
          const chunks: Buffer[] = [];
          for await (const chunk of req as AsyncIterable<Buffer>) {
            chunks.push(chunk);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const mjmlSource: string = body.mjml ?? '';

          if (!mjmlSource.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No MJML provided' }));
            return;
          }

          // Dynamically require mjml (Node.js only — fine here)
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mjml = (await import('mjml')).default;
          const result = mjml(mjmlSource, {
            validationLevel: 'soft',
            beautify: true,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              html: result.html,
              errors: result.errors,
            }),
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), mjmlCompilerPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
