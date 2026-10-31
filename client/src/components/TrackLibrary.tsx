import React, { useState } from 'react';
import { 
  Search, 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Music2, 
  Clock, 
  HardDrive, 
  Sparkles,
  Disc3
} from 'lucide-react';
import Swal from 'sweetalert2';
import type { ConvertedTrack } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { deleteTrack } from '../utils/storage';

interface TrackLibraryProps {
  tracks: ConvertedTrack[];
  onTrackDeleted: (id: string) => void;
  onGoToConvert: () => void;
}

export const TrackLibrary: React.FC<TrackLibraryProps> = ({ tracks, onTrackDeleted, onGoToConvert }) => {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBitrate, setFilterBitrate] = useState<'all' | '320' | '256' | '192' | '128'>('all');

  // Filtered tracks
  const filteredTracks = tracks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.album.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBitrate =
      filterBitrate === 'all' || t.bitrate.toString() === filterBitrate;

    return matchesSearch && matchesBitrate;
  });

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleDownload = (track: ConvertedTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = URL.createObjectURL(track.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = track.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDelete = async (track: ConvertedTrack, e: React.MouseEvent) => {
    e.stopPropagation();

    const result = await Swal.fire({
      title: 'Delete this track?',
      text: `Are you sure you want to remove "${track.title}" from your library?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#27272a',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Keep track',
      background: '#12131a',
      color: '#ffffff'
    });

    if (result.isConfirmed) {
      await deleteTrack(track.id);
      onTrackDeleted(track.id);
      Swal.fire({
        title: 'Deleted',
        text: 'The track has been removed from your local library.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        background: '#12131a',
        color: '#ffffff'
      });
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Music2 className="w-7 h-7 text-[#1db954]" />
            <span>Music Library</span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-zinc-300">
              {tracks.length} {tracks.length === 1 ? 'Track' : 'Tracks'}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            All converted MP3s with embedded ID3 tags saved in your browser storage.
          </p>
        </div>

        {/* Action button */}
        <button
          onClick={onGoToConvert}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#1db954] to-emerald-600 text-black font-bold text-xs sm:text-sm flex items-center gap-2 hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>Convert New Track</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white/[0.03] p-3 rounded-2xl border border-white/10">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, artist, or album..."
            className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Bitrate Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', '320', '256', '192', '128'] as const).map((rate) => (
            <button
              key={rate}
              onClick={() => setFilterBitrate(rate)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filterBitrate === rate
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-black/30 text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              {rate === 'all' ? 'All Bitrates' : `${rate}k`}
            </button>
          ))}
        </div>
      </div>

      {/* Tracks Grid / List */}
      {filteredTracks.length === 0 ? (
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/10 rounded-3xl p-10 sm:p-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 text-zinc-500 flex items-center justify-center mx-auto">
            <Disc3 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">
              {searchTerm ? 'No matching tracks found' : 'Your Music Library is Empty'}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
              {searchTerm
                ? 'Try searching with a different keyword or clear your search query.'
                : 'Convert your first YouTube video, upload a music file, or try the instant synthwave demo!'}
            </p>
          </div>
          <button
            onClick={onGoToConvert}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-xs sm:text-sm inline-flex items-center gap-2 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start Converting</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTracks.map((track) => {
            const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;
            const isThisCurrentTrack = currentTrack?.id === track.id;

            return (
              <div
                key={track.id}
                onClick={() => {
                  if (isThisTrackPlaying) {
                    togglePlay();
                  } else {
                    playTrack(track, filteredTracks);
                  }
                }}
                className={`group backdrop-blur-xl rounded-2xl p-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between ${
                  isThisCurrentTrack
                    ? 'bg-gradient-to-b from-emerald-500/10 via-black/60 to-black/80 border-emerald-500/50 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                    : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20'
                }`}
              >
                {/* Top Section: Cover Art & Track info */}
                <div className="flex items-start gap-3.5 mb-3">
                  {/* Cover Art with Hover Play Button */}
                  <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden shrink-0 bg-zinc-800 shadow-md">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div
                      className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                        isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-[#1db954] text-black flex items-center justify-center shadow-lg shadow-black/50">
                        {isThisTrackPlaying ? (
                          <Pause className="w-4 h-4 fill-black" />
                        ) : (
                          <Play className="w-4 h-4 fill-black ml-0.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title and metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase">
                        {track.bitrate}k MP3
                      </span>
                      {track.sourceType === 'youtube' && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 uppercase">
                          YT
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-white truncate mt-1 group-hover:text-emerald-400 transition-colors">
                      {track.title}
                    </h4>
                    <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">{track.album}</p>
                  </div>
                </div>

                {/* Bottom stats and action bar */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      {formatTime(track.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                      {formatFileSize(track.fileSize)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDownload(track, e)}
                      title="Download MP3 with ID3 tags"
                      className="p-2 rounded-xl bg-white/5 hover:bg-emerald-500 hover:text-black text-zinc-300 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(track, e)}
                      title="Delete from library"
                      className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
