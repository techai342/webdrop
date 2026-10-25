'use client';

import React, { useState, useMemo } from 'react';
import {
  Smartphone,
  Search,
  RefreshCw,
  X,
  Play,
  Download,
  Settings,
  Layers,
  Shield,
  HardDrive,
  Calendar,
  Check,
  Package,
  ExternalLink,
} from 'lucide-react';
import type { RemoteAppsListData, InstalledAppItem } from '../lib/types';

interface RemoteAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName?: string;
  peerId?: string;
  appsData?: RemoteAppsListData | null;
  isLoading?: boolean;
  onRefresh?: (peerId: string) => void;
  onLaunchApp?: (peerId: string, packageName: string) => void;
  onExtractApk?: (peerId: string, packageName: string) => void;
  onOpenDetails?: (peerId: string, packageName: string) => void;
}

type TabType = 'user' | 'system' | 'all';
type SortType = 'name' | 'size' | 'date';

export const RemoteAppsModal: React.FC<RemoteAppsModalProps> = ({
  isOpen,
  onClose,
  deviceName = 'Connected Phone',
  peerId = 'all',
  appsData,
  isLoading = false,
  onRefresh,
  onLaunchApp,
  onExtractApk,
  onOpenDetails,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('name');
  const [launchingPkg, setLaunchingPkg] = useState<string | null>(null);
  const [extractingPkg, setExtractingPkg] = useState<string | null>(null);

  const rawApps = appsData?.apps || [];

  const filteredApps = useMemo(() => {
    let list = rawApps;

    // Filter by Tab
    if (activeTab === 'user') {
      list = list.filter((a) => !a.isSystemApp);
    } else if (activeTab === 'system') {
      list = list.filter((a) => a.isSystemApp);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.appName.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q)
      );
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortBy === 'size') {
        return b.apkSizeBytes - a.apkSizeBytes;
      }
      if (sortBy === 'date') {
        return (b.lastUpdateTime || b.firstInstallTime) - (a.lastUpdateTime || a.firstInstallTime);
      }
      // default: name
      return a.appName.localeCompare(b.appName);
    });
  }, [rawApps, activeTab, searchQuery, sortBy]);

  const handleLaunch = (pkg: string) => {
    setLaunchingPkg(pkg);
    onLaunchApp?.(peerId, pkg);
    setTimeout(() => setLaunchingPkg(null), 2500);
  };

  const handleExtract = (pkg: string) => {
    setExtractingPkg(pkg);
    onExtractApk?.(peerId, pkg);
    setTimeout(() => setExtractingPkg(null), 4000);
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp || timestamp <= 0) return 'Pre-installed';
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-violet-500/30 shadow-2xl p-6 overflow-hidden cyber-glow-violet max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-950/80 border border-violet-500/40 text-violet-400 shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Installed Apps Manager
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-950/80 border border-violet-500/40 text-violet-300 font-bold">
                  {rawApps.length} Apps
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Installed on {deviceName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRefresh?.(peerId)}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-violet-300 transition border border-slate-700"
              title="Rescan apps"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-violet-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Controls: Search, Tabs & Sort */}
        <div className="py-3 shrink-0 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between border-b border-slate-800/80">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('user')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === 'user'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              User Apps ({appsData?.userAppsCount ?? rawApps.filter((a) => !a.isSystemApp).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === 'system'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              System ({appsData?.systemAppsCount ?? rawApps.filter((a) => a.isSystemApp).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === 'all'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({rawApps.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by app name or package..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500/60"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sort Toggle */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500/60 shrink-0"
            >
              <option value="name">Name (A-Z)</option>
              <option value="size">Size (Largest)</option>
              <option value="date">Updated Date</option>
            </select>
          </div>
        </div>

        {/* Apps List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {isLoading && rawApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 text-violet-400 animate-spin mb-3" />
              <p className="text-sm font-medium">Scanning phone applications...</p>
              <p className="text-xs text-slate-500 mt-1">Fetching installed packages and icons</p>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <Layers className="w-10 h-10 mb-2 opacity-40 text-violet-400" />
              <p className="text-sm font-medium text-slate-400">No applications found</p>
              {searchQuery ? (
                <p className="text-xs text-slate-500 mt-1">Try a different search keyword</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">Click refresh to scan phone apps</p>
              )}
            </div>
          ) : (
            filteredApps.map((app) => {
              const isLaunching = launchingPkg === app.packageName;
              const isExtracting = extractingPkg === app.packageName;

              return (
                <div
                  key={app.packageName}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-violet-500/40 transition gap-3 group"
                >
                  {/* Left: Icon & Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* App Icon */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center shadow-sm">
                      {app.iconBase64 ? (
                        <img
                          src={`data:image/png;base64,${app.iconBase64}`}
                          alt={app.appName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 text-violet-300 font-bold text-sm">
                          {app.appName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* App Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100 truncate group-hover:text-violet-300 transition">
                          {app.appName}
                        </span>
                        {app.isSystemApp ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            System
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-violet-950/80 text-violet-300 border border-violet-500/40">
                            User
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        {app.packageName}
                      </p>

                      <div className="flex items-center gap-2.5 text-[10px] font-mono text-slate-500 mt-1">
                        <span>v{app.versionName}</span>
                        <span>•</span>
                        <span className="text-slate-400 font-semibold">{app.sizeFormatted}</span>
                        <span>•</span>
                        <span>{formatDate(app.lastUpdateTime || app.firstInstallTime)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Launch App on Phone */}
                    <button
                      type="button"
                      onClick={() => handleLaunch(app.packageName)}
                      disabled={isLaunching}
                      className="px-2.5 py-1.5 rounded-lg bg-violet-950/80 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/40 transition text-xs font-semibold flex items-center gap-1 shadow-sm"
                      title="Launch this app on your phone"
                    >
                      <Play className={`w-3 h-3 ${isLaunching ? 'animate-ping' : ''}`} />
                      <span className="hidden sm:inline">Launch</span>
                    </button>

                    {/* Extract APK to Laptop */}
                    <button
                      type="button"
                      onClick={() => handleExtract(app.packageName)}
                      disabled={isExtracting}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-cyan-400 hover:text-cyan-300 transition"
                      title="Extract and download .apk file to laptop"
                    >
                      <Download className={`w-3.5 h-3.5 ${isExtracting ? 'animate-bounce' : ''}`} />
                    </button>

                    {/* Open App Details / Settings */}
                    <button
                      type="button"
                      onClick={() => onOpenDetails?.(peerId, app.packageName)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
                      title="Open App Info Settings on phone"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Status Bar */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">
              Showing {filteredApps.length} of {rawApps.length} applications
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Click <strong>Launch</strong> to run app on phone screen • <strong>Download</strong> to extract APK
          </span>
        </div>
      </div>
    </div>
  );
};
