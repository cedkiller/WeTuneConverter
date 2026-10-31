# syntax=docker/dockerfile:1

# Stage 1: Build the React client
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm ci || npm install

# Copy client source code and build production bundle
COPY client/ ./
RUN npm run build

# Stage 2: Production runtime environment
FROM node:20-alpine AS runner

WORKDIR /app

# Install Python, pip, ffmpeg, and the latest yt-dlp
RUN apk add --no-cache python3 py3-pip ffmpeg ca-certificates && \
    pip install --no-cache-dir --break-system-packages -U yt-dlp

# Copy built production assets from builder stage
COPY --from=builder /app/client/dist ./dist

# Create production server with direct YouTube audio streaming
COPY <<'EOF' /app/server.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = parseInt(process.env.PORT, 10) || 10000;

// ---------------------------------------------------------------------------
// Write YouTube cookies to disk at startup (if provided via environment var)
// To use: set the Render env var YT_COOKIES to the full Netscape cookie file
// contents (exported from browser via "Get cookies.txt LOCALLY" extension).
// ---------------------------------------------------------------------------
const COOKIES_PATH = '/tmp/yt-cookies.txt';
if (process.env.YT_COOKIES) {
  try {
    fs.writeFileSync(COOKIES_PATH, process.env.YT_COOKIES, 'utf8');
    console.log('YouTube cookies written to', COOKIES_PATH);
  } catch (e) {
    console.warn('Failed to write cookies file:', e.message);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.mjs': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.mp4': 'audio/mp4',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Build the yt-dlp argument list. If a cookies file exists, include it.
function buildYtdlpArgs(targetUrl) {
  const args = [
    '-o', '-',
    '-f', 'ba/b',
    '--no-warnings',
    '--no-playlist',
    '--extractor-args', 'youtube:player_client=android,web_embedded',
  ];

  if (fs.existsSync(COOKIES_PATH)) {
    args.push('--cookies', COOKIES_PATH);
  }

  args.push(targetUrl);
  return args;
}

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. YouTube audio initiation endpoint
  if (pathname === '/api/ytdl') {
    const targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    // Return both progress_url and download_url so the client skips the
    // loader.to fallback that triggers CORS errors from Render's datacenter IP.
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({
      success: 1,
      progress_url: `/api/progress?url=${encodeURIComponent(targetUrl)}`,
      download_url: `/api/stream-proxy?url=${encodeURIComponent(targetUrl)}`,
      format: 'mp3'
    }));
  }

  // 2. Progress status endpoint
  if (pathname === '/api/progress') {
    const targetUrl = parsedUrl.searchParams.get('url') || '';
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({
      success: 1,
      progress: 1000,
      download_url: `/api/stream-proxy?url=${encodeURIComponent(targetUrl)}`,
      text: 'Finished'
    }));
  }

  // 3. Direct audio streaming proxy
  if (pathname === '/api/stream-proxy' || pathname === '/api/direct-stream') {
    try {
      let targetUrl = parsedUrl.searchParams.get('url');
      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        return res.end('Missing url parameter');
      }

      // Unwrap any nested internal proxy parameters
      while (targetUrl.startsWith('/api/stream-proxy') || targetUrl.startsWith('/api/direct-stream')) {
        const nested = new URL(targetUrl, 'http://localhost');
        targetUrl = nested.searchParams.get('url') || targetUrl;
      }

      // If it's a YouTube URL, extract audio directly with yt-dlp
      if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
        const ytdlArgs = buildYtdlpArgs(targetUrl);
        const ytdlProc = spawn('yt-dlp', ytdlArgs, {
          env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' }
        });

        let headersSent = false;
        let stderr = '';

        ytdlProc.stdout.once('data', (firstChunk) => {
          headersSent = true;
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'audio/webm'
          });
          res.write(firstChunk);
          ytdlProc.stdout.pipe(res);
        });

        ytdlProc.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });

        ytdlProc.on('error', (err) => {
          if (!headersSent) {
            headersSent = true;
            res.writeHead(500, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
            res.end('Audio extraction error: ' + err.message);
          }
        });

        ytdlProc.on('close', (code) => {
          if (!headersSent) {
            headersSent = true;
            res.writeHead(500, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
            res.end('Audio extraction error (code ' + code + '): ' + stderr);
          }
        });

        req.on('close', () => {
          ytdlProc.kill();
        });

        return;
      }

      // Standard remote HTTP URL fallback
      const fetchRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!fetchRes.ok) {
        res.writeHead(fetchRes.status, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
        return res.end(`Failed to fetch audio stream: HTTP ${fetchRes.status}`);
      }

      const contentType = fetchRes.headers.get('content-type') || 'audio/mpeg';
      const contentLength = fetchRes.headers.get('content-length');
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': contentType
      };
      if (contentLength) {
        headers['Content-Length'] = contentLength;
      }
      res.writeHead(200, headers);

      if (fetchRes.body) {
        Readable.fromWeb(fetchRes.body).pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain'
        });
      }
      return res.end('Proxy streaming error: ' + err.message);
    }
    return;
  }

  // 4. Serve static files with Single Page Application (SPA) fallback
  const cleanPath = pathname.replace(/^\/+/, '');
  let filePath = path.join(DIST_DIR, cleanPath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      return res.end('Internal Server Error');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
EOF

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.mjs"]
