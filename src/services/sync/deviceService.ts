/**
 * Device Management Service
 * Manages unique persistent device registration, fingerprinting, revocation, and sync checkpoints.
 */

import { SyncDevice, DeviceType } from '../../types/sync';
import { getIDB, idbPut, idbGetAll } from '../storage/idb';

const DEVICE_ID_STORAGE_KEY = 'invoicepro_device_id';
const DEVICE_NAME_STORAGE_KEY = 'invoicepro_device_name';

/**
 * Detects device hardware profile and environment
 */
export function detectDeviceType(): DeviceType {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  if (/ipad|tablet/i.test(ua) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /macintosh/.test(ua))) {
    return 'tablet';
  }
  if (/windows|macintosh|linux/i.test(ua)) {
    return 'desktop';
  }
  return 'desktop';
}

/**
 * Generates or retrieves the persistent unique device ID (inv_dev_${UUID})
 */
export function getCurrentDeviceId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      const randomUuid = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      id = `inv_dev_${randomUuid}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  }
  return `inv_dev_fallback_${Date.now()}`;
}

/**
 * Gets or creates human-readable device name
 */
export function getCurrentDeviceName(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    let name = localStorage.getItem(DEVICE_NAME_STORAGE_KEY);
    if (!name) {
      const type = detectDeviceType();
      const browser = typeof navigator !== 'undefined' && /chrome|firefox|safari|edge/i.exec(navigator.userAgent)?.[0] || 'Browser';
      name = `${type.toUpperCase()} (${browser.toUpperCase()})`;
      localStorage.setItem(DEVICE_NAME_STORAGE_KEY, name);
    }
    return name;
  }
  return 'Local Device';
}

/**
 * Registers or updates the current device in local storage and IndexedDB
 */
export async function registerCurrentDevice(
  businessId: string = 'primary_business',
  userId: string = 'local_user',
  customName?: string
): Promise<SyncDevice> {
  const deviceId = getCurrentDeviceId();
  const deviceName = customName || getCurrentDeviceName();
  const deviceType = detectDeviceType();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js/Test';

  if (customName && typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(DEVICE_NAME_STORAGE_KEY, customName);
  }

  const db = await getIDB();
  const existing = await db.get('sync_devices', deviceId);

  const device: SyncDevice = {
    id: deviceId,
    businessId,
    userId,
    deviceName,
    deviceType,
    clientVersion: '5.0.0',
    userAgent,
    registeredAt: existing?.registeredAt || new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    lastSyncedAt: existing?.lastSyncedAt,
    status: existing?.status || 'active',
    syncCheckpoint: existing?.syncCheckpoint || {
      lastServerSeq: 0,
      timestamp: new Date().toISOString()
    }
  };

  await idbPut('sync_devices', device);
  return device;
}

/**
 * Gets the current device profile
 */
export async function getCurrentDevice(): Promise<SyncDevice> {
  const deviceId = getCurrentDeviceId();
  const db = await getIDB();
  const device = await db.get('sync_devices', deviceId);
  if (device) return device;

  return registerCurrentDevice();
}

/**
 * Checks whether the current device (or specified device ID) has been revoked
 */
export async function isDeviceRevoked(deviceId?: string): Promise<boolean> {
  const targetId = deviceId || getCurrentDeviceId();
  const db = await getIDB();
  const device = await db.get('sync_devices', targetId);
  return device ? device.status === 'revoked' : false;
}

/**
 * Gets all registered devices for the business
 */
export async function getRegisteredDevices(businessId?: string): Promise<SyncDevice[]> {
  const devices = await idbGetAll('sync_devices');
  if (businessId) {
    return devices.filter(d => d.businessId === businessId);
  }
  return devices;
}

/**
 * Revokes a device's synchronization authorization
 */
export async function revokeDevice(deviceId: string): Promise<SyncDevice | null> {
  const db = await getIDB();
  const device = await db.get('sync_devices', deviceId);
  if (!device) return null;

  device.status = 'revoked';
  device.lastSeenAt = new Date().toISOString();
  await idbPut('sync_devices', device);
  return device;
}

/**
 * Re-activates a revoked device
 */
export async function activateDevice(deviceId: string): Promise<SyncDevice | null> {
  const db = await getIDB();
  const device = await db.get('sync_devices', deviceId);
  if (!device) return null;

  device.status = 'active';
  device.lastSeenAt = new Date().toISOString();
  await idbPut('sync_devices', device);
  return device;
}

/**
 * Updates the sync checkpoint for the current device
 */
export async function updateDeviceSyncCheckpoint(checkpoint: {
  lastServerSeq: number;
  lastOutboxOperationId?: string;
}): Promise<void> {
  const device = await getCurrentDevice();
  device.lastSyncedAt = new Date().toISOString();
  device.lastSeenAt = new Date().toISOString();
  device.syncCheckpoint = {
    lastServerSeq: checkpoint.lastServerSeq,
    lastOutboxOperationId: checkpoint.lastOutboxOperationId,
    timestamp: new Date().toISOString()
  };
  await idbPut('sync_devices', device);
}
