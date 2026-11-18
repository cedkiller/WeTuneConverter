import React from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Download, 
  X
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const AudioPlayerDock: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    nextTrack,
    prevTrack,
    toggleExpanded,
    closePlayer
  } = usePlayer();

  if (!currentTrack) return null;

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek(val);
  };

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
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl bg-[#090a0f]/95 border-t border-white/10 px-4 sm:px-6 py-2.5 sm:py-3 shadow-2xl transition-all"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-1.5">
        {/* Scrubber Progress Bar for Mobile & Desktop */}
        <div className="w-full flex items-center gap-2 group">
          <span className="text-[10px] sm:text-xs font-mono text-zinc-400 w-8 sm:w-10 text-right">
            {formatTime(currentTime)}
          </span>

          <div className="relative flex-1 flex items-center h-4 cursor-pointer">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeekChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            {/* Background track */}
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden group-hover:h-2 transition-all">
              <div
                className="h-full bg-gradient-to-r from-[#1db954] to-emerald-400 relative"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Scrubber thumb handle */}
            <div
              className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-md pointer-events-none group-hover:scale-125 transition-transform"
              style={{ left: `calc(${progressPercent}% - 6px)` }}
            />
          </div>

          <span className="text-[10px] sm:text-xs font-mono text-zinc-400 w-8 sm:w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Player Controls & Track Info Bar */}
        <div className="flex items-center justify-between gap-3">
          {/* Track Info & Cover Art */}
          <div 
            onClick={toggleExpanded}
            className="flex items-center gap-3 cursor-pointer group min-w-0 flex-1 sm:flex-initial sm:w-64"
          >
            <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-800 shadow-md border border-white/10">
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform ${isPlaying ? 'scale-105' : ''}`}
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="flex items-end gap-0.5 h-3">
                    <div className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-full" />
                    <div className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-2" />
                    <div className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-3" />
                  </div>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                {currentTrack.title}
              </h4>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Center Playback Controls */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              onClick={prevTrack}
              title="Previous / Restart"
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-r from-[#1db954] to-emerald-500 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/25"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-black" />
              ) : (
                <Play className="w-5 h-5 fill-black ml-0.5" />
              )}
            </button>

            <button
              onClick={nextTrack}
              title="Next Track"
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Right Controls: Volume, Download, Expand, Close */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Volume Control (Desktop) */}
            <div className="hidden md:flex items-center gap-2 w-28">
              <button 
                onClick={toggleMute}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 h-1 rounded-full bg-white/10 accent-emerald-400 cursor-pointer"
              />
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              title="Download MP3"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all hidden sm:flex"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Expand / Maximize view */}
            <button
              onClick={toggleExpanded}
              title="Expand Player"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Close / Dismiss */}
            <button
              onClick={closePlayer}
              title="Close Player"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-red-400 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
