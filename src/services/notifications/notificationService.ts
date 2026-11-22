import { BusinessNotification } from '../../types/workspace';
import { idbGetAll, idbPut, idbDelete } from '../storage/idb';

/**
 * Scans local database and generates automated contextual notifications.
 */
export async function generateSystemNotifications(): Promise<BusinessNotification[]> {
  const notifications: BusinessNotification[] = [];
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];

  // 1. Low Stock Scan
  const items = await idbGetAll('items');
  for (const item of items) {
    const reorderLevel = (item as any).reorderLevel ?? 10;
    if (item.stockQty <= reorderLevel) {
      notifications.push({
        id: `notif_stock_${item.id}`,
        title: 'Low Stock Alert',
        message: `${item.name} is running low: only ${item.stockQty} ${item.unit} remaining (Reorder Level: ${reorderLevel}).`,
        category: 'low_stock',
        severity: item.stockQty === 0 ? 'error' : 'warning',
        isRead: false,
        linkUrl: '/inventory',
        entityType: 'item',
        entityId: item.id,
        timestamp: now
      });
    }
  }

  // 2. Expiring Batches Scan (batches expiring within 30 days)
  const batches = await idbGetAll('product_batches');
  const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  for (const batch of batches) {
    if (batch.expiryDate && batch.expiryDate <= thirtyDaysLater && batch.remainingQuantity > 0) {
      const isExpired = batch.expiryDate < todayStr;
      notifications.push({
        id: `notif_batch_${batch.id}`,
        title: isExpired ? 'Batch Expired' : 'Batch Expiring Soon',
        message: `Batch ${batch.batchNumber} (${batch.remainingQuantity} units) ${isExpired ? 'expired on' : 'expires on'} ${batch.expiryDate}.`,
        category: 'expiring_batch',
        severity: isExpired ? 'error' : 'warning',
        isRead: false,
        linkUrl: '/inventory',
        entityType: 'batch',
        entityId: batch.id,
        timestamp: now
      });
    }
  }

  // 3. Overdue Receivables Scan
  const invoices = await idbGetAll('invoices');
  for (const inv of invoices) {
    if (inv.partyType === 'customer' && inv.status === 'Active' && inv.balanceDue > 0 && inv.dueDate < todayStr) {
      notifications.push({
        id: `notif_ar_${inv.id}`,
        title: 'Overdue Receivable',
        message: `Invoice ${inv.invoiceNumber} has overdue balance of ₹${inv.balanceDue.toFixed(2)} (Due: ${inv.dueDate}).`,
        category: 'overdue_receivable',
        severity: 'warning',
        isRead: false,
        linkUrl: '/sales',
        entityType: 'invoice',
        entityId: inv.id,
        timestamp: now
      });
    }
  }

  // 4. Upcoming Payables Scan (due within 5 days)
  const fiveDaysLater = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
  for (const bill of invoices) {
    if (bill.partyType === 'supplier' && bill.status === 'Active' && bill.balanceDue > 0 && bill.dueDate <= fiveDaysLater) {
      notifications.push({
        id: `notif_ap_${bill.id}`,
        title: 'Upcoming Supplier Payment',
        message: `Bill ${bill.invoiceNumber} has outstanding payment of ₹${bill.balanceDue.toFixed(2)} due on ${bill.dueDate}.`,
        category: 'upcoming_payable',
        severity: bill.dueDate < todayStr ? 'error' : 'info',
        isRead: false,
        linkUrl: '/purchases',
        entityType: 'purchase_bill',
        entityId: bill.id,
        timestamp: now
      });
    }
  }

  // Persist generated notifications
  for (const notif of notifications) {
    await idbPut('notifications', notif);
  }

  return notifications;
}

/**
 * Gets all notifications sorted by timestamp descending.
 */
export async function getAllNotifications(): Promise<BusinessNotification[]> {
  const notifs = await idbGetAll('notifications');
  return notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<void> {
  const notifs = await idbGetAll('notifications');
  const target = notifs.find(n => n.id === id);
  if (target) {
    target.isRead = true;
    await idbPut('notifications', target);
  }
}

/**
 * Marks all notifications as read.
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const notifs = await idbGetAll('notifications');
  for (const notif of notifs) {
    if (!notif.isRead) {
      notif.isRead = true;
      await idbPut('notifications', notif);
    }
  }
}

/**
 * Deletes a notification.
 */
export async function deleteNotification(id: string): Promise<void> {
  await idbDelete('notifications', id);
}
