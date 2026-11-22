import React from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Layers } from 'lucide-react';

interface SyncStatusPillProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  onSyncClick?: () => void;
  onOpenHub?: () => void;
}

export default function SyncStatusPill({
  isOnline,
  isSyncing,
  pendingCount,
  conflictCount,
  onSyncClick,
  onOpenHub
}: SyncStatusPillProps) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 transition rounded-lg p-1 border border-slate-200 text-xs">
      {/* Online / Offline status */}
      <button
        onClick={onOpenHub}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-white text-[11px] font-semibold text-slate-700 transition cursor-pointer"
        title={isOnline ? 'Online - Cloud Sync Enabled' : 'Offline - Storing in IndexedDB'}
      >
        {isOnline ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-700 hidden sm:inline">Online</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-amber-700 hidden sm:inline">Offline</span>
          </>
        )}
      </button>

      {/* Pending Outbox Operations */}
      {pendingCount > 0 && (
        <button
          onClick={onSyncClick || onOpenHub}
          disabled={isSyncing || !isOnline}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
          title={`${pendingCount} pending operations in outbox`}
        >
          <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
          <span>{pendingCount}</span>
        </button>
      )}

      {/* Unresolved Conflict Badge */}
      {conflictCount > 0 && (
        <button
          onClick={onOpenHub}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[11px] transition cursor-pointer animate-bounce"
          title={`${conflictCount} sync conflicts require review`}
        >
          <AlertTriangle size={11} />
          <span>{conflictCount} conflict{conflictCount > 1 ? 's' : ''}</span>
        </button>
      )}

      {/* Quick open Hub */}
      <button
        onClick={onOpenHub}
        className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-white transition cursor-pointer"
        title="Open Sync & Backup Hub"
      >
        <Layers size={13} />
      </button>
    </div>
  );
}
