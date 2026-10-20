'use client';

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileArchive,
  FileImage,
  FileCode,
  FileText,
  AlertCircle,
  Plus,
} from 'lucide-react';
import type { P2PConnectionState } from '../lib/types';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  connectionState: P2PConnectionState;
  targetName?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  connectionState,
  targetName,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isConnected = connectionState === 'connected';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isConnected) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isConnected) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onFilesSelected(filesArray);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      onFilesSelected(filesArray);
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  const handleClickZone = () => {
    if (!isConnected) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full mb-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickZone}
        className={`relative w-full rounded-2xl border-2 border-dashed p-8 md:p-12 transition-all flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden ${
          !isConnected
            ? 'border-slate-800 bg-slate-950/40 opacity-70 cursor-not-allowed'
            : isDragOver
            ? 'border-cyan-400 bg-cyan-950/20 cyber-glow-cyan scale-[1.01]'
            : 'border-slate-800/90 hover:border-cyan-500/60 bg-slate-900/40 hover:bg-slate-900/60 shadow-xl'
        }`}
      >
        {/* Glow ambient circle */}
        <div
          className={`absolute -top-24 -left-24 w-60 h-60 rounded-full blur-3xl pointer-events-none transition-opacity ${
            isDragOver ? 'bg-cyan-500/20 opacity-100' : 'bg-cyan-500/5 opacity-40'
          }`}
        />
        <div
          className={`absolute -bottom-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none transition-opacity ${
            isDragOver ? 'bg-emerald-500/20 opacity-100' : 'bg-emerald-500/5 opacity-40'
          }`}
        />

        {/* Center Icon */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform ${
            isDragOver
              ? 'scale-110 bg-cyan-500/20 border border-cyan-400/80 text-cyan-300'
              : isConnected
              ? 'bg-slate-800/80 border border-slate-700 text-cyan-400'
              : 'bg-slate-900 border border-slate-800 text-slate-600'
          }`}
        >
          {isConnected ? (
            <UploadCloud className="w-8 h-8" />
          ) : (
            <AlertCircle className="w-8 h-8 text-amber-500/80" />
          )}
        </div>

        {/* Instructions */}
        {isConnected ? (
          <>
            {targetName && (
              <span className="mb-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono flex items-center gap-1.5 shadow-sm">
                <span>🎯 Target:</span>
                <span className="font-bold text-slate-100">{targetName}</span>
              </span>
            )}
            <h3 className="text-lg md:text-xl font-bold text-slate-100 mb-1">
              Drag & Drop Files Here or <span className="text-cyan-400 underline decoration-cyan-500/50 underline-offset-4">Browse</span>
            </h3>
            <p className="text-xs md:text-sm text-slate-400 max-w-md mb-6">
              Transfer multi-gigabyte archives, images, code files, and documents directly to your peer with zero size limits.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-base md:text-lg font-bold text-slate-300 mb-1">
              Connect a Peer to Enable Direct Transfer
            </h3>
            <p className="text-xs text-slate-500 max-w-md mb-6">
              Share your room PIN or scan the QR code from another device on the same network to begin sharing files.
            </p>
          </>
        )}

        {/* File Type Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-mono">
            <FileArchive className="w-3.5 h-3.5 text-amber-400" />
            <span>ZIP / Archives</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-mono">
            <FileImage className="w-3.5 h-3.5 text-pink-400" />
            <span>Images (PNG, JPG, WEBP)</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-mono">
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>Code (TS, JS, PY, JSON)</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-mono">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Documents (PDF, MD, DOCX)</span>
          </span>
        </div>

        {isConnected && (
          <button
            type="button"
            className="mt-6 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Select Files to Send
          </button>
        )}
      </div>
    </div>
  );
};
