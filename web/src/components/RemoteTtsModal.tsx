'use client';

import React, { useState } from 'react';
import {
  Volume2,
  Square,
  Play,
  X,
  RotateCcw,
  Smartphone,
  Sparkles,
  Sliders,
  Languages,
  Check,
} from 'lucide-react';

interface RemoteTtsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName?: string;
  peerId?: string;
  isSpeaking?: boolean;
  onSpeakText: (peerId: string, text: string, pitch: number, rate: number, language?: string) => void;
  onStopSpeaking: (peerId: string) => void;
}

const PRESETS = [
  { label: '👋 Hello', text: 'Hello from laptop! PulseShare is active and running smoothly.' },
  { label: '🥤 Water', text: 'Please bring me a glass of water, thank you!' },
  { label: '💬 WhatsApp', text: 'Attention! You have an important WhatsApp message to check.' },
  { label: '🔋 Battery Full', text: 'Your phone battery is charged, please unplug the charger.' },
  { label: '📢 Alert', text: 'Urgent attention required on your computer screen right now!' },
  { label: '🇵🇰 Urdu Salam', text: 'Assalam-o-Alaikum! Aapka phone laptop se connected hai.' },
];

export const RemoteTtsModal: React.FC<RemoteTtsModalProps> = ({
  isOpen,
  onClose,
  deviceName = 'Connected Phone',
  peerId = 'all',
  isSpeaking = false,
  onSpeakText,
  onStopSpeaking,
}) => {
  const [text, setText] = useState('');
  const [pitch, setPitch] = useState(1.0);
  const [rate, setRate] = useState(1.0);
  const [language, setLanguage] = useState('');
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSpeak = (customText?: string) => {
    const speechText = (customText ?? text).trim();
    if (!speechText) return;
    onSpeakText(peerId, speechText, pitch, rate, language || undefined);
  };

  const handleSelectPreset = (pText: string, index: number) => {
    setText(pText);
    setActivePresetIndex(index);
    handleSpeak(pText);
    setTimeout(() => setActivePresetIndex(null), 1500);
  };

  const handleResetControls = () => {
    setPitch(1.0);
    setRate(1.0);
    setLanguage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-fuchsia-500/30 shadow-2xl p-6 overflow-hidden cyber-glow-fuchsia max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-fuchsia-950/80 border border-fuchsia-500/40 text-fuchsia-400 shadow-sm">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Remote Text-to-Speech (TTS)
                </h3>
                {isSpeaking && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold animate-pulse">
                    Speaking...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Speak aloud through {deviceName}&apos;s speaker</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Text Area */}
        <div className="py-4 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              Message to Speak Aloud:
            </label>
            <span className="text-[10px] font-mono text-slate-500">
              {text.length} chars
            </span>
          </div>

          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type anything here... Phone will speak it aloud immediately!"
            className="w-full px-3 py-2.5 bg-slate-950/90 border border-slate-800 focus:border-fuchsia-500/60 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none"
          />
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5 pb-3 shrink-0">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-fuchsia-400" />
            <span>1-Click Voice Announcements:</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, idx) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSelectPreset(p.text, idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition border ${
                  activePresetIndex === idx
                    ? 'bg-fuchsia-600 border-fuchsia-400 text-white'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:text-fuchsia-300 hover:border-fuchsia-500/40'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Tuning Controls (Pitch & Speed) */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-pink-400" />
              <span>Voice Modulation:</span>
            </span>
            <button
              type="button"
              onClick={handleResetControls}
              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Pitch */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Pitch:</span>
                <span className="text-fuchsia-400 font-bold">{pitch.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full accent-fuchsia-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Speed Rate */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Speed:</span>
                <span className="text-cyan-400 font-bold">{rate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
            <Languages className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-400 shrink-0">Accent / Language:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-fuchsia-500"
            >
              <option value="">Device Default Language</option>
              <option value="en">English (US)</option>
              <option value="en_gb">English (UK)</option>
              <option value="ur">Urdu (Pakistan)</option>
              <option value="hi">Hindi (India)</option>
              <option value="ar">Arabic</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 mt-auto flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onStopSpeaking(peerId)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 transition text-xs font-semibold flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Stop Audio</span>
          </button>

          <button
            type="button"
            onClick={() => handleSpeak()}
            disabled={!text.trim()}
            className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-950/50 transition"
          >
            <Play className={`w-4 h-4 ${isSpeaking ? 'animate-bounce' : ''}`} />
            <span>Speak on Phone Speaker</span>
          </button>
        </div>
      </div>
    </div>
  );
};
