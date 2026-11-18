import { ID3Writer } from 'browser-id3-writer';

export interface ID3TagData {
  title: string;
  artist: string;
  album?: string;
  year?: string;
  genre?: string;
  coverBlob?: Blob;
}

export async function writeID3Tags(
  mp3ArrayBuffer: ArrayBuffer,
  tags: ID3TagData
): Promise<Blob> {
  try {
    const writer: any = new ID3Writer(mp3ArrayBuffer);

    if (tags.title) {
      writer.setFrame('TIT2', tags.title.trim());
    }
    if (tags.artist) {
      writer.setFrame('TPE1', [tags.artist.trim()]);
    }
    if (tags.album) {
      writer.setFrame('TALB', tags.album.trim());
    }
    if (tags.year) {
      writer.setFrame('TYER', tags.year.trim());
    }
    if (tags.genre) {
      writer.setFrame('TCON', [tags.genre.trim()]);
    }

    if (tags.coverBlob && tags.coverBlob.size > 0) {
      const coverArrayBuffer = await tags.coverBlob.arrayBuffer();
      const mime = tags.coverBlob.type || 'image/jpeg';
      writer.setFrame('APIC', {
        type: 3, // 3 is front cover
        data: coverArrayBuffer,
        description: 'Cover',
        mimeType: mime
      });
    }

    writer.addTag();
    return writer.getBlob();
  } catch (error) {
    console.warn('ID3 tag writing warning, falling back to raw mp3:', error);
    return new Blob([mp3ArrayBuffer], { type: 'audio/mp3' });
  }
}
