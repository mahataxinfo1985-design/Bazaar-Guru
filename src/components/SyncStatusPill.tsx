import React from 'react';
import { RefreshCw, AlertTriangle, Layers } from 'lucide-react';

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
    <div className="flex items-center gap-1 bg-[#FFFBF3] rounded-lg p-1 border border-[#E8DFCF] text-[13px]">
      {/* Online / Offline status */}
      <button
        onClick={onOpenHub}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-white text-[12px] font-medium text-[#12263A] transition cursor-pointer"
        title={isOnline ? 'Online - Cloud Sync Active' : 'Offline - Storing in IndexedDB'}
      >
        <span 
          className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#1E8E5A]' : 'bg-[#B7791F]'}`} 
        />
        <span className="hidden sm:inline text-[#3E5368]">{isOnline ? 'Online' : 'Offline'}</span>
      </button>

      {/* Pending Outbox Operations */}
      {pendingCount > 0 && (
        <button
          onClick={onSyncClick || onOpenHub}
          disabled={isSyncing || !isOnline}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF5FD] text-[#14689F] hover:bg-[#D4EBFA] font-semibold text-[11px] transition cursor-pointer disabled:opacity-50"
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
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FDECEC] text-[#C23B3B] hover:bg-[#FDECEC]/80 font-semibold text-[11px] transition cursor-pointer"
          title={`${conflictCount} sync conflicts require review`}
        >
          <AlertTriangle size={11} />
          <span>{conflictCount}</span>
        </button>
      )}

      {/* Open Hub Icon */}
      <button
        onClick={onOpenHub}
        className="p-1 text-[#3E5368] hover:text-[#12263A] rounded hover:bg-white transition cursor-pointer"
        title="Open Sync & Backup Hub"
      >
        <Layers size={14} />
      </button>
    </div>
  );
}
