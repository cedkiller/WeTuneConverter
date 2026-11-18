import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'

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
            const title = urlObj.searchParams.get('title') || '';
            const artist = urlObj.searchParams.get('artist') || '';
            if (!targetUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing url parameter' }));
              return;
            }

            const queryParams = new URLSearchParams({ url: targetUrl });
            if (title) queryParams.set('title', title);
            if (artist) queryParams.set('artist', artist);
            const qs = queryParams.toString();

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({
              success: 1,
              progress_url: `/api/progress?${qs}`,
              download_url: `/api/stream-proxy?${qs}`,
              format: 'mp3'
            }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // 2. Audio Binary Stream proxy (handles YouTube URLs via yt-dlp & proxies other audio streams)
        server.middlewares.use('/api/stream-proxy', async (req, res) => {
          try {
            const urlObj = new URL(req.url!, `http://${req.headers.host}`);
            const rawParam = urlObj.searchParams.get('url');
            if (!rawParam) {
              res.statusCode = 400;
              res.end('Missing url parameter');
              return;
            }

            let targetAudioUrl: string = rawParam;
            while (targetAudioUrl.startsWith('/api/stream-proxy')) {
              const nested: URL = new URL(targetAudioUrl, 'http://localhost');
              const inner: string | null = nested.searchParams.get('url');
              if (!inner) break;
              targetAudioUrl = inner;
            }

            // If it's a YouTube URL, extract using yt-dlp
            if (targetAudioUrl.includes('youtube.com') || targetAudioUrl.includes('youtu.be')) {
              const match = targetAudioUrl.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/i);
              const cleanUrl: string = (match && match[1]) ? `https://www.youtube.com/watch?v=${match[1]}` : targetAudioUrl;
              const title: string = urlObj.searchParams.get('title') || '';
              const artist: string = urlObj.searchParams.get('artist') || '';

              const runYtdlp = (target: string, extraArgs: string[] = []): Promise<boolean> => {
                return new Promise((resolve) => {
                  const args: string[] = [
                    '-o', '-',
                    '-f', 'ba/ba*/b',
                    '--no-warnings',
                    '--no-playlist',
                    '--no-check-certificates',
                    '--extractor-args', 'youtube:player_client=android',
                    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                    ...extraArgs,
                    target
                  ];

                  const proc: any = spawn('yt-dlp', args);
                  let headersSent = false;
                  let stderr = '';

                  proc.stdout.once('data', (chunk: any) => {
                    headersSent = true;
                    let contentType = 'audio/webm';
                    if (chunk.length >= 8 && chunk.toString('ascii', 4, 8) === 'ftyp') {
                      contentType = 'audio/mp4';
                    } else if (chunk.length >= 4 && chunk.readUInt32BE(0) === 0x1a45dfa3) {
                      contentType = 'audio/webm';
                    } else if (chunk.length >= 3 && chunk.toString('ascii', 0, 3) === 'ID3') {
                      contentType = 'audio/mpeg';
                    }
                    res.statusCode = 200;
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Content-Type', contentType);
                    res.write(chunk);
                    proc.stdout.pipe(res);
                    resolve(true);
                  });

                  proc.stderr.on('data', (chunk: any) => {
                    stderr += chunk.toString();
                  });

                  proc.on('close', () => {
                    if (!headersSent) {
                      resolve(false);
                    }
                  });

                  proc.on('error', () => {
                    if (!headersSent) {
                      resolve(false);
                    }
                  });

                  req.on('close', () => {
                    try { proc.kill(); } catch {}
                  });
                });
              };

              // Tier 1: Direct URL with Android client
              let success = await runYtdlp(cleanUrl);
              if (success || res.headersSent) return;

              // Tier 2: Direct URL with Android + Web fallback combo
              success = await runYtdlp(cleanUrl, ['--extractor-args', 'youtube:player_client=android,web']);
              if (success || res.headersSent) return;

              // Tier 3: Search fallback with artist and title (SoundCloud first, then YouTube)
              const queryParts = [artist, title].filter(Boolean).join(' ').trim();
              if (queryParts) {
                success = await runYtdlp(`scsearch1:${queryParts}`, []);
                if (success || res.headersSent) return;
                success = await runYtdlp(`scsearch1:${queryParts} audio`, []);
                if (success || res.headersSent) return;
                success = await runYtdlp(`ytsearch1:${queryParts} audio`);
                if (success || res.headersSent) return;
                success = await runYtdlp(`ytsearch1:${queryParts}`);
                if (success || res.headersSent) return;
              }

              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end('Audio extraction error: video unavailable or blocked');
              }
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
