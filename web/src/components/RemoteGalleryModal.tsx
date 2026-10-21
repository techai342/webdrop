'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ArrowLeft,
  Search,
  FolderOpen,
  FileArchive,
  CheckSquare,
  Square,
  Zap,
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

export interface RemoteFolder {
  name: string;
  imageCount: number;
  videoCount: number;
  totalItems: number;
  size: string;
  latestDate?: number;
}

interface RemoteGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneName: string;
  folders: RemoteFolder[];
  totalMediaCount: number;
  totalFoldersCount: number;
  mediaItems: RemoteMediaItem[];
  isLoading: boolean;
  onScanFolders: () => void;
  onOpenFolder: (folderName: string) => void;
  onLoadMoreFolderItems?: (folderName: string) => void;
  onRefreshMedia?: (category: string, album?: string) => void;
  onLoadMoreMedia?: () => void;
  onRequestDownload: (fileId: string) => void;
  onRequestDownloadZip?: (fileIds: string[], zipName: string) => void;
  onRequestDownloadFolderZip?: (folderName: string) => void;
  onRequestSetWallpaper?: (fileId?: string, base64Data?: string, screen?: 'home' | 'lock' | 'both') => void;
  downloadingFileId?: string | null;
  settingWallpaperId?: string | null;
  isZipping?: boolean;
}

export const RemoteGalleryModal: React.FC<RemoteGalleryModalProps> = ({
  isOpen,
  onClose,
  phoneName,
  folders,
  totalMediaCount,
  totalFoldersCount,
  mediaItems,
  isLoading,
  onScanFolders,
  onOpenFolder,
  onLoadMoreFolderItems,
  onRefreshMedia,
  onLoadMoreMedia,
  onRequestDownload,
  onRequestDownloadZip,
  onRequestDownloadFolderZip,
  onRequestSetWallpaper,
  downloadingFileId,
  settingWallpaperId,
  isZipping = false,
}) => {
  const [viewMode, setViewMode] = useState<'media' | 'folders'>('media');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'PHOTOS' | 'VIDEOS'>('ALL');
  const [previewItem, setPreviewItem] = useState<RemoteMediaItem | null>(null);
  const [activeWallpaperDropdownId, setActiveWallpaperDropdownId] = useState<string | null>(null);
  const [wallpaperNotice, setWallpaperNotice] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Automatically fetch media on open if not loaded yet
  useEffect(() => {
    if (isOpen) {
      if (mediaItems.length === 0) {
        onRefreshMedia?.('ALL');
      }
      if (folders.length === 0) {
        onScanFolders();
      }
    } else {
      setActiveFolder(null);
      setFolderSearchQuery('');
      setFileSearchQuery('');
      setSelectedItemIds(new Set());
    }
  }, [isOpen]);

  // Reset selected items when folder changes
  useEffect(() => {
    setSelectedItemIds(new Set());
  }, [activeFolder]);

  if (!isOpen) return null;

  // Filter folders by search query
  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(folderSearchQuery.toLowerCase())
  );

  // Filter items inside opened folder or general media
  const filteredItems = mediaItems.filter((item) => {
    if (selectedCategory === 'PHOTOS' && item.type !== 'image') return false;
    if (selectedCategory === 'VIDEOS' && item.type !== 'video') return false;
    if (fileSearchQuery.trim()) {
      return item.name.toLowerCase().includes(fileSearchQuery.toLowerCase());
    }
    return true;
  });

  const handleSelectFolder = (folderName: string) => {
    setActiveFolder(folderName);
    setViewMode('media');
    setFileSearchQuery('');
    onOpenFolder(folderName);
  };

  const handleSelectAllMedia = () => {
    setActiveFolder(null);
    setViewMode('media');
    setFileSearchQuery('');
    onRefreshMedia?.(selectedCategory);
  };

  const handleBackToFolders = () => {
    setViewMode('folders');
    setActiveFolder(null);
  };

  const handleSetWallpaper = (fileId?: string, base64Data?: string, screen: 'home' | 'lock' | 'both' = 'both') => {
    onRequestSetWallpaper?.(fileId, base64Data, screen);
    setActiveWallpaperDropdownId(null);
    setWallpaperNotice(`Setting as ${screen.toUpperCase()} wallpaper...`);
    setTimeout(() => setWallpaperNotice(null), 3500);
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

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const handleSelect15 = () => {
    const first16 = filteredItems.slice(0, 16).map((i) => i.id);
    setSelectedItemIds(new Set(first16));
  };

  const handleDownloadSelectedZip = () => {
    if (selectedItemIds.size === 0 || !onRequestDownloadZip) return;
    const name = `${activeFolder || 'Media'}_batch_${selectedItemIds.size}.zip`;
    onRequestDownloadZip(Array.from(selectedItemIds), name);
  };

  const handleDownloadFolderZip = () => {
    if (!activeFolder || !onRequestDownloadFolderZip) return;
    onRequestDownloadFolderZip(activeFolder);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl rounded-2xl bg-[#0f131c] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-cyan-500" />

        {/* Hidden File Input for uploading custom wallpaper directly from PC */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUploadPcImage}
          accept="image/*"
          className="hidden"
        />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-[#131722]">
          <div className="flex items-center gap-3">
            {activeFolder ? (
              <button
                type="button"
                onClick={handleBackToFolders}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 flex items-center gap-1.5 text-xs font-mono font-bold transition border border-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Folders</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400">
                <ImageIcon className="w-5 h-5" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>{activeFolder ? `📁 ${activeFolder}` : 'Remote Phone Media & Gallery'}</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-cyan-300 font-bold">
                  {phoneName}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {activeFolder
                  ? `Showing photos & videos from ${activeFolder}`
                  : 'Fast blurred preview media gallery with album explorer!'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: All Photos vs Folders */}
            <div className="flex items-center bg-[#0b0e14] p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setViewMode('media');
                  setActiveFolder(null);
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-bold ${
                  viewMode === 'media' && !activeFolder
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View all recent photos and videos directly"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>All Photos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('folders');
                  setActiveFolder(null);
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-bold ${
                  viewMode === 'folders'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Explore media by folders"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Folders ({folders.length})</span>
              </button>
            </div>

            {/* Direct PC to Phone Wallpaper Trigger */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-xs font-mono font-bold text-white flex items-center gap-1.5 transition shadow-md shadow-purple-900/30 active:scale-95"
              title="Pick an image from your laptop to set as phone wallpaper immediately"
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Set PC Wallpaper</span>
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
          <div className="bg-gradient-to-r from-purple-900/90 to-amber-900/90 border-b border-purple-500/40 px-4 py-2 text-xs font-mono text-center text-purple-200 font-bold flex items-center justify-center gap-2 animate-in fade-in">
            <Palette className="w-4 h-4 text-pink-400" />
            <span>{wallpaperNotice}</span>
          </div>
        )}

        {/* Toolbar: Stats & Search */}
        {viewMode === 'folders' ? (
          <div className="px-4 py-2.5 border-b border-slate-800 bg-[#0b0e14] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            {/* Folder Search */}
            <div className="flex items-center gap-2 bg-[#131722] border border-slate-800 rounded-lg px-2.5 py-1 w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={folderSearchQuery}
                onChange={(e) => setFolderSearchQuery(e.target.value)}
                placeholder="Search folders (Screenshots, Camera...)"
                className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none w-full placeholder-slate-500"
              />
            </div>

            {/* Total Stats Badge */}
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>
                Total Media: <strong className="text-amber-300">{totalMediaCount || '...'}</strong> •{' '}
                <strong className="text-amber-300">{totalFoldersCount || folders.length}</strong> Folders
              </span>
            </div>
          </div>
        ) : (
          <div className="border-b border-slate-800 bg-[#0b0e14] px-4 py-2 space-y-2">
            {/* Row 1: Albums Horizontal Scroll Bar */}
            {folders.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono scrollbar-thin">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                  Albums:
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllMedia}
                  className={`px-3 py-1 rounded-lg shrink-0 transition font-bold ${
                    !activeFolder
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/40'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  All Media ({mediaItems.length})
                </button>
                {folders.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => handleSelectFolder(f.name)}
                    className={`px-3 py-1 rounded-lg shrink-0 transition flex items-center gap-1.5 ${
                      activeFolder?.toLowerCase() === f.name.toLowerCase()
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/40'
                        : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>{f.name}</span>
                    <span className="text-[10px] opacity-75">({f.totalItems})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Row 2: Category Switcher, Multi-Select & Search */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    selectedCategory === 'ALL'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/30'
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
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/30'
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
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/30'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  Videos ({mediaItems.filter((i) => i.type === 'video').length})
                </button>
              </div>

              {/* Selection Controls, ZIP Download & Search */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono flex items-center gap-1 transition"
                  title="Select or deselect all visible items"
                >
                  {selectedItemIds.size === filteredItems.length && filteredItems.length > 0 ? (
                    <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>All</span>
                </button>

                <button
                  type="button"
                  onClick={handleSelect15}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-amber-950/60 hover:text-amber-300 border border-slate-700/60 text-slate-300 text-[11px] font-mono flex items-center gap-1 transition"
                  title="Quick-select top 16 items for fast zip packaging"
                >
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                  <span>Select 15+</span>
                </button>

                {activeFolder && onRequestDownloadFolderZip && (
                  <button
                    type="button"
                    onClick={handleDownloadFolderZip}
                    disabled={isZipping}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-slate-950 font-bold text-[11px] font-mono flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 transition"
                    title={`Download entire ${activeFolder} as a single ZIP archive`}
                  >
                    <FileArchive className="w-3.5 h-3.5" />
                    <span>Zip Folder</span>
                  </button>
                )}

                <div className="flex items-center gap-2 bg-[#131722] border border-slate-800 rounded-lg px-2.5 py-1 w-full sm:w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                    placeholder="Filter files by name..."
                    className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none w-full placeholder-slate-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* VIEW 1: FOLDERS GRID */}
          {viewMode === 'folders' && !activeFolder ? (
            <div>
              {isLoading && folders.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  <p className="text-xs font-mono">Scanning phone storage folders (Ultra-fast)...</p>
                  <button
                    type="button"
                    onClick={onScanFolders}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs hover:bg-amber-500/30 font-bold transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Force Refresh Now
                  </button>
                </div>
              ) : filteredFolders.length === 0 ? (
                <div className="py-24 text-center text-slate-500 font-mono text-xs">
                  <Folder className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                  <p>No media folders found on phone</p>
                  <p className="text-[11px] text-slate-600 mt-1 max-w-sm mx-auto">
                    Ensure Storage / Photos & Videos permission is allowed in phone settings.
                  </p>
                  <button
                    type="button"
                    onClick={onScanFolders}
                    className="mt-3 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                  >
                    🔄 Rescan Phone Storage
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {filteredFolders.map((folder) => {
                    const isVideoOnly = folder.imageCount === 0 && folder.videoCount > 0;
                    const isPhotoOnly = folder.videoCount === 0 && folder.imageCount > 0;

                    return (
                      <div
                        key={folder.name}
                        onClick={() => handleSelectFolder(folder.name)}
                        className="group relative rounded-2xl bg-[#141824] hover:bg-[#1a2030] border border-slate-800/80 hover:border-amber-500/50 p-4 transition-all duration-200 cursor-pointer shadow-md hover:shadow-amber-950/20 flex flex-col justify-between"
                      >
                        {/* Top row: Icon + Count Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 group-hover:scale-105 transition-transform">
                            {isVideoOnly ? (
                              <Video className="w-4 h-4 text-purple-400" />
                            ) : isPhotoOnly ? (
                              <ImageIcon className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <Folder className="w-4 h-4 text-amber-400" />
                            )}
                          </span>

                          <span className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold">
                            {folder.totalItems} items
                          </span>
                        </div>

                        {/* Middle: Folder Title */}
                        <h4
                          className="text-sm font-bold text-slate-100 truncate group-hover:text-amber-300 transition-colors"
                          title={folder.name}
                        >
                          {folder.name}
                        </h4>

                        {/* Bottom: Breakdown & Size */}
                        <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>
                            {folder.imageCount} imgs • {folder.videoCount} vids
                          </span>
                          <span className="text-slate-500">{folder.size}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* VIEW 2: INSIDE FOLDER - FILES & MEDIA (Blurred/Fast Preview) */
            <div>
              {isLoading && mediaItems.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  <p className="text-xs font-mono">Loading files from {activeFolder || 'phone gallery'}...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-24 text-center text-slate-500 font-mono text-xs">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                  <p>No media files found in this category {activeFolder ? `in ${activeFolder}` : ''}.</p>
                  {activeFolder && (
                    <button
                      type="button"
                      onClick={handleBackToFolders}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 text-amber-300 text-xs hover:bg-slate-700 font-bold"
                    >
                      ⬅ Back to Folders
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredItems.map((item) => {
                      const isDownloading = downloadingFileId === item.id;
                      const isSettingThisWallpaper = settingWallpaperId === item.id;
                      const isDropdownOpen = activeWallpaperDropdownId === item.id;
                      const isSelected = selectedItemIds.has(item.id);

                      return (
                        <div
                          key={item.id}
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '160px 200px' }}
                          className={`group relative rounded-xl bg-[#141824] border overflow-hidden transition shadow-sm flex flex-col justify-between ${
                            isSelected
                              ? 'border-amber-400 bg-[#191f30] shadow-md shadow-amber-950/40 ring-1 ring-amber-400/50'
                              : 'border-slate-800/90 hover:border-amber-500/50'
                          }`}
                        >
                          {/* Multi-Select Checkbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectItem(item.id);
                            }}
                            className={`absolute top-2 left-2 z-20 w-6 h-6 rounded-lg flex items-center justify-center transition border ${
                              isSelected
                                ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-500/50 font-bold'
                                : 'bg-slate-900/80 border-slate-700/80 text-transparent hover:border-amber-400 hover:text-slate-400'
                            }`}
                            title={isSelected ? 'Deselect item' : 'Select item'}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>

                          {/* Media Box with Blurred / Lightweight Preview */}
                          <div
                            className="w-full aspect-square bg-[#0b0e14] relative overflow-hidden cursor-pointer flex items-center justify-center"
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
                              /* Blur / Frosted Placeholder: Instant rendering without waiting for heavy thumbnail */
                              <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center text-slate-500 gap-1.5 p-2">
                                <div className="p-2.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400">
                                  {item.type === 'video' ? (
                                    <Video className="w-5 h-5 text-purple-400" />
                                  ) : (
                                    <ImageIcon className="w-5 h-5 text-cyan-400" />
                                  )}
                                </div>
                                <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                                  {item.mimeType.split('/')[1] || item.type}
                                </span>
                              </div>
                            )}

                            {/* Video Duration Badge */}
                            {item.duration && (
                              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono font-bold text-white">
                                {item.duration}
                              </span>
                            )}

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <span className="p-2 rounded-full bg-amber-500 text-slate-950 shadow-md">
                                <Eye className="w-4 h-4" />
                              </span>
                            </div>
                          </div>

                          {/* Metadata & Actions */}
                          <div className="p-2.5 bg-[#141824] flex flex-col gap-1.5">
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
                                      title="Set as Phone Wallpaper"
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

                  {/* Multi-Select Floating Sticky Bar */}
                  {selectedItemIds.size > 0 && (
                    <div className="sticky bottom-2 left-0 right-0 z-30 p-3 rounded-2xl bg-[#141824]/95 border border-amber-500/50 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-bottom">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>{selectedItemIds.size} Selected</span>
                        </span>

                        {selectedItemIds.size > 15 ? (
                          <span className="text-[11px] font-mono text-amber-300 font-semibold flex items-center gap-1 bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                            <Zap className="w-3.5 h-3.5 text-orange-400" />
                            15+ Selected: ZIP Archive active to guarantee fast speed & avoid network errors!
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-400">
                            Ready for direct single-bundle packaging
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedItemIds(new Set())}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
                        >
                          Clear
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadSelectedZip}
                          disabled={isZipping}
                          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-amber-900/40 active:scale-95 disabled:opacity-50 transition"
                        >
                          {isZipping ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileArchive className="w-4 h-4" />
                          )}
                          <span>Download as ZIP Archive ({selectedItemIds.size})</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Load More Pagination */}
                  <div className="pt-4 pb-2 text-center">
                    {activeFolder ? (
                      onLoadMoreFolderItems && (
                        <button
                          type="button"
                          onClick={() => onLoadMoreFolderItems(activeFolder)}
                          disabled={isLoading}
                          className="px-5 py-2.5 rounded-xl bg-amber-950/80 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/50 text-amber-300 font-bold text-xs font-mono inline-flex items-center gap-2 transition shadow-md active:scale-95 disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          <span>Load Next 20 Photos in {activeFolder} (+20)</span>
                        </button>
                      )
                    ) : (
                      onLoadMoreMedia && (
                        <button
                          type="button"
                          onClick={() => onLoadMoreMedia()}
                          disabled={isLoading}
                          className="px-5 py-2.5 rounded-xl bg-amber-950/80 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/50 text-amber-300 font-bold text-xs font-mono inline-flex items-center gap-2 transition shadow-md active:scale-95 disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          <span>Load Next 20 Photos (+20)</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-[#0f131c] flex items-center justify-between text-xs font-mono text-slate-400">
          <div>
            {activeFolder ? (
              <span>
                Folder: <strong className="text-amber-300">{activeFolder}</strong> • Showing{' '}
                <strong className="text-cyan-300">{filteredItems.length}</strong> items (⚡ Smooth Virtualized)
              </span>
            ) : (
              <span>
                Loaded: <strong className="text-cyan-300">{filteredItems.length}</strong> • Phone Total: <strong className="text-amber-300">{totalMediaCount || '...'}</strong> ({folders.length} Albums)
              </span>
            )}
          </div>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Direct High-Speed P2P Mesh
          </span>
        </div>
      </div>

      {/* Item High-Res Preview Overlay */}
      {previewItem && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3 text-white font-mono text-xs">
              <span className="truncate max-w-[45%] font-bold">
                {previewItem.name} ({previewItem.size})
              </span>
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
              <div className="p-12 rounded-2xl bg-[#141824] border border-slate-800 text-center font-mono text-slate-400 flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-slate-800 border border-slate-700 text-cyan-400">
                  {previewItem.type === 'video' ? <Video className="w-8 h-8 text-purple-400" /> : <ImageIcon className="w-8 h-8 text-cyan-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-100">{previewItem.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{previewItem.size} • {previewItem.mimeType}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRequestDownload(previewItem.id)}
                  disabled={downloadingFileId === previewItem.id}
                  className="mt-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-50 transition"
                >
                  {downloadingFileId === previewItem.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Download Full Original to Laptop</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
