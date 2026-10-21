'use client';

import React, { useState } from 'react';
import {
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  Play,
  FileArchive,
  Download,
  FolderSync,
  Layers,
} from 'lucide-react';

export interface QueueTask {
  id: string;
  title: string;
  category: 'download' | 'zip' | 'folder' | 'wallpaper' | 'other';
  status: 'active' | 'queued' | 'completed' | 'error';
  percent?: number;
  detail?: string;
  createdAt: number;
}

interface TaskQueueBarProps {
  activeTask: QueueTask | null;
  taskQueue: QueueTask[];
  onForceTask: (taskId: string) => void;
  onCancelTask: (taskId: string) => void;
  onClearQueue: () => void;
}

export const TaskQueueBar: React.FC<TaskQueueBarProps> = ({
  activeTask,
  taskQueue,
  onForceTask,
  onCancelTask,
  onClearQueue,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // If nothing is running and queue is empty, do not show
  if (!activeTask && taskQueue.length === 0) {
    return null;
  }

  const getTaskIcon = (category: QueueTask['category']) => {
    switch (category) {
      case 'zip':
        return <FileArchive className="w-4 h-4 text-amber-400" />;
      case 'download':
        return <Download className="w-4 h-4 text-emerald-400" />;
      case 'folder':
        return <FolderSync className="w-4 h-4 text-cyan-400" />;
      default:
        return <Zap className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[480px] z-50 animate-in slide-in-from-bottom duration-300">
      <div className="rounded-2xl bg-[#0f131c]/95 border border-amber-500/40 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col">
        {/* Glowing Top Line */}
        <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-cyan-500" />

        {/* Header / Active Task Strip */}
        <div className="p-3 bg-[#141824] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400 relative shrink-0">
              {activeTask ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Clock className="w-4 h-4 text-slate-400" />
              )}
              {taskQueue.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-slate-950 text-[10px] font-mono font-bold flex items-center justify-center">
                  {taskQueue.length}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {activeTask ? 'In Progress' : 'Queue Idle'}
                </span>
                {taskQueue.length > 0 && (
                  <span className="text-[10px] font-mono text-slate-400">
                    +{taskQueue.length} queued
                  </span>
                )}
              </div>
              <p className="text-xs font-mono font-semibold text-slate-100 truncate mt-0.5" title={activeTask ? activeTask.title : 'Ready'}>
                {activeTask ? activeTask.title : 'All tasks finished'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {taskQueue.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 transition"
                title={isExpanded ? 'Hide queued tasks' : 'View queued tasks'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                <span className="text-[11px] font-bold">Queue ({taskQueue.length})</span>
              </button>
            )}

            {activeTask && (
              <button
                type="button"
                onClick={() => onCancelTask(activeTask.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                title="Cancel current task"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar (if active task has progress) */}
        {activeTask && (
          <div className="px-3 pb-2.5 pt-1 bg-[#141824] border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span className="truncate text-amber-200/90">{activeTask.detail || 'Processing...'}</span>
              <span className="font-bold text-amber-400">{activeTask.percent ?? 0}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, activeTask.percent ?? 15)}%` }}
              />
            </div>
          </div>
        )}

        {/* Expandable Queued Tasks Drawer */}
        {isExpanded && taskQueue.length > 0 && (
          <div className="p-3 bg-[#0d1017] border-t border-slate-800 space-y-2 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-1 border-b border-slate-800/60">
              <span className="flex items-center gap-1.5 font-bold text-slate-300">
                <Layers className="w-3.5 h-3.5 text-orange-400" />
                Queued Tasks ({taskQueue.length})
              </span>
              <button
                type="button"
                onClick={onClearQueue}
                className="text-[10px] text-rose-400 hover:underline hover:text-rose-300"
              >
                Clear All
              </button>
            </div>

            {taskQueue.map((task, idx) => (
              <div
                key={task.id}
                className="p-2 rounded-xl bg-[#141824] border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-2 text-xs font-mono transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-slate-500">#{idx + 1}</span>
                  {getTaskIcon(task.category)}
                  <span className="text-slate-200 truncate font-medium text-[11px]" title={task.title}>
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Urgent / Force Button */}
                  <button
                    type="button"
                    onClick={() => onForceTask(task.id)}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-[10px] font-mono flex items-center gap-1 shadow-sm shadow-amber-900/40 active:scale-95 transition"
                    title="Force this task to execute immediately (Urgent priority)"
                  >
                    <Zap className="w-3 h-3 fill-slate-950" />
                    <span>FORCE</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onCancelTask(task.id)}
                    className="p-1 rounded-md text-slate-500 hover:text-rose-400 transition"
                    title="Remove from queue"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
