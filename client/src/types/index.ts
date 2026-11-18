export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  year?: string;
  genre?: string;
  duration: number; // in seconds
  bitrate: number; // in kbps (e.g. 320)
  coverUrl?: string; // object URL or data URL for display
  coverBlob?: Blob; // raw image blob for ID3 tag embedding
}

export interface ConvertedTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  duration: number;
  bitrate: number;
  coverUrl: string;
  coverBlob?: Blob;
  audioBlob: Blob;
  fileName: string;
  fileSize: number; // in bytes
  createdAt: number;
  sourceType: 'file' | 'youtube' | 'sample';
  sourceUrl?: string;
}

export interface ConversionProgress {
  stage: 'idle' | 'decoding' | 'encoding' | 'tagging' | 'completed' | 'error';
  percent: number;
  message: string;
}
