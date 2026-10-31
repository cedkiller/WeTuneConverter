import React from 'react';
import { Disc3, Library, Sparkles } from 'lucide-react';

interface NavbarProps {
  activeTab: 'convert' | 'library';
  setActiveTab: (tab: 'convert' | 'library') => void;
  trackCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, trackCount }) => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0d0f17]/90 border-b border-white/10 px-4 sm:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => setActiveTab('convert')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1db954] via-[#10b981] to-[#06b6d4] flex items-center justify-center shadow-lg shadow-[#1db954]/20 group-hover:scale-105 transition-transform">
            <Disc3 className="w-6 h-6 text-black animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-white">
                WeTune
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 uppercase tracking-wider">
                Pro 320k
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium hidden sm:block">
              Studio MP3 Converter & Music Hub
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('convert')}
            className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'convert'
                ? 'bg-gradient-to-r from-[#1db954] to-emerald-600 text-black shadow-md shadow-[#1db954]/25'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Convert</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 relative ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-[#1db954] to-emerald-600 text-black shadow-md shadow-[#1db954]/25'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Library className="w-4 h-4" />
            <span>Library</span>
            {trackCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'library' ? 'bg-black text-emerald-400' : 'bg-emerald-500/30 text-emerald-300'
              }`}>
                {trackCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
