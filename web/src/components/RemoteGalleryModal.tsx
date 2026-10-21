'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Video,
  Download,
  RefreshCw,
  Folder,
  Layers,
  Smartphone,
  Eye,
  Check,
  Loader2,
  Palette,
  Upload,
  Lock,
  Monitor,
  ChevronDown,
} from 'lucide-react';

export interface RemoteMediaItem {
  id: string;
  numericId?: number;
  type: 'image' | 'video';
  name: string;
  size: string;
  sizeBytes?: number;
  duration?: string;
  mimeType: string;
  album: string;
  timestamp?: number;
  thumbnail?: string;
}

interface RemoteGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneName: string;
  mediaItems: RemoteMediaItem[];
  isLoading: boolean;
  onRefreshMedia: (category: string, album?: string) => void;
  onLoadMore?: () => void;
  onRequestDownload: (fileId: string) => void;
  onRequestSetWallpaper?: (fileId?: string, base64Data?: string, screen?: 'home' | 'lock' | 'both') => void;
  downloadingFileId?: string | null;
  settingWallpaperId?: string | null;
}

export const RemoteGalleryModal: React.FC<RemoteGalleryModalProps> = ({
  isOpen,
  onClose,
  phoneName,
  mediaItems,
  isLoading,
  onRefreshMedia,
  onLoadMore,
  onRequestDownload,
  onRequestSetWallpaper,
  downloadingFileId,
  settingWallpaperId,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'PHOTOS' | 'VIDEOS'>('ALL');
  const [selectedAlbum, setSelectedAlbum] = useState<string>('ALL');
  const [previewItem, setPreviewItem] = useState<RemoteMediaItem | null>(null);
  const [activeWallpaperDropdownId, setActiveWallpaperDropdownId] = useState<string | null>(null);
  const [wallpaperNotice, setWallpaperNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      onRefreshMedia(selectedCategory, selectedAlbum !== 'ALL' ? selectedAlbum : undefined);
    }
  }, [isOpen, selectedCategory]);

  if (!isOpen) return null;

  // Extract unique albums (e.g., Camera, WhatsApp, Screenshots, etc.)
  const albums = Array.from(new Set(mediaItems.map((m) => m.album || 'Camera'))).filter(Boolean);

  const filteredItems = mediaItems.filter((item) => {
    if (selectedCategory === 'PHOTOS' && item.type !== 'image') return false;
    if (selectedCategory === 'VIDEOS' && item.type !== 'video') return false;
    if (selectedAlbum !== 'ALL' && item.album !== selectedAlbum) return false;
    return true;
  });

  const handleAlbumChange = (album: string) => {
    setSelectedAlbum(album);
    onRefreshMedia(selectedCategory, album !== 'ALL' ? album : undefined);
  };

  const handleSetWallpaper = (fileId?: string, base64Data?: string, screen: 'home' | 'lock' | 'both' = 'both') => {
    onRequestSetWallpaper?.(fileId, base64Data, screen);
    setActiveWallpaperDropdownId(null);
    setWallpaperNotice(`Setting as ${screen.toUpperCase()} wallpaper...`);
    setTimeout(() => setWallpaperNotice(null), 3000);
  };

  const handleUploadPcImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      handleSetWallpaper(undefined, dataUrl, 'both');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500" />

        {/* Hidden File Input for uploading custom wallpaper directly from PC */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUploadPcImage}
          accept="image/*"
          className="hidden"
        />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Remote Phone Gallery</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                  {phoneName}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Browse & Save photos from phone or set phone wallpaper directly from PC!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct PC to Phone Wallpaper Trigger */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-xs font-mono font-bold text-white flex items-center gap-1.5 transition shadow-md shadow-purple-900/30 active:scale-95"
              title="Pick an image from your laptop to set as phone wallpaper immediately"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>🎨 Upload PC Wallpaper</span>
            </button>

            <button
              type="button"
              onClick={() => onRefreshMedia(selectedCategory, selectedAlbum !== 'ALL' ? selectedAlbum : undefined)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 flex items-center gap-1.5 transition border border-slate-700 disabled:opacity-50"
              title="Refresh Phone Media"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Wallpaper feedback toast */}
        {wallpaperNotice && (
          <div className="bg-gradient-to-r from-purple-900/90 to-cyan-900/90 border-b border-purple-500/40 px-4 py-2 text-xs font-mono text-center text-purple-200 font-bold flex items-center justify-center gap-2 animate-in fade-in">
            <Palette className="w-4 h-4 text-pink-400" />
            <span>{wallpaperNotice}</span>
          </div>
        )}

        {/* Filter Bar: Category & Albums */}
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg transition ${
                selectedCategory === 'ALL'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              All ({mediaItems.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('PHOTOS')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${
                selectedCategory === 'PHOTOS'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Photos ({mediaItems.filter((i) => i.type === 'image').length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('VIDEOS')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${
                selectedCategory === 'VIDEOS'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Videos ({mediaItems.filter((i) => i.type === 'video').length})
            </button>
          </div>

          {/* Album Selector */}
          {albums.length > 1 && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <Folder className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={selectedAlbum}
                onChange={(e) => handleAlbumChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
              >
                <option value="ALL">All Folders / Albums</option>
                {albums.map((alb) => (
                  <option key={alb} value={alb}>
                    📁 {alb}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Media Grid Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading && mediaItems.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-xs font-mono">Loading photos & videos from phone storage...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center text-slate-500 font-mono text-xs">
              <ImageIcon className="w-10 h-10 mx-auto text-slate-700 mb-2" />
              <p>No media items found in this category.</p>
              <button
                type="button"
                onClick={() => onRefreshMedia(selectedCategory, selectedAlbum !== 'ALL' ? selectedAlbum : undefined)}
                className="mt-3 px-3 py-1 rounded bg-slate-800 text-cyan-300 text-xs hover:bg-slate-700"
              >
                Refresh Phone Gallery
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredItems.map((item) => {
                  const isDownloading = downloadingFileId === item.id;
                  const isSettingThisWallpaper = settingWallpaperId === item.id;
                  const isDropdownOpen = activeWallpaperDropdownId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="group relative rounded-xl bg-slate-950/80 border border-slate-800/90 overflow-hidden hover:border-cyan-500/60 transition shadow-sm flex flex-col justify-between"
                    >
                      {/* Media Preview Box */}
                      <div
                        className="w-full aspect-square bg-slate-900 relative overflow-hidden cursor-pointer flex items-center justify-center"
                        onClick={() => setPreviewItem(item)}
                      >
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-600 gap-1">
                            {item.type === 'video' ? (
                              <Video className="w-8 h-8 text-purple-400" />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-cyan-400" />
                            )}
                            <span className="text-[10px] font-mono">{item.type.toUpperCase()}</span>
                          </div>
                        )}

                        {/* Video Duration Badge */}
                        {item.duration && (
                          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono font-bold text-white">
                            {item.duration}
                          </span>
                        )}

                        {/* Album Tag */}
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-cyan-300 truncate max-w-[85%]">
                          {item.album}
                        </span>

                        {/* Hover Overlay with Preview Icon */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <span className="p-2 rounded-full bg-cyan-500 text-slate-950 shadow-md">
                            <Eye className="w-4 h-4" />
                          </span>
                        </div>
                      </div>

                      {/* Metadata & Actions */}
                      <div className="p-2.5 bg-slate-950 flex flex-col gap-1.5">
                        <p className="text-xs font-mono font-semibold text-slate-200 truncate" title={item.name}>
                          {item.name}
                        </p>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>{item.size}</span>
                          <div className="flex items-center gap-1">
                            {/* Wallpaper action for images */}
                            {item.type === 'image' && onRequestSetWallpaper && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveWallpaperDropdownId(isDropdownOpen ? null : item.id);
                                  }}
                                  disabled={isSettingThisWallpaper}
                                  className="p-1 rounded bg-slate-900 hover:bg-purple-600 hover:text-white text-purple-300 transition border border-purple-500/30"
                                  title="Set this photo as Phone Wallpaper"
                                >
                                  {isSettingThisWallpaper ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Palette className="w-3 h-3" />
                                  )}
                                </button>

                                {/* Mini Dropdown for Home / Lock / Both */}
                                {isDropdownOpen && (
                                  <div
                                    className="absolute bottom-full right-0 mb-1 z-30 w-36 rounded-lg bg-slate-900 border border-purple-500/50 shadow-2xl p-1 text-[10px] font-mono space-y-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleSetWallpaper(item.id, undefined, 'home')}
                                      className="w-full text-left px-2 py-1 rounded hover:bg-purple-950 text-slate-200 hover:text-purple-300 flex items-center gap-1.5"
                                    >
                                      <Monitor className="w-3 h-3 text-cyan-400" />
                                      <span>Home Screen</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSetWallpaper(item.id, undefined, 'lock')}
                                      className="w-full text-left px-2 py-1 rounded hover:bg-purple-950 text-slate-200 hover:text-purple-300 flex items-center gap-1.5"
                                    >
                                      <Lock className="w-3 h-3 text-amber-400" />
                                      <span>Lock Screen</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSetWallpaper(item.id, undefined, 'both')}
                                      className="w-full text-left px-2 py-1 rounded hover:bg-purple-950 text-slate-200 hover:text-purple-300 font-bold flex items-center gap-1.5"
                                    >
                                      <Palette className="w-3 h-3 text-pink-400" />
                                      <span>Both Screens</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Save to PC button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRequestDownload(item.id);
                              }}
                              disabled={isDownloading}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 font-bold transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
                              title="Save this file directly to PC"
                            >
                              {isDownloading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              {onLoadMore && filteredItems.length >= 80 && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-500/50 text-cyan-300 font-bold text-xs font-mono inline-flex items-center gap-2 transition shadow-md"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>Load More Media (+150 Items)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>
            Total Items: <strong className="text-cyan-300">{filteredItems.length}</strong>
          </span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Direct High-Speed P2P Stream Active
          </span>
        </div>
      </div>

      {/* Item High-Res Preview Overlay */}
      {previewItem && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3 text-white font-mono text-xs">
              <span className="truncate max-w-[45%] font-bold">{previewItem.name} ({previewItem.size})</span>
              <div className="flex items-center gap-2">
                {/* Wallpaper Options in Preview */}
                {previewItem.type === 'image' && onRequestSetWallpaper && (
                  <div className="flex items-center gap-1 bg-purple-950/80 border border-purple-500/40 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => handleSetWallpaper(previewItem.id, undefined, 'home')}
                      className="px-2 py-1 rounded hover:bg-purple-600 text-[11px] text-purple-200 hover:text-white transition flex items-center gap-1"
                      title="Set as Phone Home Screen"
                    >
                      <Monitor className="w-3 h-3" />
                      <span>Home</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetWallpaper(previewItem.id, undefined, 'lock')}
                      className="px-2 py-1 rounded hover:bg-purple-600 text-[11px] text-purple-200 hover:text-white transition flex items-center gap-1"
                      title="Set as Phone Lock Screen"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Lock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetWallpaper(previewItem.id, undefined, 'both')}
                      className="px-2 py-1 rounded bg-purple-600 text-white font-bold text-[11px] hover:bg-purple-500 transition flex items-center gap-1"
                      title="Set as Both Home and Lock Screen"
                    >
                      <Palette className="w-3 h-3" />
                      <span>Both</span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onRequestDownload(previewItem.id)}
                  disabled={downloadingFileId === previewItem.id}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition"
                >
                  {downloadingFileId === previewItem.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Download to PC</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {previewItem.thumbnail ? (
              <img
                src={previewItem.thumbnail}
                alt={previewItem.name}
                className="max-h-[75vh] max-w-full rounded-xl object-contain border border-slate-800 shadow-2xl"
              />
            ) : (
              <div className="p-16 rounded-xl bg-slate-900 border border-slate-800 text-center font-mono text-slate-400">
                <p className="text-sm">High-res thumbnail not cached.</p>
                <p className="text-xs mt-1">Click "Download to PC" to fetch the full file.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
