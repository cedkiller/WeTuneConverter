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
    /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i
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
  const initialId = extractYouTubeId(url);
  if (!initialId) return null;

  let rawTitle = 'YouTube Track';
  let author = 'Unknown Artist';
  let verifiedId = initialId;

  // Helper to query oembed
  const checkOembed = async (id: string): Promise<{ title?: string; author_name?: string } | null> => {
    try {
      const oembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`;
      const response = await fetch(oembedUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && data.title) {
          return data;
        }
      }
    } catch {}
    return null;
  };

  let data = await checkOembed(initialId);

  // If initial check failed, test common visual/font character confusion (I vs l vs 1)
  if (!data) {
    const chars = ['I', 'l', '1'];
    const candidates = new Set<string>();
    for (const c1 of chars) {
      if (initialId.includes(c1)) {
        for (const c2 of chars) {
          if (c1 !== c2) {
            candidates.add(initialId.replaceAll(c1, c2));
          }
        }
      }
    }

    for (const cand of candidates) {
      const candData = await checkOembed(cand);
      if (candData) {
        data = candData;
        verifiedId = cand;
        break;
      }
    }
  }

  if (data) {
    if (data.title) rawTitle = data.title;
    if (data.author_name) author = data.author_name;
  }

  const thumbnailUrl = `https://i.ytimg.com/vi/${verifiedId}/hqdefault.jpg`;
  const { cleanTitle, cleanArtist } = cleanTrackTitleAndArtist(rawTitle, author);

  return {
    videoId: verifiedId,
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
  onProgress?: (message: string, percent: number) => void,
  trackTitle: string = '',
  trackArtist: string = ''
): Promise<Blob> {
  // Clean YouTube link to pure watch URL without messy playlist or tracking params
  const videoId = extractYouTubeId(youtubeUrl);
  const cleanUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : youtubeUrl.trim();

  if (onProgress) {
    onProgress('Connecting to YouTube audio service...', 15);
  }

  let currentTitle = trackTitle;
  let currentArtist = trackArtist;

  if (!currentTitle || !currentArtist) {
    try {
      const info = await fetchYouTubeInfo(cleanUrl);
      if (info) {
        if (!currentTitle) currentTitle = info.cleanTitle;
        if (!currentArtist) currentArtist = info.cleanArtist;
      }
    } catch {}
  }

  const queryParams = new URLSearchParams({ url: cleanUrl });
  if (currentTitle) queryParams.set('title', currentTitle);
  if (currentArtist) queryParams.set('artist', currentArtist);
  const qs = queryParams.toString();

  // Request conversion initiation
  const initEndpoint = `/api/ytdl?${qs}`;
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
  if (!initData || (!initData.progress_url && !initData.download_url)) {
    try {
      const fallbackRes = await fetch(`https://loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(cleanUrl)}`);
      if (fallbackRes.ok) {
        initData = await fallbackRes.json();
      }
    } catch (fbErr) {
      console.warn('Loader fallback notice:', fbErr);
    }
  }

  // If both failed to initialize, default to direct server stream-proxy
  if (!initData) {
    initData = {
      success: 1,
      download_url: `/api/stream-proxy?${qs}`
    };
  }

  const progressUrl = initData.progress_url || (initData.id ? `https://lto2.affadaffa.com/api/progress?id=${initData.id}` : null);
  let downloadUrl = initData.download_url;

  if (!downloadUrl && progressUrl) {
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

  // If still no download url, fallback to direct stream proxy for cleanUrl
  if (!downloadUrl) {
    downloadUrl = `/api/stream-proxy?${qs}`;
  }

  if (onProgress) {
    onProgress('Downloading audio stream bytes...', 75);
  }

  // Normalize stream endpoint
  let targetStreamUrl = downloadUrl;
  if (!targetStreamUrl.startsWith('/api/') && !targetStreamUrl.startsWith('/')) {
    targetStreamUrl = `/api/stream-proxy?url=${encodeURIComponent(downloadUrl)}`;
  }

  let audioRes = await fetch(targetStreamUrl);

  // If primary stream URL returned error and it was a proxied external URL, try direct
  if (!audioRes.ok && targetStreamUrl !== downloadUrl) {
    try {
      audioRes = await fetch(downloadUrl);
    } catch {}
  }

  // If still failed, try direct stream-proxy on cleanUrl as emergency fallback
  if (!audioRes.ok) {
    const directFallbackUrl = `/api/stream-proxy?${qs}`;
    if (targetStreamUrl !== directFallbackUrl) {
      try {
        const fallbackRes = await fetch(directFallbackUrl);
        if (fallbackRes.ok) {
          audioRes = fallbackRes;
        }
      } catch {}
    }
  }

  if (!audioRes.ok) {
    let errorDetail = '';
    try {
      errorDetail = await audioRes.text();
    } catch {}
    let cleanMessage = errorDetail;
    if (cleanMessage.includes("Sign in to confirm you're not a bot")) {
      cleanMessage = "YouTube blocked this request with bot verification. Please try again with another YouTube link or search query.";
    }
    throw new Error(
      cleanMessage
        ? `YouTube stream failed: ${cleanMessage}`
        : `Failed to download audio file: HTTP ${audioRes.status}`
    );
  }

  const audioBlob = await audioRes.blob();

  // Validate blob contains audio data and not an error string or empty payload
  if (audioBlob.size < 2048) {
    const preview = await audioBlob.text().catch(() => '');
    throw new Error(`Audio download incomplete or invalid stream received: ${preview.slice(0, 150) || 'empty data'}`);
  }

  if (onProgress) {
    onProgress('Actual audio received successfully!', 85);
  }

  return audioBlob;
}
