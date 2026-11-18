import React from 'react';
import { 
  X, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Download, 
  Disc, 
  Sparkles,
  Tag,
  Calendar,
  HardDrive
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const TrackModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isExpanded,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    nextTrack,
    prevTrack,
    toggleExpanded
  } = usePlayer();

  if (!isExpanded || !currentTrack) return null;

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleDownload = () => {
    const url = URL.createObjectURL(currentTrack.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentTrack.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-3xl animate-in fade-in duration-300 overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none opacity-20 overflow-hidden flex items-center justify-center">
        <img
          src={currentTrack.coverUrl}
          alt=""
          className="w-[800px] h-[800px] object-cover blur-3xl scale-150"
        />
      </div>

      <div className="relative w-full max-w-lg bg-[#0e1017]/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Now Playing
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-semibold">
              {currentTrack.bitrate} kbps
            </span>
          </div>
          <button
            onClick={toggleExpanded}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Artwork with Vinyl Look */}
        <div className="relative mx-auto w-56 h-56 sm:w-64 sm:h-64 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/10 border border-white/15 group">
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Title & Artist */}
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight line-clamp-1">
            {currentTrack.title}
          </h2>
          <p className="text-sm font-semibold text-zinc-400 line-clamp-1">
            {currentTrack.artist}
          </p>
          <p className="text-xs text-zinc-500">
            {currentTrack.album} • {currentTrack.year}
          </p>
        </div>

        {/* Scrubber */}
        <div className="space-y-1.5">
          <div className="relative flex items-center h-4 cursor-pointer">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1db954] to-emerald-400"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-xs font-mono text-zinc-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Playback Controls */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={prevTrack}
            className="p-3 text-zinc-300 hover:text-white transition-colors"
          >
            <SkipBack className="w-6 h-6" />
          </button>

          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#1db954] to-emerald-400 text-black flex items-center justify-center shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-black" />
            ) : (
              <Play className="w-7 h-7 fill-black ml-1" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-3 text-zinc-300 hover:text-white transition-colors"
          >
            <SkipForward className="w-6 h-6" />
          </button>
        </div>

        {/* Volume & Download Footer */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <button onClick={toggleMute} className="text-zinc-400 hover:text-white">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full max-w-[140px] h-1.5 rounded-full bg-white/10 accent-emerald-400 cursor-pointer"
            />
          </div>

          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-emerald-500 hover:text-black text-white font-bold text-xs flex items-center gap-2 transition-all border border-white/10"
          >
            <Download className="w-4 h-4" />
            <span>Download MP3</span>
          </button>
        </div>

        {/* Metadata Specs Box */}
        <div className="bg-black/40 rounded-2xl p-3.5 border border-white/5 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate">Genre: {currentTrack.genre || 'Music'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Year: {currentTrack.year}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Size: {(currentTrack.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Disc className="w-3.5 h-3.5 text-emerald-400" />
            <span>ID3v2.3 Tagged</span>
          </div>
        </div>
      </div>
    </div>
  );
};
