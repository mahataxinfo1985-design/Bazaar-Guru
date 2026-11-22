import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, AlertTriangle, ShieldCheck, Download, Upload, 
  Smartphone, Laptop, Monitor, Tablet, CheckCircle2, XCircle, 
  ArrowRight, Database, FileText, Layers, Trash2, Check, AlertCircle, History
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
  const [activeTab, setActiveTab] = useState<'outbox' | 'conflicts' | 'devices' | 'backup'>('outbox');

  // State for data
  const [outboxOps, setOutboxOps] = useState<OutboxOperation[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

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
    } catch (e: any) {
      console.error('Error loading sync hub data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
    <div className="space-y-6">
      {/* Top Banner / Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">Sync & Backup Hub</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Phase 5 Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Offline-first transaction outbox, multi-device management, conflict resolution & verifiable backups.
          </p>
        </div>

        {/* Global Connection Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Offline
              </span>
            )}
          </div>

          <button
            onClick={handleManualSync}
            disabled={loading || !isOnline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Sync Now</span>
          </button>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div className={`p-4 rounded-lg text-xs font-semibold flex items-center justify-between border ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : actionMessage.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600">
            <Check size={14} />
          </button>
        </div>
      )}

      {/* Hub Tabs */}
      <div className="flex border-b border-slate-200 gap-1 bg-white px-4 pt-2 rounded-t-xl border-x">
        <button
          onClick={() => setActiveTab('outbox')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'outbox' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RefreshCw size={14} />
          <span>Transaction Outbox</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">
              {pendingCount}
            </span>
          )}
          {failedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold">
              {failedCount} err
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('conflicts')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'conflicts' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle size={14} />
          <span>Conflict Center</span>
          {conflictCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
              {conflictCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'devices' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Smartphone size={14} />
          <span>Connected Devices</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold">
            {devices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'backup' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database size={14} />
          <span>Backup & Restore (v3.0)</span>
        </button>
      </div>

      {/* Tab 1: Transaction Outbox */}
      {activeTab === 'outbox' && (
        <div className="bg-white rounded-b-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Local Mutation Outbox ({outboxOps.length} items)
            </h2>
            <div className="flex gap-2">
              {failedCount > 0 && (
                <button
                  onClick={handleRetryAll}
                  className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition border border-rose-200 cursor-pointer"
                >
                  Retry All Failed
                </button>
              )}
              <button
                onClick={handlePurgeSynced}
                className="px-2.5 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100 text-xs font-bold transition border border-slate-200 cursor-pointer"
              >
                Clear Synced
              </button>
            </div>
          </div>

          {outboxOps.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-xs font-bold text-slate-700">Outbox is completely clear</p>
              <p className="text-[11px] text-slate-400 mt-0.5">All local mutations are safely synced with cloud.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2.5 px-3 font-semibold">Entity</th>
                    <th className="py-2.5 px-3 font-semibold">Operation</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Retries</th>
                    <th className="py-2.5 px-3 font-semibold">Created / Next Retry</th>
                    <th className="py-2.5 px-3 font-semibold">Last Error</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outboxOps.map((op) => (
                    <tr key={op.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                        {op.entityType} <span className="text-slate-400">({op.entityId})</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold uppercase text-[10px] text-slate-600">
                        {op.operationType}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          op.status === 'synced'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : op.status === 'pending'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : op.status === 'processing'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {op.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-semibold">
                        {op.retryCount} / {op.maxRetries}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        <div>{new Date(op.createdAt).toLocaleTimeString()}</div>
                        {op.nextRetryAt && (
                          <div className="text-[10px] text-amber-600">
                            Retry: {new Date(op.nextRetryAt).toLocaleTimeString()}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-rose-600 text-[11px] max-w-xs truncate" title={op.lastError}>
                        {op.lastError || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1">
                        {(op.status === 'failed' || op.status === 'action_required' || op.status === 'pending') && (
                          <button
                            onClick={() => handleRetry(op.id)}
                            className="p-1 hover:bg-slate-200 rounded text-blue-600 cursor-pointer"
                            title="Retry now"
                          >
                            <RefreshCw size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => handleCancelOp(op.id)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
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
        <div className="bg-white rounded-b-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Unresolved Synchronization Conflicts ({conflicts.length})
            </h2>
          </div>

          {conflicts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <ShieldCheck size={32} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-xs font-bold text-slate-700">No active conflicts</p>
              <p className="text-[11px] text-slate-400 mt-0.5">All offline mutations resolved cleanly with cloud records.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {conflicts.map((conf) => (
                <div key={conf.id} className="border border-rose-200 rounded-xl p-4 bg-rose-50/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        {conf.conflictType}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {conf.entityType} ({conf.entityId})
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Detected: {new Date(conf.detectedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Side-by-side Field Diff */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <th className="p-2 font-semibold">Field</th>
                          <th className="p-2 font-semibold text-blue-600">Local Client Version</th>
                          <th className="p-2 font-semibold text-purple-600">Cloud Server Version</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {(conf.fieldDifferences || []).map((diff, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-semibold text-slate-700">{diff.field}</td>
                            <td className="p-2 text-blue-800 bg-blue-50/30">
                              {typeof diff.localValue === 'object' ? JSON.stringify(diff.localValue) : String(diff.localValue ?? '')}
                            </td>
                            <td className="p-2 text-purple-800 bg-purple-50/30">
                              {typeof diff.serverValue === 'object' ? JSON.stringify(diff.serverValue) : String(diff.serverValue ?? '')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Resolution Choices */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => handleDismissConflict(conf.id)}
                      className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Dismiss Alert
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveConflict(conf.id, 'keep_server')}
                        className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold transition cursor-pointer"
                      >
                        Keep Server Truth
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conf.id, 'keep_local')}
                        className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition cursor-pointer"
                      >
                        Force Local Version
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conf.id, 'merge')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
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
        <div className="bg-white rounded-b-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Authorized Business Devices ({devices.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-device sync tracking. Revoked devices will be rejected by the server sync engine.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((dev) => {
              const isCurrent = dev.id === currentDeviceId;
              return (
                <div 
                  key={dev.id} 
                  className={`p-4 rounded-xl border transition ${
                    isCurrent 
                      ? 'border-blue-400 bg-blue-50/20' 
                      : dev.status === 'revoked'
                      ? 'border-rose-200 bg-rose-50/20 opacity-75'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
                        {dev.deviceType === 'mobile' ? (
                          <Smartphone size={20} />
                        ) : dev.deviceType === 'tablet' ? (
                          <Tablet size={20} />
                        ) : dev.deviceType === 'laptop' ? (
                          <Laptop size={20} />
                        ) : (
                          <Monitor size={20} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-xs text-slate-800">{dev.deviceName}</h3>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-600 text-white">
                              THIS DEVICE
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">{dev.id}</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      dev.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {dev.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-t border-slate-100 pt-2.5">
                    <div>
                      <span className="text-slate-400">Registered: </span>
                      {new Date(dev.registeredAt).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="text-slate-400">Last Seen: </span>
                      {new Date(dev.lastSeenAt).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleToggleDeviceStatus(dev)}
                      className={`text-xs font-semibold px-3 py-1 rounded transition cursor-pointer ${
                        dev.status === 'active'
                          ? 'text-rose-600 hover:bg-rose-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
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
        <div className="bg-white rounded-b-xl border border-slate-200 p-6 shadow-xs space-y-6">
          {/* Section A: Export */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Export Verified Business Backup (v3.0)</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Generates a cryptographically sealed <code className="text-blue-600 font-bold">.invbak</code> archive containing all 18 business datasets, journals, inventory layers, batches, banking records, and a SHA-256 integrity checksum.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download size={15} />
              <span>Export .invbak</span>
            </button>
          </div>

          {/* Section B: Import & Restore */}
          <div className="border border-slate-200 rounded-xl p-5 space-y-5">
            <h2 className="text-sm font-bold text-slate-800">Restore Business Dataset</h2>
            
            {/* File Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Backup File (.invbak or legacy .json)
              </label>
              <input
                type="file"
                accept=".invbak,.json"
                onChange={handleFileSelect}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>

            {/* Validation Preview Card */}
            {restorePreview && (
              <div className={`p-4 rounded-xl border ${
                restorePreview.valid && restorePreview.checksumMatch
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : 'border-rose-200 bg-rose-50/20'
              } space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {restorePreview.valid && restorePreview.checksumMatch ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : (
                      <XCircle size={18} className="text-rose-600" />
                    )}
                    <h3 className="text-xs font-bold text-slate-800">
                      Backup File Preview: {restorePreview.summary.businessName}
                    </h3>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">
                    GSTIN: {restorePreview.summary.gstin}
                  </span>
                </div>

                {/* Integrity Status */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">SHA-256 Checksum:</span>
                  {restorePreview.checksumMatch ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <ShieldCheck size={13} /> Verified Authentic
                    </span>
                  ) : (
                    <span className="text-rose-700 font-bold flex items-center gap-1">
                      <AlertTriangle size={13} /> Checksum Mismatch (Corrupted or Tampered)
                    </span>
                  )}
                </div>

                {/* Record Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-xs">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Invoices</span>
                    <p className="font-bold text-slate-800 text-sm">{restorePreview.summary.details.invoices || 0}</p>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Parties</span>
                    <p className="font-bold text-slate-800 text-sm">{restorePreview.summary.details.parties || 0}</p>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Items</span>
                    <p className="font-bold text-slate-800 text-sm">{restorePreview.summary.details.items || 0}</p>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Journals</span>
                    <p className="font-bold text-slate-800 text-sm">{restorePreview.summary.details.journalEntries || 0}</p>
                  </div>
                </div>

                {/* Restore Mode & Pre-snapshot Settings */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Restore Mode
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="restore_mode"
                          checked={restoreMode === 'empty_business'}
                          onChange={() => setRestoreMode('empty_business')}
                          className="text-blue-600"
                        />
                        <span><strong>Clean Replace</strong> (Wipe current business & restore)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="restore_mode"
                          checked={restoreMode === 'safe_merge'}
                          onChange={() => setRestoreMode('safe_merge')}
                          className="text-blue-600"
                        />
                        <span><strong>Safe Merge</strong> (Skip existing records, prevent duplicate invoices)</span>
                      </label>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createSafetySnapshot}
                      onChange={(e) => setCreateSafetySnapshot(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Create automatic pre-restore safety snapshot before modifying database</span>
                  </label>

                  <div className="pt-2">
                    <button
                      onClick={handleExecuteRestore}
                      disabled={!restorePreview.valid || !restorePreview.checksumMatch || loading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      Confirm & Execute Restore
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Restore Result Card */}
            {restoreResult && (
              <div className={`p-4 rounded-xl border ${
                restoreResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              } text-xs space-y-1`}>
                <p className="font-bold">{restoreResult.message}</p>
                {restoreResult.snapshotBackupId && (
                  <p className="text-[11px] text-slate-600">
                    Safety snapshot saved: <span className="font-mono">{restoreResult.snapshotBackupId}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section C: Backup & Snapshot History */}
          <div className="border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <History size={15} />
                <span>Backup & Snapshot History</span>
              </h2>
            </div>

            {backupHistory.length === 0 ? (
              <p className="text-xs text-slate-400">No previous backups or safety snapshots recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {backupHistory.map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{b.filename}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Checksum: {b.checksum?.substring(0, 16)}... | Type: {b.snapshotType}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {new Date(b.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
