import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { BusinessNotification } from '../types/workspace';
import { 
  generateSystemNotifications, getAllNotifications, 
  markNotificationAsRead, markAllNotificationsAsRead, deleteNotification,
  clearAllNotifications
} from '../services/notifications/notificationService';

interface NotificationCenterProps {
  onNavigate?: (tab: string) => void;
}

export default function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<BusinessNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      await generateSystemNotifications();
      const all = await getAllNotifications();
      setNotifications(all);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markNotificationAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
  };

  const handleNotificationClick = async (notif: BusinessNotification) => {
    if (!notif.isRead) {
      await markNotificationAsRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    }
    setIsOpen(false);
    if (notif.linkUrl && onNavigate) {
      const tab = notif.linkUrl.replace('/', '');
      onNavigate(tab);
    }
  };

  const getSeverityIcon = (severity: BusinessNotification['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-500" />;
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-500" />;
      default:
        return <Info size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button - Vertically and Horizontally Aligned (h-[38px] w-[38px]) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center h-[38px] w-[38px] text-[#3E5368] hover:text-[#12263A] hover:bg-[#FFFBF3] rounded-lg transition cursor-pointer border border-[#E8DFCF] shadow-xs"
        title="Notifications"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#E0771A] text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-[#E8DFCF] z-50 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-[#FFFBF3] border-b border-[#E8DFCF]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[13px] text-[#12263A]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-[#EAF5FD] text-[#14689F] text-[11px] font-semibold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[12px] font-medium text-[#14689F] hover:underline transition cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-[12px] font-medium text-[#C23B3B] hover:underline transition cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#E8DFCF]/50">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#3E5368]">
                No notifications. Everything is running smoothly.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-3 p-3.5 transition cursor-pointer hover:bg-[#FFFBF3] ${
                    notif.isRead ? 'opacity-80 bg-white' : 'bg-[#EAF5FD]/40'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {getSeverityIcon(notif.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-[13px] text-[#12263A] truncate">{notif.title}</p>
                      <span className="text-[11px] text-[#3E5368] shrink-0">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#3E5368] mt-0.5 line-clamp-2">{notif.message}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!notif.isRead && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        className="p-1 text-[#3E5368] hover:text-[#1F86CC] rounded transition cursor-pointer"
                        title="Mark read"
                      >
                        <Check size={13} />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(notif.id, e)}
                      className="p-1 text-[#3E5368] hover:text-[#C23B3B] rounded transition cursor-pointer"
                      title="Dismiss permanently"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
