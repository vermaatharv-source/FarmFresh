import React, { useState, useEffect, useRef } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function NotificationBell({ onSelectOrder }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await API.get('/notifications/mine');
      if (res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      // Non-intrusive error
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000); // 25s polling
    return () => clearInterval(interval);
  }, [user]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await API.patch(`/notifications/mine/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      if (res.data?.unreadCount != null) {
        setUnreadCount(res.data.unreadCount);
      } else {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await API.patch('/notifications/mine/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await API.delete(`/notifications/mine/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (res.data?.unreadCount != null) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  const handleItemClick = (n) => {
    if (!n.isRead) {
      handleMarkAsRead(n._id);
    }
    if (n.meta?.orderId && onSelectOrder) {
      onSelectOrder(n.meta.orderId);
      setIsOpen(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'OrderDispatched':
        return '🚚';
      case 'OrderDelivered':
        return '✅';
      case 'OrderPacked':
        return '📦';
      case 'OrderAccepted':
        return '🌾';
      case 'OrderCancelled':
        return '🛑';
      case 'RefundProcessed':
        return '💳';
      case 'ReturnRequested':
        return '⏳';
      case 'BackInStock':
        return '✨';
      default:
        return '🔔';
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative z-[100]" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        title="Notifications & Alerts"
        className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border transition ${
          isOpen
            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
            : 'bg-white hover:bg-emerald-50 text-gray-700 border-emerald-100'
        }`}
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden animate-fadeIn">
          {/* Panel Header */}
          <div className="p-3.5 border-b bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🔔</span>
              <h3 className="text-sm font-bold">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-emerald-100 hover:text-white underline transition"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List of alerts */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                <span className="text-2xl block mb-2">🌿</span>
                No notifications right now. We'll update you as soon as your orders progress!
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3.5 flex items-start gap-3 transition cursor-pointer hover:bg-gray-50/80 ${
                    !n.isRead ? 'bg-emerald-50/40' : 'bg-white'
                  }`}
                >
                  {/* Icon */}
                  <span className="text-xl flex-shrink-0 mt-0.5">{getIcon(n.type)}</span>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs leading-relaxed ${
                        !n.isRead ? 'font-semibold text-gray-900' : 'text-gray-600'
                      }`}
                    >
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">
                        {formatTime(n.createdAt)}
                      </span>
                      {n.meta?.orderId && (
                        <span className="text-[10px] font-semibold text-emerald-700 hover:underline">
                          View Order →
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions (Unread indicator & delete) */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                    {!n.isRead && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-600"
                        title="Unread"
                      />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(n._id, e)}
                      title="Dismiss notification"
                      className="text-gray-300 hover:text-gray-500 text-xs p-1 rounded transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t bg-gray-50 text-center">
            <p className="text-[10px] text-gray-400">
              FarmFresh Automated Dispatch & Harvest Alerts
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
