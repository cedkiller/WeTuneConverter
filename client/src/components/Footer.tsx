import React from 'react';
import { Heart, Disc3 } from 'lucide-react';

interface FooterProps {
  hasActivePlayer?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ hasActivePlayer }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`w-full border-t border-white/5 bg-black/40 backdrop-blur-md transition-all ${
      hasActivePlayer ? 'pb-28 sm:pb-32' : 'pb-10'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          {/* Brand & Mission */}
          <div className="space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Disc3 className="w-5 h-5 text-emerald-400" />
              <span className="font-extrabold text-base text-white tracking-tight">
                WeTune<span className="text-emerald-400">Converter</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
                Studio 320k
              </span>
            </div>
            <p className="text-xs text-zinc-400 max-w-md">
              High-fidelity audio extraction, ID3 metadata tagging & offline music player.
            </p>
          </div>

          {/* Copyright & Creator Credit */}
          <div className="flex flex-col items-center sm:items-end space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <span>Copyright © {currentYear}</span>
              <span className="text-zinc-600">•</span>
              <span>Created with</span>
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse inline" />
              <span>by</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                Cedrick Jasper Sarabia
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              All rights reserved • Web Portfolio Project
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
