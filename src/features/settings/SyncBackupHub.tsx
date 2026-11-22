import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, AlertTriangle, ShieldCheck, Download, Upload, 
  Smartphone, Laptop, Monitor, Tablet, CheckCircle2, XCircle, 
  ArrowRight, Database, FileText, Layers, Trash2, Check, AlertCircle, History,
  Cloud, CloudUpload, CloudDownload, Server
} from 'lucide-react';
import { 
  OutboxOperation, SyncConflict, SyncDevice, RestorePreviewResult, RestoreExecutionResult 
} from '../../types/sync';
import { 
  getAllOutboxOperations, retryOperation, retryAllFailedOperations, 
  cancelOperation, purgeSyncedOperations 
} from '../../services/sync/outboxEngine';
import { 
  getUnresolvedConflicts, resolveConflict, dismissConflict 
} from '../../services/sync/conflictService';
import { 
  getRegisteredDevices, revokeDevice, activateDevice, getCurrentDeviceId 
} from '../../services/sync/deviceService';
import { 
  exportBusinessBackup, previewBackup, restoreBusinessBackup 
} from '../../services/storage/backupRestore';
import { idbGetAll } from '../../services/storage/idb';
import { pushLocalDataToCloud, pullCloudDataToLocal, MigrationSummary } from '../../services/storage/cloudMigrator';
import { supabase } from '../../lib/supabase';

interface SyncBackupHubProps {
  isOnline: boolean;
  onTriggerSync: () => Promise<void>;
  onRestoreCompleted?: () => void;
}

export default function SyncBackupHub({
  isOnline,
  onTriggerSync,
  onRestoreCompleted
}: SyncBackupHubProps) {
  const [activeTab, setActiveTab] = useState<'outbox' | 'conflicts' | 'devices' | 'backup' | 'cloud'>('outbox');

  // State for data
  const [outboxOps, setOutboxOps] = useState<OutboxOperation[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Cloud & Migration states
  const [cloudUser, setCloudUser] = useState<any>(null);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);

  // Backup & Restore states
  const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<RestorePreviewResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'empty_business' | 'safe_merge'>('empty_business');
  const [createSafetySnapshot, setCreateSafetySnapshot] = useState(true);
  const [restoreResult, setRestoreResult] = useState<RestoreExecutionResult | null>(null);

  // Load all hub data
  const loadData = async () => {
    try {
      setLoading(true);
      const [ops, confs, devs, baks] = await Promise.all([
        getAllOutboxOperations(),
        getUnresolvedConflicts(),
        getRegisteredDevices(),
        idbGetAll('backup_history')
      ]);

      setOutboxOps(ops.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setConflicts(confs);
      setDevices(devs);
      setBackupHistory(baks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setCurrentDeviceId(getCurrentDeviceId());

      // Check Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      setCloudUser(session?.user ?? null);
    } catch (e: any) {
      console.error('Error loading sync hub data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const showMsg = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 5000);
  };

  // Outbox handlers
  const handleManualSync = async () => {
    try {
      setLoading(true);
      await onTriggerSync();
      await loadData();
      showMsg('Manual synchronization completed.');
    } catch (err: any) {
      showMsg(`Sync error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (opId: string) => {
    await retryOperation(opId);
    await loadData();
    showMsg('Operation scheduled for immediate retry.');
  };

  const handleRetryAll = async () => {
    const count = await retryAllFailedOperations();
    await loadData();
    showMsg(`Retrying ${count} failed operations.`);
  };

  const handleCancelOp = async (opId: string) => {
    if (confirm('Cancel this operation? It will be removed from the local outbox.')) {
      await cancelOperation(opId);
      await loadData();
      showMsg('Operation cancelled.');
    }
  };

  const handlePurgeSynced = async () => {
    const count = await purgeSyncedOperations(0);
    await loadData();
    showMsg(`Purged ${count} synced operations.`);
  };

  // Cloud Migration handlers
  const handlePushToCloud = async () => {
    try {
      setMigrationRunning(true);
      const res = await pushLocalDataToCloud();
      setMigrationSummary(res);
      if (res.success) {
        showMsg(res.message, 'success');
      } else {
        showMsg(res.message, 'error');
      }
      await loadData();
    } catch (err: any) {
      showMsg(`Migration error: ${err.message}`, 'error');
    } finally {
      setMigrationRunning(false);
    }
  };

  const handlePullFromCloud = async () => {
    try {
      setMigrationRunning(true);
      const res = await pullCloudDataToLocal();
      if (res.success) {
        showMsg(res.message, 'success');
        if (onRestoreCompleted) onRestoreCompleted();
      } else {
        showMsg(res.message, 'error');
      }
      await loadData();
    } catch (err: any) {
      showMsg(`Pull error: ${err.message}`, 'error');
    } finally {
      setMigrationRunning(false);
    }
  };

  // Conflict handlers
  const handleResolveConflict = async (
    conflictId: string, 
    strategy: 'keep_local' | 'keep_server' | 'merge'
  ) => {
    try {
      await resolveConflict(conflictId, strategy, undefined, 'User', `Resolved via Hub with ${strategy}`);
      await loadData();
      showMsg(`Conflict resolved successfully using strategy: ${strategy}.`);
    } catch (err: any) {
      showMsg(`Failed to resolve conflict: ${err.message}`, 'error');
    }
  };

  const handleDismissConflict = async (conflictId: string) => {
    await dismissConflict(conflictId);
    await loadData();
    showMsg('Conflict dismissed.');
  };

  // Device handlers
  const handleToggleDeviceStatus = async (dev: SyncDevice) => {
    if (dev.status === 'active') {
      if (confirm(`Revoke synchronization authorization for "${dev.deviceName}"?`)) {
        await revokeDevice(dev.id);
        await loadData();
        showMsg(`Device ${dev.deviceName} revoked.`, 'info');
      }
    } else {
      await activateDevice(dev.id);
      await loadData();
      showMsg(`Device ${dev.deviceName} activated.`, 'success');
    }
  };

  // Backup & Restore handlers
  const handleExportBackup = async () => {
    try {
      setLoading(true);
      await exportBusinessBackup();
      await loadData();
      showMsg('Backup exported successfully (.invbak file downloaded).');
    } catch (err: any) {
      showMsg(`Backup export failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      setRestoreFileContent(content);
      const prev = await previewBackup(content);
      setRestorePreview(prev);
      setRestoreResult(null);
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restoreFileContent || !restorePreview?.valid) return;

    const warnMsg = restoreMode === 'empty_business'
      ? 'WARNING: "Clean Replace" mode will wipe existing records and restore from the backup file. Proceed?'
      : 'Safe merge will add new records from the backup and skip any existing duplicates. Proceed?';

    if (!confirm(warnMsg)) return;

    try {
      setLoading(true);
      const res = await restoreBusinessBackup(restoreFileContent, restoreMode, createSafetySnapshot);
      setRestoreResult(res);
      await loadData();

      if (res.success) {
        showMsg(res.message, 'success');
        if (onRestoreCompleted) onRestoreCompleted();
      } else {
        showMsg(res.message, 'error');
      }
    } catch (err: any) {
      showMsg(`Restore execution failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = outboxOps.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const failedCount = outboxOps.filter(o => o.status === 'failed' || o.status === 'action_required').length;
  const conflictCount = conflicts.length;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner / Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E8DFCF] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#12263A] tracking-tight">Sync & Backup Hub</h1>
            <span className="px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30">
              Offline-First
            </span>
          </div>
          <p className="text-xs text-[#3E5368] mt-0.5">
            Offline-first transaction outbox, multi-device management, conflict resolution & verifiable backups.
          </p>
        </div>

        {/* Global Connection Status Pill */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FFFBF3] border border-[#E8DFCF] text-xs font-semibold">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-[#1E8E5A]">
                <span className="w-2 h-2 rounded-full bg-[#1E8E5A] animate-pulse" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[#B7791F]">
                <span className="w-2 h-2 rounded-full bg-[#B7791F]" />
                Offline
              </span>
            )}
          </div>

          <button
            onClick={handleManualSync}
            disabled={loading || !isOnline}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] text-white font-semibold text-xs shadow-2xs transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Sync Now</span>
          </button>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div className={`p-3.5 rounded-lg text-xs font-semibold flex items-center justify-between border ${
          actionMessage.type === 'success' 
            ? 'bg-[#E6F6EE] border-[#1E8E5A]/20 text-[#1E8E5A]' 
            : actionMessage.type === 'error'
            ? 'bg-[#FDECEC] border-[#C23B3B]/20 text-[#C23B3B]'
            : 'bg-[#EAF5FD] border-[#3BA0E6]/30 text-[#1F86CC]'
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-[#3E5368] hover:text-[#12263A] cursor-pointer">
            <Check size={14} />
          </button>
        </div>
      )}

      {/* Hub Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#E8DFCF] pb-2 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => setActiveTab('outbox')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'outbox' 
              ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs font-semibold' 
              : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
          }`}
        >
          <RefreshCw size={14} />
          <span>Transaction Outbox</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#D4EBFA] text-[#14689F] font-bold">
              {pendingCount}
            </span>
          )}
          {failedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#FDECEC] text-[#C23B3B] font-bold">
              {failedCount} err
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('conflicts')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'conflicts' 
              ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs font-semibold' 
              : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
          }`}
        >
          <AlertTriangle size={14} />
          <span>Conflict Center</span>
          {conflictCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#C23B3B] text-white font-bold animate-pulse">
              {conflictCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'devices' 
              ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs font-semibold' 
              : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
          }`}
        >
          <Smartphone size={14} />
          <span>Connected Devices</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#EEF2F6] text-[#3E5368] font-semibold">
            {devices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'backup' 
              ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs font-semibold' 
              : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
          }`}
        >
          <Database size={14} />
          <span>Backup & Restore (v3.0)</span>
        </button>

        <button
          onClick={() => setActiveTab('cloud')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'cloud' 
              ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs font-semibold' 
              : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
          }`}
        >
          <Cloud size={14} />
          <span>Supabase Cloud Sync</span>
          {cloudUser ? (
            <span className="w-2 h-2 rounded-full bg-[#1E8E5A]" title="Authenticated" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-[#B7791F]" title="Guest / Offline" />
          )}
        </button>
      </div>

      {/* Tab 1: Transaction Outbox */}
      {activeTab === 'outbox' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] p-4 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#12263A]">
              Local Mutation Outbox ({outboxOps.length} items)
            </h2>
            <div className="flex gap-2">
              {failedCount > 0 && (
                <button
                  onClick={handleRetryAll}
                  className="px-2.5 py-1 rounded-md bg-[#FDECEC] text-[#C23B3B] hover:bg-[#FDECEC]/80 text-xs font-semibold transition border border-[#C23B3B]/20 cursor-pointer"
                >
                  Retry All Failed
                </button>
              )}
              <button
                onClick={handlePurgeSynced}
                className="px-2.5 py-1 rounded-md bg-[#FFFBF3] text-[#3E5368] hover:bg-[#EEF2F6] text-xs font-semibold transition border border-[#E8DFCF] cursor-pointer"
              >
                Clear Synced
              </button>
            </div>
          </div>

          {outboxOps.length === 0 ? (
            <div className="p-8 text-center bg-[#FFFBF3] rounded-lg border border-dashed border-[#E8DFCF]">
              <CheckCircle2 size={32} className="mx-auto text-[#1E8E5A] mb-2" />
              <p className="text-xs font-semibold text-[#12263A]">Outbox is completely clear</p>
              <p className="text-[11px] text-[#3E5368] mt-0.5">All local mutations are safely synced with cloud.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8DFCF] bg-[#FFFBF3] text-[#3E5368]">
                    <th className="py-2.5 px-3 font-semibold">Entity</th>
                    <th className="py-2.5 px-3 font-semibold">Operation</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Retries</th>
                    <th className="py-2.5 px-3 font-semibold">Created / Next Retry</th>
                    <th className="py-2.5 px-3 font-semibold">Last Error</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFCF]">
                  {outboxOps.map((op) => (
                    <tr key={op.id} className="hover:bg-[#FFFBF3]">
                      <td className="py-2.5 px-3 font-semibold text-[#12263A]">
                        {op.entityType} <span className="text-[#3E5368] font-normal">({op.entityId})</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold uppercase text-[10px] text-[#3E5368]">
                        {op.operationType}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold ${
                          op.status === 'synced'
                            ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20'
                            : op.status === 'pending'
                            ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30'
                            : op.status === 'processing'
                            ? 'bg-[#FFF3DC] text-[#B7791F] border border-[#B7791F]/20'
                            : 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20'
                        }`}>
                          {op.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#3E5368] font-semibold tabular-nums">
                        {op.retryCount} / {op.maxRetries}
                      </td>
                      <td className="py-2.5 px-3 text-[#3E5368] text-[11px]">
                        <div>{new Date(op.createdAt).toLocaleTimeString()}</div>
                        {op.nextRetryAt && (
                          <div className="text-[10px] text-[#B7791F]">
                            Retry: {new Date(op.nextRetryAt).toLocaleTimeString()}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#C23B3B] text-[11px] max-w-xs truncate" title={op.lastError}>
                        {op.lastError || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1">
                        {(op.status === 'failed' || op.status === 'action_required' || op.status === 'pending') && (
                          <button
                            onClick={() => handleRetry(op.id)}
                            className="p-1 hover:bg-[#EAF5FD] rounded text-[#1F86CC] cursor-pointer"
                            title="Retry now"
                          >
                            <RefreshCw size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => handleCancelOp(op.id)}
                          className="p-1 hover:bg-[#FDECEC] rounded text-[#3E5368] hover:text-[#C23B3B] cursor-pointer"
                          title="Cancel operation"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Conflict Center */}
      {activeTab === 'conflicts' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] p-4 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#12263A]">
              Unresolved Synchronization Conflicts ({conflicts.length})
            </h2>
          </div>

          {conflicts.length === 0 ? (
            <div className="p-8 text-center bg-[#FFFBF3] rounded-lg border border-dashed border-[#E8DFCF]">
              <ShieldCheck size={32} className="mx-auto text-[#1E8E5A] mb-2" />
              <p className="text-xs font-semibold text-[#12263A]">No active conflicts</p>
              <p className="text-[11px] text-[#3E5368] mt-0.5">All offline mutations resolved cleanly with cloud records.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {conflicts.map((conf) => (
                <div key={conf.id} className="border border-[#C23B3B]/30 rounded-xl p-3.5 bg-[#FDECEC]/15 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20">
                        {conf.conflictType}
                      </span>
                      <span className="text-xs font-bold text-[#12263A]">
                        {conf.entityType} ({conf.entityId})
                      </span>
                    </div>
                    <span className="text-[11px] text-[#3E5368]">
                      Detected: {new Date(conf.detectedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Side-by-side Field Diff */}
                  <div className="bg-white rounded-lg border border-[#E8DFCF] overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368]">
                          <th className="p-2 font-semibold">Field</th>
                          <th className="p-2 font-semibold text-[#1F86CC]">Local Client Version</th>
                          <th className="p-2 font-semibold text-[#E0771A]">Cloud Server Version</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8DFCF] text-[11px]">
                        {(conf.fieldDifferences || []).map((diff, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-semibold text-[#12263A]">{diff.field}</td>
                            <td className="p-2 text-[#1F86CC] bg-[#EAF5FD]/30">
                              {typeof diff.localValue === 'object' ? JSON.stringify(diff.localValue) : String(diff.localValue ?? '')}
                            </td>
                            <td className="p-2 text-[#E0771A] bg-[#FFF8EC]/30">
                              {typeof diff.serverValue === 'object' ? JSON.stringify(diff.serverValue) : String(diff.serverValue ?? '')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Resolution Choices */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleDismissConflict(conf.id)}
                      className="text-xs text-[#3E5368] hover:text-[#12263A] cursor-pointer"
                    >
                      Dismiss Alert
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveConflict(conf.id, 'keep_server')}
                        className="px-3 py-1.5 rounded-lg border border-[#E8DFCF] bg-white hover:bg-[#FFFBF3] text-[#12263A] text-xs font-semibold transition cursor-pointer"
                      >
                        Keep Server Truth
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conf.id, 'keep_local')}
                        className="px-3 py-1.5 rounded-lg border border-[#3BA0E6]/30 bg-[#EAF5FD] hover:bg-[#D4EBFA] text-[#1F86CC] text-xs font-semibold transition cursor-pointer"
                      >
                        Force Local Version
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conf.id, 'merge')}
                        className="px-3.5 py-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
                      >
                        Smart Field Merge
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Connected Devices */}
      {activeTab === 'devices' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] p-4 shadow-2xs space-y-3.5">
          <div>
            <h2 className="text-xs font-bold text-[#12263A]">
              Authorized Business Devices ({devices.length})
            </h2>
            <p className="text-xs text-[#3E5368] mt-0.5">
              Multi-device sync tracking. Revoked devices will be rejected by the server sync engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {devices.map((dev) => {
              const isCurrent = dev.id === currentDeviceId;
              return (
                <div 
                  key={dev.id} 
                  className={`p-3.5 rounded-xl border transition ${
                    isCurrent 
                      ? 'border-[#3BA0E6] bg-[#EAF5FD]/30' 
                      : dev.status === 'revoked'
                      ? 'border-[#C23B3B]/20 bg-[#FDECEC]/20 opacity-75'
                      : 'border-[#E8DFCF] bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[#FFFBF3] border border-[#E8DFCF] text-[#12263A]">
                        {dev.deviceType === 'mobile' ? (
                          <Smartphone size={18} />
                        ) : dev.deviceType === 'tablet' ? (
                          <Tablet size={18} />
                        ) : dev.deviceType === 'laptop' ? (
                          <Laptop size={18} />
                        ) : (
                          <Monitor size={18} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-xs text-[#12263A]">{dev.deviceName}</h3>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded-sm text-[9px] font-semibold bg-[#E0771A] text-white">
                              THIS DEVICE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#3E5368] mt-0.5">{dev.id}</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase ${
                      dev.status === 'active'
                        ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20'
                        : 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20'
                    }`}>
                      {dev.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#3E5368] border-t border-[#E8DFCF] pt-2">
                    <div>
                      <span className="text-[#3E5368]/60">Registered: </span>
                      {new Date(dev.registeredAt).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="text-[#3E5368]/60">Last Seen: </span>
                      {new Date(dev.lastSeenAt).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="mt-2.5 flex justify-end">
                    <button
                      onClick={() => handleToggleDeviceStatus(dev)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded transition cursor-pointer ${
                        dev.status === 'active'
                          ? 'text-[#C23B3B] hover:bg-[#FDECEC]'
                          : 'text-[#1E8E5A] hover:bg-[#E6F6EE]'
                      }`}
                    >
                      {dev.status === 'active' ? 'Revoke Device' : 'Re-Authorize Device'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Backup & Restore (v3.0) */}
      {activeTab === 'backup' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] p-4 shadow-2xs space-y-4">
          {/* Section A: Export */}
          <div className="p-4 rounded-xl border border-[#E8DFCF] bg-[#FFFBF3] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#12263A]">Export Verified Business Backup (v3.0)</h2>
              <p className="text-xs text-[#3E5368] mt-0.5 max-w-xl">
                Generates a cryptographically sealed <code className="text-[#1F86CC] font-bold">.invbak</code> archive containing all 18 business datasets, journals, inventory layers, batches, banking records, and a SHA-256 integrity checksum.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#E0771A] hover:bg-[#B85D0F] text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <Download size={14} />
              <span>Export .invbak</span>
            </button>
          </div>

          {/* Section B: Import & Restore */}
          <div className="border border-[#E8DFCF] rounded-xl p-4 space-y-3.5">
            <h2 className="text-xs font-bold text-[#12263A]">Restore Business Dataset</h2>
            
            {/* File Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#12263A] mb-1">
                Select Backup File (.invbak or legacy .json)
              </label>
              <input
                type="file"
                accept=".invbak,.json"
                onChange={handleFileSelect}
                className="block w-full text-xs text-[#3E5368] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#EAF5FD] file:text-[#1F86CC] hover:file:bg-[#D4EBFA] cursor-pointer"
              />
            </div>

            {/* Validation Preview Card */}
            {restorePreview && (
              <div className={`p-4 rounded-xl border ${
                restorePreview.valid && restorePreview.checksumMatch
                  ? 'border-[#1E8E5A]/30 bg-[#E6F6EE]/20'
                  : 'border-[#C23B3B]/30 bg-[#FDECEC]/20'
              } space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {restorePreview.valid && restorePreview.checksumMatch ? (
                      <CheckCircle2 size={18} className="text-[#1E8E5A]" />
                    ) : (
                      <XCircle size={18} className="text-[#C23B3B]" />
                    )}
                    <h3 className="text-xs font-bold text-[#12263A]">
                      Backup File Preview: {restorePreview.summary.businessName}
                    </h3>
                  </div>
                  <span className="text-[10px] text-[#3E5368]">
                    GSTIN: {restorePreview.summary.gstin}
                  </span>
                </div>

                {/* Integrity Status */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#3E5368]">SHA-256 Checksum:</span>
                  {restorePreview.checksumMatch ? (
                    <span className="text-[#1E8E5A] font-semibold flex items-center gap-1">
                      <ShieldCheck size={13} /> Verified Authentic
                    </span>
                  ) : (
                    <span className="text-[#C23B3B] font-semibold flex items-center gap-1">
                      <AlertTriangle size={13} /> Checksum Mismatch (Corrupted or Tampered)
                    </span>
                  )}
                </div>

                {/* Record Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#E8DFCF] text-xs">
                  <div className="bg-white p-2 rounded-lg border border-[#E8DFCF]">
                    <span className="text-[#3E5368] text-[10px] font-semibold">Invoices</span>
                    <p className="font-bold text-[#12263A] text-sm tabular-nums">{restorePreview.summary.details.invoices || 0}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-[#E8DFCF]">
                    <span className="text-[#3E5368] text-[10px] font-semibold">Parties</span>
                    <p className="font-bold text-[#12263A] text-sm tabular-nums">{restorePreview.summary.details.parties || 0}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-[#E8DFCF]">
                    <span className="text-[#3E5368] text-[10px] font-semibold">Items</span>
                    <p className="font-bold text-[#12263A] text-sm tabular-nums">{restorePreview.summary.details.items || 0}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-[#E8DFCF]">
                    <span className="text-[#3E5368] text-[10px] font-semibold">Journals</span>
                    <p className="font-bold text-[#12263A] text-sm tabular-nums">{restorePreview.summary.details.journalEntries || 0}</p>
                  </div>
                </div>

                {/* Restore Mode & Pre-snapshot Settings */}
                <div className="pt-3 border-t border-[#E8DFCF] space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#12263A] mb-1.5">
                      Restore Mode
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className="flex items-center gap-2 text-xs text-[#12263A] cursor-pointer">
                        <input
                          type="radio"
                          name="restore_mode"
                          checked={restoreMode === 'empty_business'}
                          onChange={() => setRestoreMode('empty_business')}
                          className="text-[#1F86CC]"
                        />
                        <span><strong>Clean Replace</strong> (Wipe current business & restore)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[#12263A] cursor-pointer">
                        <input
                          type="radio"
                          name="restore_mode"
                          checked={restoreMode === 'safe_merge'}
                          onChange={() => setRestoreMode('safe_merge')}
                          className="text-[#1F86CC]"
                        />
                        <span><strong>Safe Merge</strong> (Skip existing records, prevent duplicate invoices)</span>
                      </label>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#3E5368] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createSafetySnapshot}
                      onChange={(e) => setCreateSafetySnapshot(e.target.checked)}
                      className="rounded text-[#1F86CC]"
                    />
                    <span>Create automatic pre-restore safety snapshot before modifying database</span>
                  </label>

                  <div className="pt-2">
                    <button
                      onClick={handleExecuteRestore}
                      disabled={!restorePreview.valid || !restorePreview.checksumMatch || loading}
                      className="px-4 py-2 bg-[#E0771A] hover:bg-[#B85D0F] text-white rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
                    >
                      Confirm & Execute Restore
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Restore Result Card */}
            {restoreResult && (
              <div className={`p-3.5 rounded-xl border ${
                restoreResult.success ? 'bg-[#E6F6EE] border-[#1E8E5A]/20 text-[#1E8E5A]' : 'bg-[#FDECEC] border-[#C23B3B]/20 text-[#C23B3B]'
              } text-xs space-y-1`}>
                <p className="font-semibold">{restoreResult.message}</p>
                {restoreResult.snapshotBackupId && (
                  <p className="text-[11px] text-[#3E5368]">
                    Safety snapshot saved: <span>{restoreResult.snapshotBackupId}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section C: Backup & Snapshot History */}
          <div className="border border-[#E8DFCF] rounded-xl p-4 space-y-2.5">
            <h2 className="text-xs font-bold text-[#12263A] flex items-center gap-2">
              <History size={14} />
              <span>Backup & Snapshot History</span>
            </h2>

            {backupHistory.length === 0 ? (
              <p className="text-xs text-[#3E5368]">No previous backups or safety snapshots recorded.</p>
            ) : (
              <div className="divide-y divide-[#E8DFCF] text-xs">
                {backupHistory.map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[#12263A]">{b.filename}</p>
                      <p className="text-[10px] text-[#3E5368]">
                        Checksum: {b.checksum?.substring(0, 16)}... | Type: {b.snapshotType}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#3E5368]">
                      {new Date(b.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Supabase Cloud Sync & Migration */}
      {activeTab === 'cloud' && (
        <div className="bg-white rounded-xl border border-[#E8DFCF] p-5 shadow-2xs space-y-5">
          {/* Header & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E8DFCF] gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#12263A] flex items-center gap-2">
                <Cloud className="text-[#1F86CC]" size={18} />
                <span>Supabase Cloud Integration & Database Sync</span>
              </h2>
              <p className="text-xs text-[#3E5368] mt-0.5">
                Bidirectional synchronization between local offline IndexedDB and PostgreSQL cloud tenant.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                cloudUser 
                  ? 'bg-[#E6F6EE] text-[#1E8E5A]' 
                  : 'bg-[#FFF3DC] text-[#B7791F]'
              }`}>
                <span className={`w-2 h-2 rounded-full ${cloudUser ? 'bg-[#1E8E5A]' : 'bg-[#B7791F]'}`} />
                {cloudUser ? 'Connected & Authenticated' : 'Not Signed In'}
              </span>
            </div>
          </div>

          {/* Cloud Account Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-[#E8DFCF] bg-[#FFFBF3] space-y-2">
              <h3 className="text-xs font-bold text-[#12263A] flex items-center gap-1.5">
                <Server size={14} className="text-[#1F86CC]" /> Supabase Cloud Project
              </h3>
              <div className="text-xs space-y-1 font-mono text-[#3E5368]">
                <p><strong className="text-[#12263A]">Project URL:</strong> https://lftbzabnaxvnhbamyhot.supabase.co</p>
                <p><strong className="text-[#12263A]">Database:</strong> PostgreSQL (Row-Level Security Enabled)</p>
                <p><strong className="text-[#12263A]">API Engine:</strong> PostgREST / Realtime WebSockets</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[#E8DFCF] bg-[#FFFBF3] space-y-2">
              <h3 className="text-xs font-bold text-[#12263A] flex items-center gap-1.5">
                <Smartphone size={14} className="text-[#E0771A]" /> Active Cloud Session
              </h3>
              <div className="text-xs space-y-1 text-[#3E5368]">
                <p><strong className="text-[#12263A]">User Email:</strong> {cloudUser?.email || 'Guest / Local Session'}</p>
                <p><strong className="text-[#12263A]">Auth Provider:</strong> {cloudUser?.app_metadata?.provider || 'local'}</p>
                <p><strong className="text-[#12263A]">User ID:</strong> <span className="font-mono text-[11px]">{cloudUser?.id || 'offline'}</span></p>
              </div>
            </div>
          </div>

          {/* Migration Action Buttons */}
          <div className="p-4 rounded-xl border border-[#E8DFCF] space-y-3">
            <h3 className="text-xs font-bold text-[#12263A]">Cloud Data Transfer & Migration</h3>
            <p className="text-xs text-[#3E5368]">
              Upload all local transactions (invoices, parties, items, bank records, ledger journals) to the cloud, or download cloud state into your offline cache.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handlePushToCloud}
                disabled={migrationRunning || !cloudUser}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] text-white text-xs font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
              >
                <CloudUpload size={15} className={migrationRunning ? 'animate-bounce' : ''} />
                <span>{migrationRunning ? 'Migrating Data...' : 'Push Local Data to Supabase'}</span>
              </button>

              <button
                onClick={handlePullFromCloud}
                disabled={migrationRunning || !cloudUser}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E8DFCF] bg-white hover:bg-[#EAF5FD] text-[#12263A] text-xs font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
              >
                <CloudDownload size={15} className="text-[#1F86CC]" />
                <span>Pull Cloud Data to Local Cache</span>
              </button>

              {!cloudUser && (
                <span className="text-xs text-[#B7791F] font-medium">
                  Please log in to synchronize with cloud database.
                </span>
              )}
            </div>

            {/* Migration Results Summary */}
            {migrationSummary && (
              <div className="mt-4 p-3.5 rounded-xl border border-[#E8DFCF] bg-[#FFFBF3] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#12263A]">Migration Report:</span>
                  <span className={`font-semibold ${migrationSummary.success ? 'text-[#1E8E5A]' : 'text-[#B7791F]'}`}>
                    {migrationSummary.message}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] pt-1">
                  <div className="p-2 bg-white rounded border border-[#E8DFCF]">Parties: <strong>{migrationSummary.pushed.parties}</strong></div>
                  <div className="p-2 bg-white rounded border border-[#E8DFCF]">Items: <strong>{migrationSummary.pushed.items}</strong></div>
                  <div className="p-2 bg-white rounded border border-[#E8DFCF]">Invoices: <strong>{migrationSummary.pushed.invoices}</strong></div>
                  <div className="p-2 bg-white rounded border border-[#E8DFCF]">Expenses: <strong>{migrationSummary.pushed.expenses}</strong></div>
                  <div className="p-2 bg-white rounded border border-[#E8DFCF]">Vouchers: <strong>{migrationSummary.pushed.vouchers}</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* Supabase Storage Buckets Status */}
          <div className="border border-[#E8DFCF] rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-[#12263A] flex items-center gap-1.5">
              <Layers size={14} className="text-[#1F86CC]" /> Supabase Storage Buckets
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-[#E8DFCF] bg-white">
                <p className="font-semibold text-[#12263A]">business-logos</p>
                <p className="text-[10px] text-[#1E8E5A] font-semibold mt-0.5">● Public bucket active</p>
                <p className="text-[11px] text-[#3E5368] mt-1">Company logo branding assets</p>
              </div>
              <div className="p-3 rounded-lg border border-[#E8DFCF] bg-white">
                <p className="font-semibold text-[#12263A]">invoice-attachments</p>
                <p className="text-[10px] text-[#1E8E5A] font-semibold mt-0.5">● Private bucket active</p>
                <p className="text-[11px] text-[#3E5368] mt-1">Signed e-invoices, PDFs, PO slips</p>
              </div>
              <div className="p-3 rounded-lg border border-[#E8DFCF] bg-white">
                <p className="font-semibold text-[#12263A]">expense-receipts</p>
                <p className="text-[10px] text-[#1E8E5A] font-semibold mt-0.5">● Private bucket active</p>
                <p className="text-[11px] text-[#3E5368] mt-1">Vendor bills and payment receipts</p>
              </div>
              <div className="p-3 rounded-lg border border-[#E8DFCF] bg-white">
                <p className="font-semibold text-[#12263A]">business-documents</p>
                <p className="text-[10px] text-[#1E8E5A] font-semibold mt-0.5">● Private bucket active</p>
                <p className="text-[11px] text-[#3E5368] mt-1">GST certificates and bank slips</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
