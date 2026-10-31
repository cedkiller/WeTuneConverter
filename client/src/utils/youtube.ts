export interface YouTubeInfo {
  videoId: string;
  title: string;
  artist: string;
  album: string;
  thumbnailUrl: string;
  cleanTitle: string;
  cleanArtist: string;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // If user pasted just the 11 character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Common YouTube URL regex patterns
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/i
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function cleanTrackTitleAndArtist(rawTitle: string, authorName: string = ''): { cleanTitle: string; cleanArtist: string } {
  let title = rawTitle;

  // Remove common YouTube tags like [Official Music Video], (Audio), (Lyrics), etc.
  title = title.replace(/\s*(\(|\[)(official\s*(music\s*)?video|audio|lyrics|hd|4k|visualizer|mv|official|live|lyric\s*video)(\)|\])/gi, '');
  title = title.replace(/\s*-\s*official\s*(music\s*)?video/gi, '');

  const cleanAuthor = authorName.replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim();
  let cleanArtist = cleanAuthor || 'YouTube Artist';
  let cleanTitle = title.trim();

  // Check if title has "Artist - Song Title" or "Song Title - Artist" format
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      const part0 = parts[0].trim();
      const part1 = parts.slice(1).join(' - ').trim();

      // If part1 contains author name, part0 is song title and part1 is artist
      if (cleanAuthor && part1.toLowerCase().includes(cleanAuthor.toLowerCase())) {
        cleanTitle = part0;
        cleanArtist = part1;
      } else {
        cleanArtist = part0;
        cleanTitle = part1;
      }
    }
  } else if (title.includes(':')) {
    const parts = title.split(':');
    if (parts.length >= 2) {
      cleanArtist = parts[0].trim();
      cleanTitle = parts.slice(1).join(':').trim();
    }
  }

  if (!cleanArtist) {
    cleanArtist = cleanAuthor || 'YouTube Artist';
  }

  return { cleanTitle, cleanArtist };
}

export async function fetchYouTubeInfo(url: string): Promise<YouTubeInfo | null> {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  let rawTitle = 'YouTube Track';
  let author = 'Unknown Artist';
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const oembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(oembedUrl);
    if (response.ok) {
      const data = await response.json();
      if (data && data.title) {
        rawTitle = data.title;
      }
      if (data && data.author_name) {
        author = data.author_name;
      }
    }
  } catch (err) {
    console.warn('Could not fetch oembed info for YouTube video:', err);
  }

  const { cleanTitle, cleanArtist } = cleanTrackTitleAndArtist(rawTitle, author);

  return {
    videoId,
    title: rawTitle,
    artist: author,
    album: 'YouTube Audio',
    thumbnailUrl,
    cleanTitle,
    cleanArtist
  };
}

/**
 * Downloads the actual real audio stream from YouTube using high-speed streaming converter.
 * Polls status until conversion finishes and downloads the exact MP3 audio bytes.
 */
export async function downloadRealYouTubeAudio(
  youtubeUrl: string,
  onProgress?: (message: string, percent: number) => void
): Promise<Blob> {
  // Clean YouTube link to pure watch URL without messy playlist or tracking params
  const videoId = extractYouTubeId(youtubeUrl);
  const cleanUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : youtubeUrl.trim();

  if (onProgress) {
    onProgress('Connecting to YouTube audio service...', 15);
  }

  // Request conversion
  const initEndpoint = `/api/ytdl?format=mp3&url=${encodeURIComponent(cleanUrl)}`;
  let initData: any = null;

  try {
    const res = await fetch(initEndpoint, {
      headers: { Accept: 'application/json' }
    });
    if (res.ok) {
      initData = await res.json();
    }
  } catch (e: any) {
    console.warn('Local proxy failed, trying fallback:', e);
  }

  // Fallback direct endpoint if proxy didn't catch
  if (!initData || !initData.progress_url) {
    const fallbackRes = await fetch(`https://loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(cleanUrl)}`);
    if (fallbackRes.ok) {
      initData = await fallbackRes.json();
    }
  }

  if (!initData) {
    throw new Error('Unable to connect to YouTube download server. Please verify your connection.');
  }

  const progressUrl = initData.progress_url || `https://lto2.affadaffa.com/api/progress?id=${initData.id}`;
  let downloadUrl = initData.download_url;

  if (!downloadUrl) {
    if (onProgress) {
      onProgress('Extracting actual audio from YouTube...', 30);
    }

    let finished = false;
    let attempts = 0;
    const maxAttempts = 40; // 40 x 1.2s = 48s

    while (!finished && attempts < maxAttempts) {
      attempts++;
      await new Promise((r) => setTimeout(r, 1200));

      try {
        const pRes = await fetch(progressUrl);
        if (pRes.ok) {
          const pData = await pRes.json();
          const currentProgress = typeof pData.progress === 'number' ? Math.min(1000, pData.progress) : 0;
          const mappedPct = 30 + Math.round((currentProgress / 1000) * 40); // 30% to 70%

          if (onProgress) {
            onProgress(pData.text || 'Processing actual YouTube audio...', mappedPct);
          }

          if (pData.success === 1 && pData.download_url) {
            downloadUrl = pData.download_url;
            finished = true;
            break;
          }

          if (pData.text && pData.text.toLowerCase().includes('error')) {
            throw new Error(`YouTube stream error: ${pData.text}`);
          }
        }
      } catch (err: any) {
        if (attempts >= maxAttempts) throw err;
      }
    }
  }

  if (!downloadUrl) {
    throw new Error('Timeout waiting for YouTube stream. Please try again.');
  }

  if (onProgress) {
    onProgress('Downloading audio stream bytes...', 75);
  }

  // Use stream-proxy to avoid CORS block from download host
  const proxyDownloadUrl = `/api/stream-proxy?url=${encodeURIComponent(downloadUrl)}`;
  let audioRes = await fetch(proxyDownloadUrl);

  // If stream-proxy had an issue, try direct fetch
  if (!audioRes.ok) {
    audioRes = await fetch(downloadUrl);
  }

  if (!audioRes.ok) {
    throw new Error(`Failed to download audio file: HTTP ${audioRes.status}`);
  }

  const audioBlob = await audioRes.blob();
  if (onProgress) {
    onProgress('Actual audio received successfully!', 85);
  }

  return audioBlob;
}
