/**
 * Helper to fetch an image URL and convert to Blob for ID3 embedding.
 * If CORS prevents fetching directly, falls back to a synthesized artistic cover art.
 */
export async function urlToImageBlob(imageUrl: string, fallbackTitle: string, fallbackArtist: string): Promise<Blob> {
  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (res.ok) {
      return await res.blob();
    }
  } catch (err) {
    console.warn('Direct image fetch blocked by CORS, synthesizing artistic cover:', err);
  }

  // Fallback: create dynamic studio album art canvas
  return generateArtisticCoverBlob(fallbackTitle, fallbackArtist);
}

/**
 * Generates a modern Spotify/Apple Music style album artwork canvas
 */
export function generateArtisticCoverBlob(title: string, artist: string): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      // Emergency 1x1 blob
      resolve(new Blob([], { type: 'image/jpeg' }));
      return;
    }

    // Dynamic gradient based on title characters
    const hue1 = (title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 17) % 360;
    const hue2 = (hue1 + 75) % 360;

    const grad = ctx.createLinearGradient(0, 0, 600, 600);
    grad.addColorStop(0, `hsl(${hue1}, 80%, 20%)`);
    grad.addColorStop(0.5, `hsl(${hue2}, 75%, 35%)`);
    grad.addColorStop(1, '#0f0f13');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 600);

    // Subtle background mesh circles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.arc(300, 300, 240, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(300, 300, 160, 0, Math.PI * 2);
    ctx.fill();

    // Center vinyl ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(300, 300, 100, 0, Math.PI * 2);
    ctx.stroke();

    // Center badge
    ctx.fillStyle = '#1db954';
    ctx.beginPath();
    ctx.arc(300, 300, 28, 0, Math.PI * 2);
    ctx.fill();

    // App watermark badge top left
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('WeTune Studio 320k', 40, 65);

    // Title at bottom
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    const displayTitle = title.length > 25 ? title.substring(0, 23) + '...' : title;
    ctx.fillText(displayTitle || 'Untitled Track', 40, 500);

    // Artist at bottom
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '500 24px system-ui, -apple-system, sans-serif';
    const displayArtist = artist.length > 30 ? artist.substring(0, 28) + '...' : artist;
    ctx.fillText(displayArtist || 'Unknown Artist', 40, 545);

    canvas.toBlob((blob) => {
      resolve(blob || new Blob([], { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  });
}
