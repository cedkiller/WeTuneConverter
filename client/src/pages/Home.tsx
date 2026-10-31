import { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { AudioConverter } from '../components/AudioConverter';
import { TrackLibrary } from '../components/TrackLibrary';
import { AudioPlayerDock } from '../components/AudioPlayerDock';
import { TrackModal } from '../components/TrackModal';
import { Footer } from '../components/Footer';
import type { ConvertedTrack } from '../types';
import { getAllTracks } from '../utils/storage';
import { usePlayer } from '../context/PlayerContext';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'convert' | 'library'>('convert');
  const [tracks, setTracks] = useState<ConvertedTrack[]>([]);
  const { currentTrack } = usePlayer();

  // Load existing tracks from local storage
  const loadLibrary = async () => {
    try {
      const storedTracks = await getAllTracks();
      setTracks(storedTracks);
    } catch (err) {
      console.error('Failed to load tracks from local storage:', err);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const handleTrackSaved = (newTrack: ConvertedTrack) => {
    setTracks((prev) => [newTrack, ...prev.filter((t) => t.id !== newTrack.id)]);
  };

  const handleTrackDeleted = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-white flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        trackCount={tracks.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-8 py-8 sm:py-12 max-w-7xl mx-auto w-full">
        {activeTab === 'convert' ? (
          <AudioConverter onTrackSaved={handleTrackSaved} />
        ) : (
          <TrackLibrary
            tracks={tracks}
            onTrackDeleted={handleTrackDeleted}
            onGoToConvert={() => setActiveTab('convert')}
          />
        )}
      </main>

      {/* Bottom Footer with Creator Attribution */}
      <Footer hasActivePlayer={!!currentTrack} />

      {/* Persistent Bottom Audio Player Dock */}
      <AudioPlayerDock />

      {/* Expanded Full-Screen Player View Modal */}
      <TrackModal />
    </div>
  );
}
