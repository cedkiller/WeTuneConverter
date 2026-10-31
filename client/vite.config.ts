import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'youtube-audio-stream-proxy',
      configureServer(server) {
        // 1. YouTube metadata / download initiation endpoint
        server.middlewares.use('/api/ytdl', async (req, res) => {
          try {
            const urlObj = new URL(req.url!, `http://${req.headers.host}`);
            const targetUrl = urlObj.searchParams.get('url');
            if (!targetUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing url parameter' }));
              return;
            }

            const fetchRes = await fetch(
              `https://loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(targetUrl)}`,
              {
                headers: {
                  Referer: 'https://loader.to/',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              }
            );

            const data = await fetchRes.text();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(data);
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 2. Audio Binary Stream proxy (bypasses CORS completely for MP3 file download)
        server.middlewares.use('/api/stream-proxy', async (req, res) => {
          try {
            const urlObj = new URL(req.url!, `http://${req.headers.host}`);
            const targetAudioUrl = urlObj.searchParams.get('url');
            if (!targetAudioUrl) {
              res.statusCode = 400;
              res.end('Missing url parameter');
              return;
            }

            const fetchRes = await fetch(targetAudioUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'audio/mpeg');

            const arrayBuf = await fetchRes.arrayBuffer();
            res.end(Buffer.from(arrayBuf));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end('Proxy streaming error: ' + err.message);
          }
        });
      }
    }
  ],
  server: {
    host: true,
    port: 3000,
    open: false
  }
})
