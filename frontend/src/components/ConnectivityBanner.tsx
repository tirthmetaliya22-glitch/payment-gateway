"use client";

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ConnectivityBannerProps {
  isOnline: boolean;
  isChecking: boolean;
  onRetry: () => void;
}

export const ConnectivityBanner: React.FC<ConnectivityBannerProps> = ({ isOnline, isChecking, onRetry }) => {
  if (isOnline) return null;

  return (
    <div className="bg-red-600 text-white px-8 py-2.5 flex items-center justify-between shadow-xl z-[100] animate-in slide-in-from-top duration-300 sticky top-0 border-b border-white/10">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-1.5 rounded-full animate-pulse">
          <WifiOff className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-bold tracking-wide block leading-none">BACKEND OFFLINE</span>
          <span className="text-[10px] opacity-80 font-medium">Real-time features and data sync are currently disabled.</span>
        </div>
      </div>
      <button
        onClick={onRetry}
        disabled={isChecking}
        className="px-4 py-1.5 bg-white text-red-600 hover:bg-white/90 rounded-md text-[10px] font-bold uppercase transition-all shadow-sm active:scale-95 disabled:opacity-70 flex items-center gap-2"
      >
        <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
        {isChecking ? 'Restoring...' : 'Reconnect Now'}
      </button>
    </div>
  );
};
