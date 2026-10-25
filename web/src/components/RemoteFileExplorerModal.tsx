'use client';

import React, { useState, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  FileArchive,
  FileCode,
  FileImage,
  FileAudio,
  File,
  Smartphone,
  X,
  ArrowLeft,
  Download,
  Upload,
  Trash2,
  Edit2,
  RefreshCw,
  HardDrive,
  Check,
} from 'lucide-react';
import type { RemoteStorageBrowseData, StorageItem } from '../lib/types';

interface RemoteFileExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName?: string;
  peerId?: string;
  storageData?: RemoteStorageBrowseData | null;
  isLoading?: boolean;
  onBrowsePath?: (peerId: string, path: string) => void;
  onDeleteFile?: (peerId: string, path: string) => void;
  onRenameFile?: (peerId: string, path: string, newName: string) => void;
  onUploadFile?: (peerId: string, directoryPath: string, fileName: string, base64Data: string) => void;
  onRequestDownload?: (peerId: string, fileId: string) => void;
}

export const RemoteFileExplorerModal: React.FC<RemoteFileExplorerModalProps> = ({
  isOpen,
  onClose,
  deviceName = 'Connected Phone',
  peerId = 'all',
  storageData,
  isLoading = false,
  onBrowsePath,
  onDeleteFile,
  onRenameFile,
  onUploadFile,
  onRequestDownload,
}) => {
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentPath = storageData?.currentPath || '/storage/emulated/0';
  const parentPath = storageData?.parentPath || currentPath;
  const isRoot = storageData?.isRoot ?? true;
  const items = storageData?.items || [];
  const shortcuts = storageData?.shortcuts || [];

  const handleNavigate = (path: string) => {
    onBrowsePath?.(peerId, path);
  };

  const handleStartRename = (item: StorageItem) => {
    setRenamingPath(item.path);
    setRenamingName(item.name);
  };

  const handleConfirmRename = () => {
    if (!renamingPath || !renamingName.trim()) return;
    onRenameFile?.(peerId, renamingPath, renamingName.trim());
    setRenamingPath(null);
    setRenamingName('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      onUploadFile?.(peerId, currentPath, file.name, base64);
      setIsUploading(false);
    };
    reader.onerror = () => setIsUploading(false);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getFileIcon = (item: StorageItem) => {
    if (item.isDirectory) {
      return <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20" />;
    }
    const ext = item.extension.toLowerCase();
    switch (ext) {
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return <FileArchive className="w-5 h-5 text-purple-400" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-400" />;
      case 'apk':
        return <FileCode className="w-5 h-5 text-emerald-400" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
      case 'gif':
        return <FileImage className="w-5 h-5 text-teal-400" />;
      case 'mp3':
      case 'wav':
      case 'm4a':
      case 'ogg':
        return <FileAudio className="w-5 h-5 text-cyan-400" />;
      default:
        return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-teal-500/30 shadow-2xl p-6 overflow-hidden cyber-glow-cyan max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-950/80 border border-teal-500/40 text-teal-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Phone Storage Explorer
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-950/80 border border-teal-500/40 text-teal-300 font-bold">
                  {items.length} Items
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Internal Storage on {deviceName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleNavigate(currentPath)}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-teal-300 transition border border-slate-700"
              title="Refresh directory"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Shortcuts Pills */}
        <div className="flex items-center gap-1.5 my-3 overflow-x-auto pb-1 shrink-0">
          {shortcuts.map((sc) => (
            <button
              key={sc.name}
              type="button"
              onClick={() => handleNavigate(sc.path)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-teal-500/50 text-xs font-mono text-slate-300 hover:text-teal-300 flex items-center gap-1.5 shrink-0 transition"
            >
              <span>{sc.icon}</span>
              <span>{sc.name}</span>
            </button>
          ))}
        </div>

        {/* Breadcrumb Path & Upload Controls */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 mb-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {!isRoot && (
              <button
                type="button"
                onClick={() => handleNavigate(parentPath)}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-teal-300 transition shrink-0"
                title="Go up to parent folder"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="text-xs font-mono text-teal-300 truncate" title={currentPath}>
              {currentPath.replace('/storage/emulated/0', '📁 Root')}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
              title="Upload file from PC directly into this phone folder"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
            </button>
          </div>
        </div>

        {/* File & Directory Items List */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-1.5 py-1">
          {isLoading && items.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
              <p className="text-xs font-mono text-slate-400">Loading directory contents...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs">This folder is empty</p>
            </div>
          ) : (
            items.map((item) => {
              const isRenaming = renamingPath === item.path;

              return (
                <div
                  key={item.path}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between gap-3 group"
                >
                  <div
                    className={`flex items-center gap-3 min-w-0 ${
                      item.isDirectory ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => {
                      if (item.isDirectory) handleNavigate(item.path);
                    }}
                  >
                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                      {getFileIcon(item)}
                    </div>

                    <div className="min-w-0">
                      {isRenaming ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={renamingName}
                            onChange={(e) => setRenamingName(e.target.value)}
                            className="bg-slate-900 border border-teal-500/60 rounded px-2 py-0.5 text-xs text-slate-100 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleConfirmRename}
                            className="p-1 rounded bg-teal-600 text-white hover:bg-teal-500"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingPath(null)}
                            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`text-xs font-bold block truncate ${
                            item.isDirectory
                              ? 'text-amber-300 hover:underline'
                              : 'text-slate-200'
                          }`}
                        >
                          {item.name}
                        </span>
                      )}

                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mt-0.5">
                        {item.isDirectory ? (
                          <span>{item.childCount} items</span>
                        ) : (
                          <span>{item.sizeFormatted}</span>
                        )}
                        <span>•</span>
                        <span>{formatDate(item.lastModified)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!item.isDirectory && (
                      <button
                        type="button"
                        onClick={() => onRequestDownload?.(peerId, item.path)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-teal-400 hover:text-teal-300 transition"
                        title="Download to Laptop"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartRename(item)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
                      title="Rename"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFile?.(peerId, item.path)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/80 border border-slate-800 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
