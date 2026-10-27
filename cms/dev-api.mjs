/** Run the existing Vercel handler inside Astro's local dev server. */
export function cmsDevApi() {
  return {
    name: 'cms-local-api',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        // Local preview must never write to a configured remote repository.
        process.env.CMS_LOCAL_MODE = '1';
        updateConfig({
          vite: {
            plugins: [{
              name: 'cms-local-api',
              configureServer(server) {
                // Astro computes static paths at startup; refresh them when an entry is created.
                let restartTimer;
                server.watcher.on('all', (event, file) => {
                  if (!['add', 'unlink'].includes(event) || !/[/\\]src[/\\]content[/\\](posts|projects)[/\\].+\.json$/.test(file)) return;
                  clearTimeout(restartTimer);
                  restartTimer = setTimeout(() => server.restart(), 300);
                });
                server.middlewares.use('/api', async (req, res) => {
                  try {
                    const endpoint = new URL(req.url || '/', 'http://localhost').pathname;
                    if (endpoint !== '/admin' && endpoint !== '/cms') {
                      res.writeHead(404);
                      res.end();
                      return;
                    }
                    if (req.method === 'POST') {
                      const chunks = [];
                      let size = 0;
                      for await (const chunk of req) {
                        size += chunk.length;
                        if (size > 140 * 1024 * 1024) {
                          res.writeHead(413, { 'Content-Type': 'application/json' });
                          res.end(JSON.stringify({ message: 'Запит завеликий' }));
                          return;
                        }
                        chunks.push(chunk);
                      }
                      req.body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
                    }
                    req.query = Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);
                    res.status = (code) => { res.statusCode = code; return res; };
                    res.json = (value) => {
                      res.setHeader('Content-Type', 'application/json; charset=utf-8');
                      res.end(JSON.stringify(value));
                      return res;
                    };
                    res.end = res.end.bind(res);
                    // Vite invalidates this module graph on edits. A plain Node import
                    // keeps the first API module in its cache until the process exits.
                    const { default: handler } = await server.ssrLoadModule(
                      endpoint === '/admin' ? '/api/admin.js' : '/api/cms.js'
                    );
                    await handler(req, res);
                  } catch (error) {
                    if (!res.headersSent) {
                      res.writeHead(error instanceof SyntaxError ? 400 : 500, { 'Content-Type': 'application/json' });
                    }
                    if (!res.writableEnded) res.end(JSON.stringify({ message: 'Помилка локального API' }));
                  }
                });
              }
            }]
          }
        });
      }
    }
  };
}
