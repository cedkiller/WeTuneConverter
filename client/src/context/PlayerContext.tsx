import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ConvertedTrack } from '../types';

interface PlayerContextType {
  currentTrack: ConvertedTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playlist: ConvertedTrack[];
  isExpanded: boolean;
  playTrack: (track: ConvertedTrack, playlist?: ConvertedTrack[]) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (level: number) => void;
  toggleMute: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleExpanded: () => void;
  closePlayer: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<ConvertedTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playlist, setPlaylist] = useState<ConvertedTrack[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeUrlRef = useRef<string | null>(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => handleNext();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
      }
    };
  }, []);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const playTrack = (track: ConvertedTrack, newPlaylist?: ConvertedTrack[]) => {
    if (newPlaylist) {
      setPlaylist(newPlaylist);
    }
    setCurrentTrack(track);

    if (audioRef.current) {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
      }
      const audioUrl = URL.createObjectURL(track.audioBlob);
      activeUrlRef.current = audioUrl;

      audioRef.current.src = audioUrl;
      audioRef.current.load();
      audioRef.current.play().catch((err) => console.log('Autoplay deferred:', err));
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.warn);
    }
  };

  const seek = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const setVolume = (level: number) => {
    const clamped = Math.max(0, Math.min(1, level));
    setVolumeState(clamped);
    if (isMuted && clamped > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const handleNext = () => {
    if (!currentTrack || playlist.length === 0) return;
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
      playTrack(playlist[currentIndex + 1]);
    } else if (playlist.length > 0) {
      // Loop to beginning
      playTrack(playlist[0]);
    }
  };

  const handlePrev = () => {
    if (!audioRef.current || !currentTrack || playlist.length === 0) return;
    // If playing more than 3 seconds, restart current track
    if (audioRef.current.currentTime > 3) {
      seek(0);
      return;
    }
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex > 0) {
      playTrack(playlist[currentIndex - 1]);
    } else {
      seek(0);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  const closePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setCurrentTrack(null);
    setIsExpanded(false);
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        playlist,
        isExpanded,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        nextTrack: handleNext,
        prevTrack: handlePrev,
        toggleExpanded,
        closePlayer,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
