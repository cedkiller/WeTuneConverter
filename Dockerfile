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

# Install Python, pip, ffmpeg, ca-certificates, curl, and the latest yt-dlp
RUN apk add --no-cache python3 py3-pip ffmpeg ca-certificates curl && \
    pip install --no-cache-dir --break-system-packages -U yt-dlp

# Copy environment file, cookies, and built production assets
COPY client/.env* cookies.txt* ./
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

// Automatically load cookies from environment variable, cookies.txt, OR local .env file
const COOKIES_PATH = '/tmp/yt-cookies.txt';
let cookiesContent = process.env.YT_COOKIES || process.env.COOKIES || '';

if (process.env.YT_COOKIES_BASE64) {
  try {
    cookiesContent = Buffer.from(process.env.YT_COOKIES_BASE64, 'base64').toString('utf8');
  } catch {}
}

if (!cookiesContent) {
  const possiblePaths = [
    '/app/cookies.txt',
    path.join(__dirname, 'cookies.txt'),
    path.join(__dirname, 'client', 'cookies.txt'),
    path.join(__dirname, '.env'),
    path.join(__dirname, 'client', '.env'),
    path.join(process.cwd(), 'cookies.txt'),
    path.join(process.cwd(), 'client', 'cookies.txt'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'client', '.env')
  ];
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const raw = fs.readFileSync(envPath, 'utf8');
        // Ignore stale expired placeholder tokens that cause Google rejection
        if (raw.includes('WtFMf21MMHA')) {
          continue;
        }
        if (envPath.endsWith('cookies.txt') && raw.length > 50) {
          cookiesContent = raw.trim();
          console.log(`[WeTune] Loaded ${cookiesContent.length} bytes of YouTube cookies from ${envPath}`);
          break;
        }
        const match = raw.match(/YT_COOKIES\s*=\s*([\s\S]+)/);
        if (match && match[1] && match[1].length > 50) {
          cookiesContent = match[1].trim();
          console.log(`[WeTune] Loaded ${cookiesContent.length} bytes of YouTube cookies from ${envPath}`);
          break;
        }
      } catch (err) {
        console.warn('[WeTune] Failed reading', envPath, err.message);
      }
    }
  }
}

if (cookiesContent) {
  try {
    const normalized = cookiesContent
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .trim();
    fs.writeFileSync(COOKIES_PATH, normalized, 'utf8');
    console.log(`[WeTune] YouTube cookies written to ${COOKIES_PATH} (${normalized.length} bytes)`);
  } catch (e) {
    console.warn('[WeTune] Failed to write cookies file:', e.message);
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

function extractCleanYouTubeUrl(inputUrl) {
  const match = inputUrl.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/i);
  if (match && match[1]) {
    return `https://www.youtube.com/watch?v=${match[1]}`;
  }
  return inputUrl.trim();
}

async function getCandidateTargets(cleanUrl, title = '', artist = '') {
  const candidates = [cleanUrl];
  const videoIdMatch = cleanUrl.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/i);
  if (videoIdMatch && videoIdMatch[1]) {
    const id = videoIdMatch[1];
    // Generate OCR / font ambiguity candidates (I vs l vs 1)
    const variations = new Set();
    const chars = ['I', 'l', '1'];
    for (const c1 of chars) {
      if (id.includes(c1)) {
        for (const c2 of chars) {
          if (c1 !== c2) {
            variations.add(id.replaceAll(c1, c2));
          }
        }
      }
    }
    for (const v of variations) {
      candidates.push(`https://www.youtube.com/watch?v=${v}`);
    }
  }

  let finalTitle = title;
  let finalArtist = artist;

  // If title/artist not provided in query, fetch automatically via oEmbed
  if (!finalTitle && !finalArtist) {
    try {
      const oRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`);
      if (oRes.ok) {
        const oData = await oRes.json();
        if (oData && oData.title) finalTitle = oData.title;
        if (oData && oData.author_name) finalArtist = oData.author_name;
      }
    } catch {}
  }

  // If title and artist are present, add high-speed SoundCloud and YouTube search candidates
  const cleanTitle = (finalTitle || '').replace(/[()[\]{}"']/g, ' ').replace(/\s*(official\s*(music\s*)?video|audio|lyrics|hd|4k|visualizer|mv)\s*/gi, '').trim();
  const cleanArtist = (finalArtist || '').replace(/[()[\]{}"']/g, ' ').replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim();
  if (cleanTitle || cleanArtist) {
    const combined = [cleanArtist, cleanTitle].filter(Boolean).join(' ').trim();
    if (combined) {
      // SoundCloud search: unblocked on cloud datacenter IPs (Render/AWS) without botwall issues
      candidates.push(`scsearch1:${combined}`);
      candidates.push(`scsearch1:${combined} audio`);
      candidates.push(`ytsearch1:${combined} audio`);
      candidates.push(`ytsearch1:${combined}`);
    }
  }

  return candidates;
}

// Function to stream YouTube audio using yt-dlp with multi-tiered fallback
async function streamYouTubeAudio(targetUrl, req, res, title = '', artist = '') {
  const cleanUrl = extractCleanYouTubeUrl(targetUrl);
  const targets = await getCandidateTargets(cleanUrl, title, artist);

  const baseArgs = [
    '-4',
    '--no-warnings',
    '--no-playlist',
    '--no-check-certificates',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    '--js-runtimes', 'node',
    '--remote-components', 'ejs:github'
  ];

  const hasCookies = fs.existsSync(COOKIES_PATH) && fs.statSync(COOKIES_PATH).size > 20;

  // Helper to dynamically detect audio container format from stream magic bytes
  const detectContentType = (buffer) => {
    if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      return 'audio/mp4';
    }
    if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0x1a45dfa3) {
      return 'audio/webm';
    }
    if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') {
      return 'audio/mpeg';
    }
    return 'audio/webm';
  };

  // Strategy A: Direct stdout stream
  const tryStream = (target, extraArgs = []) => {
    return new Promise((resolve, reject) => {
      const args = ['-o', '-', '-f', 'ba/ba*/b', ...baseArgs, ...extraArgs, target];
      console.log('Spawning yt-dlp stream:', args.join(' '));

      const proc = spawn('yt-dlp', args, {
        env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' }
      });

      let headersSent = false;
      let stderr = '';

      proc.stdout.once('data', (firstChunk) => {
        headersSent = true;
        const contentType = detectContentType(firstChunk);
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': contentType
        });
        res.write(firstChunk);
        proc.stdout.pipe(res);
        resolve(true);
      });

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => {
        if (!headersSent) reject(err);
      });

      proc.on('close', (code) => {
        if (!headersSent) {
          reject(new Error(`yt-dlp failed (code ${code}): ${stderr}`));
        }
      });

      req.on('close', () => {
        try { proc.kill(); } catch {}
      });
    });
  };

  // Strategy B: Resolve direct stream URL via yt-dlp -g and proxy it with fetch
  const tryDirectUrl = (target, extraArgs = []) => {
    return new Promise((resolve, reject) => {
      const args = ['-g', '-f', 'ba/ba*/b', ...baseArgs, ...extraArgs, target];
      console.log('Resolving stream URL with yt-dlp -g:', args.join(' '));

      const proc = spawn('yt-dlp', args, {
        env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

      proc.on('error', (err) => reject(err));

      proc.on('close', async (code) => {
        const streamUrl = stdout.trim().split('\n')[0];
        if (code === 0 && streamUrl && streamUrl.startsWith('http')) {
          try {
            console.log('Direct stream URL extracted, fetching...');
            const fetchRes = await fetch(streamUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
              }
            });

            if (fetchRes.ok) {
              const contentType = fetchRes.headers.get('content-type') || 'audio/webm';
              const contentLength = fetchRes.headers.get('content-length');
              const headers = {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': contentType
              };
              if (contentLength) headers['Content-Length'] = contentLength;
              res.writeHead(200, headers);

              if (fetchRes.body) {
                Readable.fromWeb(fetchRes.body).pipe(res);
              } else {
                res.end();
              }
              return resolve(true);
            } else {
              return reject(new Error(`Direct stream fetch error: HTTP ${fetchRes.status}`));
            }
          } catch (fetchErr) {
            return reject(fetchErr);
          }
        }
        reject(new Error(`yt-dlp -g failed (code ${code}): ${stderr}`));
      });

      req.on('close', () => {
        try { proc.kill(); } catch {}
      });
    });
  };

  // Client combinations prioritized for datacenter cloud environments (Render / AWS)
  const clientTiers = [
    // Tier 1: Android client - bypasses YouTube web botguard on cloud datacenter IPs
    ['--extractor-args', 'youtube:player_client=android'],
    // Tier 2: Android + Web fallback combo
    ['--extractor-args', 'youtube:player_client=android,web'],
    // Tier 3: Android VR + Android
    ['--extractor-args', 'youtube:player_client=android_vr,android'],
    // Tier 4: Web Safari client
    ['--extractor-args', 'youtube:player_client=web_safari,web'],
    // Tier 5: Default web client
    []
  ];

  let lastError = null;

  for (const target of targets) {
    const isYouTube = target.includes('youtube.com') || target.includes('youtu.be') || target.startsWith('ytsearch');
    const tiers = isYouTube ? clientTiers : [[]];

    for (const clientArgs of tiers) {
      if (res.headersSent) return;

      // 1. If fresh cookies are present and target is YouTube, try stream with cookies
      if (hasCookies && isYouTube) {
        try {
          await tryStream(target, [...clientArgs, '--cookies', COOKIES_PATH]);
          return;
        } catch (err) {
          lastError = err;
        }
      }

      if (res.headersSent) return;

      // 2. Try direct streaming without cookies
      try {
        await tryStream(target, clientArgs);
        return;
      } catch (err) {
        lastError = err;
      }

      if (res.headersSent) return;

      // 3. Try URL resolving with this client tier
      try {
        await tryDirectUrl(target, (hasCookies && isYouTube) ? [...clientArgs, '--cookies', COOKIES_PATH] : clientArgs);
        return;
      } catch (err) {
        lastError = err;
      }
    }
  }

  if (!res.headersSent) {
    res.writeHead(500, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end(`YouTube extraction failed: ${lastError ? lastError.message : 'Unknown error'}`);
  }
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
    const title = parsedUrl.searchParams.get('title') || '';
    const artist = parsedUrl.searchParams.get('artist') || '';
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    const queryParams = new URLSearchParams({ url: targetUrl });
    if (title) queryParams.set('title', title);
    if (artist) queryParams.set('artist', artist);
    const qs = queryParams.toString();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({
      success: 1,
      progress_url: `/api/progress?${qs}`,
      download_url: `/api/stream-proxy?${qs}`,
      format: 'mp3'
    }));
  }

  // 2. Progress status endpoint
  if (pathname === '/api/progress') {
    const targetUrl = parsedUrl.searchParams.get('url') || '';
    const title = parsedUrl.searchParams.get('title') || '';
    const artist = parsedUrl.searchParams.get('artist') || '';
    const queryParams = new URLSearchParams({ url: targetUrl });
    if (title) queryParams.set('title', title);
    if (artist) queryParams.set('artist', artist);
    const qs = queryParams.toString();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({
      success: 1,
      progress: 1000,
      download_url: `/api/stream-proxy?${qs}`,
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
        const title = parsedUrl.searchParams.get('title') || '';
        const artist = parsedUrl.searchParams.get('artist') || '';
        await streamYouTubeAudio(targetUrl, req, res, title, artist);
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
