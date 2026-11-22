import { BusinessAuditEvent } from '../../types/workspace';
import { idbGetAll, idbPut } from '../storage/idb';

/**
 * Logs an immutable audit event for system operations.
 */
export async function logAuditEvent(
  event: Omit<BusinessAuditEvent, 'id' | 'timestamp'>
): Promise<BusinessAuditEvent> {
  const auditEvent: BusinessAuditEvent = {
    ...event,
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString()
  };

  await idbPut('audit_events', auditEvent);
  return auditEvent;
}

/**
 * Retrieves audit events with optional filtering by entity, user, or date range.
 */
export async function getAuditTrail(filter?: {
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<BusinessAuditEvent[]> {
  let events = await idbGetAll('audit_events');

  if (filter?.entityType) {
    events = events.filter(e => e.entityType === filter.entityType);
  }
  if (filter?.entityId) {
    events = events.filter(e => e.entityId === filter.entityId);
  }
  if (filter?.userId) {
    events = events.filter(e => e.userId === filter.userId);
  }
  if (filter?.startDate) {
    events = events.filter(e => e.timestamp >= filter.startDate!);
  }
  if (filter?.endDate) {
    events = events.filter(e => e.timestamp <= filter.endDate!);
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
