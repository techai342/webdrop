'use client';

import { useState, useEffect } from 'react';
import App from '../src/App';

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-200">Initializing WebDrop P2P Mesh...</p>
        <p className="text-xs text-slate-500 mt-1">Starting WebRTC DataChannels</p>
      </div>
    );
  }

  return <App />;
}
