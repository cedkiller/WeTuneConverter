import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Play, 
  Download, 
  Sliders, 
  Image as ImageIcon,
  Disc,
  ArrowLeftRight
} from 'lucide-react';
import type { ConvertedTrack, ConversionProgress } from '../types';
import { decodeAudioFromFile, encodeAudioBufferToMp3 } from '../utils/mp3Encoder';
import { writeID3Tags } from '../utils/id3TagWriter';
import { saveTrack } from '../utils/storage';
import { 
  fetchYouTubeInfo, 
  cleanTrackTitleAndArtist, 
  extractYouTubeId, 
  downloadRealYouTubeAudio 
} from '../utils/youtube';
import { generateArtisticCoverBlob, urlToImageBlob } from '../utils/coverArtHelper';
import { createSynthesizedMusicAudio } from '../utils/audioSamples';
import { usePlayer } from '../context/PlayerContext';

// Authentic YouTube SVG icon
const YouTubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface AudioConverterProps {
  onTrackSaved: (track: ConvertedTrack) => void;
}

export const AudioConverter: React.FC<AudioConverterProps> = ({ onTrackSaved }) => {
  const { playTrack } = usePlayer();

  const [inputMode, setInputMode] = useState<'youtube' | 'file' | 'demo'>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isFetchingYt, setIsFetchingYt] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bitrate, setBitrate] = useState<number>(320);

  // Metadata form
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('WeTune Collection');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [genre, setGenre] = useState('Pop');

  // Cover Art
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);

  // Conversion state
  const [progress, setProgress] = useState<ConversionProgress>({
    stage: 'idle',
    percent: 0,
    message: ''
  });
  const [convertedTrack, setConvertedTrack] = useState<ConvertedTrack | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-fetch YouTube metadata when URL changes
  useEffect(() => {
    if (inputMode !== 'youtube' || !youtubeUrl.trim()) return;
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) return;

    const timeout = setTimeout(async () => {
      try {
        setIsFetchingYt(true);
        const ytInfo = await fetchYouTubeInfo(youtubeUrl);
        if (ytInfo) {
          setTitle(ytInfo.cleanTitle);
          setArtist(ytInfo.cleanArtist);
          setAlbum('YouTube Music');
          setCoverUrl(ytInfo.thumbnailUrl);

          const imgBlob = await urlToImageBlob(ytInfo.thumbnailUrl, ytInfo.cleanTitle, ytInfo.cleanArtist);
          setCoverBlob(imgBlob);
        }
      } catch (err) {
        console.warn('Auto-fetch metadata notice:', err);
      } finally {
        setIsFetchingYt(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [youtubeUrl, inputMode]);

  // Swap Title and Artist
  const swapTitleAndArtist = () => {
    const currentTitle = title;
    const currentArtist = artist;
    setTitle(currentArtist);
    setArtist(currentTitle);
  };

  // Reset conversion state
  const resetForm = () => {
    setSelectedFile(null);
    setYoutubeUrl('');
    setTitle('');
    setArtist('');
    setAlbum('WeTune Collection');
    setCoverUrl('');
    setCoverBlob(null);
    setConvertedTrack(null);
    setProgress({ stage: 'idle', percent: 0, message: '' });
  };

  // Handle YouTube URL submit / change
  const handleFetchYouTube = async () => {
    if (!youtubeUrl.trim()) return;
    setIsFetchingYt(true);

    try {
      const ytInfo = await fetchYouTubeInfo(youtubeUrl);
      if (ytInfo) {
        setTitle(ytInfo.cleanTitle);
        setArtist(ytInfo.cleanArtist);
        setAlbum('YouTube Music');
        setCoverUrl(ytInfo.thumbnailUrl);

        // Preload cover blob
        const imgBlob = await urlToImageBlob(ytInfo.thumbnailUrl, ytInfo.cleanTitle, ytInfo.cleanArtist);
        setCoverBlob(imgBlob);
      } else {
        alert('Could not parse YouTube URL. Please check the link and try again.');
      }
    } catch (err) {
      console.error('Error fetching YouTube metadata:', err);
    } finally {
      setIsFetchingYt(false);
    }
  };

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Auto-detect title and artist from filename
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    const { cleanTitle, cleanArtist } = cleanTrackTitleAndArtist(cleanName, 'Unknown Artist');
    setTitle(cleanTitle);
    setArtist(cleanArtist);
    setAlbum('Studio Master');

    // Generate artistic album artwork default
    const generatedCover = await generateArtisticCoverBlob(cleanTitle, cleanArtist);
    setCoverBlob(generatedCover);
    setCoverUrl(URL.createObjectURL(generatedCover));
  };

  // Handle custom cover image upload
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverBlob(file);
    setCoverUrl(URL.createObjectURL(file));
  };

  // Execute full MP3 conversion process
  const startConversion = async () => {
    const finalTitle = title.trim() || 'Untitled Track';
    const finalArtist = artist.trim() || 'WeTune Artist';
    const finalAlbum = album.trim() || 'Single';

    try {
      setProgress({
        stage: 'decoding',
        percent: 10,
        message: 'Preparing source audio...'
      });

      let audioBuffer: AudioBuffer | null = null;
      let sourceType: 'file' | 'youtube' | 'sample' = 'file';

      if (inputMode === 'file') {
        if (!selectedFile) {
          alert('Please select an audio or video file first.');
          return;
        }
        sourceType = 'file';
        setProgress({ stage: 'decoding', percent: 25, message: 'Decoding audio file tracks...' });
        audioBuffer = await decodeAudioFromFile(selectedFile);
      } else if (inputMode === 'demo') {
        sourceType = 'sample';
        setProgress({ stage: 'decoding', percent: 25, message: 'Synthesizing 24-bit demo audio...' });
        audioBuffer = await createSynthesizedMusicAudio('synthwave', 20);
      } else {
        // YouTube mode: download the ACTUAL YouTube audio
        sourceType = 'youtube';
        const videoId = extractYouTubeId(youtubeUrl);
        if (!videoId) {
          alert('Please enter a valid YouTube URL.');
          return;
        }

        setProgress({
          stage: 'decoding',
          percent: 20,
          message: 'Connecting to YouTube audio service...'
        });

        // Download the real YouTube audio stream
        const realAudioBlob = await downloadRealYouTubeAudio(youtubeUrl, (msg, pct) => {
          setProgress({
            stage: 'decoding',
            percent: pct,
            message: msg
          });
        });

        setProgress({
          stage: 'decoding',
          percent: 85,
          message: 'Decoding downloaded YouTube audio stream...'
        });

        audioBuffer = await decodeAudioFromFile(realAudioBlob);
      }

      if (!audioBuffer) {
        throw new Error('Unable to decode source audio from YouTube. Please verify the URL or try uploading the file.');
      }

      // Step 2: Encode to MP3 using LAME at selected bitrate (up to 320 kbps)
      setProgress({
        stage: 'encoding',
        percent: 88,
        message: `Encoding audio to MP3 at ${bitrate} kbps...`
      });

      const rawMp3ArrayBuffer = await encodeAudioBufferToMp3(
        audioBuffer,
        bitrate,
        (pct) => {
          const mapped = 88 + Math.round(pct * 0.08); // 88% to 96%
          setProgress({
            stage: 'encoding',
            percent: mapped,
            message: `Encoding MP3 at ${bitrate} kbps (${pct}%)...`
          });
        }
      );

      // Step 3: Embed ID3 tags & Album Artwork
      setProgress({
        stage: 'tagging',
        percent: 97,
        message: 'Writing ID3v2.3 metadata & embedding album art...'
      });

      let finalCover = coverBlob;
      if (!finalCover) {
        finalCover = await generateArtisticCoverBlob(finalTitle, finalArtist);
      }

      const taggedMp3Blob = await writeID3Tags(rawMp3ArrayBuffer, {
        title: finalTitle,
        artist: finalArtist,
        album: finalAlbum,
        year: year.trim() || new Date().getFullYear().toString(),
        genre: genre.trim() || 'Music',
        coverBlob: finalCover
      });

      // Step 4: Create final track record
      const cleanFileName = `${finalArtist} - ${finalTitle}.mp3`.replace(/[/\\?%*:|"<>]/g, '');
      const trackId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newTrack: ConvertedTrack = {
        id: trackId,
        title: finalTitle,
        artist: finalArtist,
        album: finalAlbum,
        year: year.trim() || new Date().getFullYear().toString(),
        genre: genre.trim() || 'Music',
        duration: audioBuffer.duration,
        bitrate: bitrate,
        coverUrl: coverUrl || URL.createObjectURL(finalCover),
        coverBlob: finalCover,
        audioBlob: taggedMp3Blob,
        fileName: cleanFileName,
        fileSize: taggedMp3Blob.size,
        createdAt: Date.now(),
        sourceType,
        sourceUrl: inputMode === 'youtube' ? youtubeUrl : undefined
      };

      // Save to IndexedDB local storage library
      await saveTrack(newTrack);
      onTrackSaved(newTrack);

      setConvertedTrack(newTrack);
      setProgress({
        stage: 'completed',
        percent: 100,
        message: 'Conversion completed successfully!'
      });

    } catch (error) {
      console.error('Conversion failed:', error);
      setProgress({
        stage: 'error',
        percent: 0,
        message: error instanceof Error ? error.message : 'Conversion failed. Please try again or check the YouTube link.'
      });
    }
  };

  // Download converted MP3 file
  const downloadMp3 = () => {
    if (!convertedTrack) return;
    const url = URL.createObjectURL(convertedTrack.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = convertedTrack.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Banner / Hero Title */}
      <div className="text-center space-y-2 py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>High-Bitrate Studio MP3 Encoder</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Convert Audio with <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Full Metadata</span>
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
          Extract audio, encode up to 320 kbps MP3, and automatically embed ID3 tags with beautiful album cover art.
        </p>
      </div>

      {/* Main Glass Card */}
      <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle glowing ambient background */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Input Mode Selector */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5 mb-6">
          <button
            onClick={() => setInputMode('youtube')}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
              inputMode === 'youtube'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <YouTubeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            <span>YouTube URL</span>
          </button>

          <button
            onClick={() => setInputMode('file')}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
              inputMode === 'file'
                ? 'bg-gradient-to-r from-[#1db954] to-emerald-600 text-black shadow-lg shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <UploadCloud className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Upload File</span>
          </button>

          <button
            onClick={() => {
              setInputMode('demo');
              setTitle('Cybernetic Horizon');
              setArtist('Nova Wave Studio');
              setAlbum('Electro Pulse 2026');
              setGenre('Synthwave');
            }}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
              inputMode === 'demo'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Instant Demo</span>
          </button>
        </div>

        {/* Input Area */}
        <div className="space-y-5">
          {/* YouTube Mode */}
          {inputMode === 'youtube' && (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <YouTubeIcon className="w-4 h-4 text-red-500" />
                Paste YouTube Video or Music Link
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="e.g. https://www.youtube.com/watch?v=..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all"
                  />
                  {youtubeUrl && (
                    <button
                      onClick={() => setYoutubeUrl('')}
                      className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-zinc-300 text-xs px-1.5 py-0.5 rounded-full bg-white/5"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  onClick={handleFetchYouTube}
                  disabled={!youtubeUrl.trim() || isFetchingYt}
                  className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50"
                >
                  {isFetchingYt ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Fetch Info</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* File Upload Mode */}
          {inputMode === 'file' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-emerald-500/60 rounded-3xl p-6 sm:p-10 text-center cursor-pointer transition-all bg-white/[0.01] hover:bg-emerald-500/[0.03] group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.weba,.mp4,.webm"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3.5 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                {selectedFile ? selectedFile.name : 'Choose or Drag & Drop audio/video file'}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to pick another file`
                  : 'Supports MP3, WAV, M4A, AAC, FLAC, OGG, WebM, MP4'}
              </p>
            </div>
          )}

          {/* Instant Demo Mode Info */}
          {inputMode === 'demo' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3.5">
              <Sparkles className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Instant Studio Audio Generator</h4>
                <p className="text-xs sm:text-sm text-zinc-300">
                  Synthesizes a lush, 24-bit stereo synthwave track in memory. Perfect for immediately testing 320 kbps MP3 conversion, ID3 tag writing, cover art embedding, and player controls with zero setup!
                </p>
              </div>
            </div>
          )}

          {/* Bitrate Selector */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-400" />
                Target Audio Bitrate
              </label>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {bitrate === 320 ? 'Highest Quality (320 kbps)' : `${bitrate} kbps`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[320, 256, 192, 128].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setBitrate(rate)}
                  className={`py-2 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                    bitrate === rate
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                      : 'bg-black/30 border-white/5 text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="font-bold">{rate}k</div>
                  <div className="text-[10px] text-zinc-500 font-normal hidden sm:block">
                    {rate === 320 ? 'Studio' : rate === 256 ? 'High' : rate === 192 ? 'Standard' : 'Compact'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Metadata & Cover Art Customization Drawer */}
          <div className="bg-black/40 rounded-2xl border border-white/10 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Disc className="w-4 h-4 text-emerald-400" />
                ID3 Tag Metadata & Cover Art
              </span>
              <button
                type="button"
                onClick={swapTitleAndArtist}
                title="Swap Title and Artist"
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Swap Title & Artist</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* Cover Art Preview / Upload */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div 
                  onClick={() => coverInputRef.current?.click()}
                  className="w-32 h-32 rounded-2xl overflow-hidden bg-zinc-800 border-2 border-dashed border-white/20 hover:border-emerald-400 cursor-pointer relative group flex items-center justify-center shadow-lg"
                >
                  {coverUrl ? (
                    <img 
                      src={coverUrl} 
                      alt="Cover" 
                      className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" 
                    />
                  ) : (
                    <div className="text-center p-3">
                      <ImageIcon className="w-8 h-8 text-zinc-500 mx-auto mb-1 group-hover:text-emerald-400" />
                      <span className="text-[10px] text-zinc-400 block font-medium">Click to upload Cover Art</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold text-white">
                    Change Cover
                  </div>
                </div>
                <input 
                  ref={coverInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={handleCoverUpload}
                  className="hidden" 
                />
                <span className="text-[11px] text-zinc-500">Auto-embedded into file</span>
              </div>

              {/* Tag Inputs */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Track Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Blinding Lights"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Artist / Creator</label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="e.g. The Weeknd"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Album</label>
                  <input
                    type="text"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    placeholder="e.g. After Hours"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Year</label>
                    <input
                      type="text"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="2026"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Genre</label>
                    <input
                      type="text"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      placeholder="Pop"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar Display */}
          {progress.stage !== 'idle' && progress.stage !== 'completed' && progress.stage !== 'error' && (
            <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {progress.message}
                </span>
                <span className="text-white">{progress.percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {progress.stage === 'error' && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{progress.message}</span>
            </div>
          )}

          {/* Action Button */}
          {progress.stage !== 'completed' ? (
            <button
              onClick={startConversion}
              disabled={progress.stage === 'decoding' || progress.stage === 'encoding' || progress.stage === 'tagging'}
              className="w-full py-4 rounded-2xl font-bold text-sm sm:text-base bg-gradient-to-r from-[#1db954] via-emerald-500 to-teal-400 text-black shadow-xl shadow-emerald-500/25 hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              {progress.stage === 'decoding' || progress.stage === 'encoding' || progress.stage === 'tagging' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Converting Real Audio...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-black" />
                  <span>Convert & Embed Metadata (MP3 @ {bitrate}k)</span>
                </>
              )}
            </button>
          ) : null}

          {/* Completed State Card */}
          {progress.stage === 'completed' && convertedTrack && (
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-black/60 border border-emerald-500/30 space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Conversion Complete • Saved to Local Storage Library</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/5">
                <img
                  src={convertedTrack.coverUrl}
                  alt={convertedTrack.title}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shadow-lg border border-white/10"
                />
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg font-bold text-white line-clamp-1">{convertedTrack.title}</h3>
                  <p className="text-sm text-zinc-400">{convertedTrack.artist}</p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                      {convertedTrack.bitrate} kbps MP3
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/10 text-zinc-300 font-medium">
                      {formatTime(convertedTrack.duration)}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/10 text-zinc-300 font-medium">
                      {(convertedTrack.fileSize / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  onClick={() => playTrack(convertedTrack)}
                  className="py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-[#1db954] to-emerald-500 text-black hover:brightness-110 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Play in App</span>
                </button>

                <button
                  onClick={downloadMp3}
                  className="py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-white/15 hover:bg-white/20 text-white flex items-center justify-center gap-2 border border-white/10"
                >
                  <Download className="w-4 h-4" />
                  <span>Download MP3</span>
                </button>

                <button
                  onClick={resetForm}
                  className="py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-white border border-white/5"
                >
                  Convert Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
