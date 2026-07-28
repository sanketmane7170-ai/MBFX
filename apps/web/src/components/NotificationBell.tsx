import { useEffect, useRef, useState } from 'react';
import { Bell, Info, WifiOff, Wifi, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { notificationsApi, type Notification, type NotificationType } from '@/lib/api';

function iconFor(type: NotificationType) {
  switch (type) {
    case 'COPY_FAILED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'ACCOUNT_OFFLINE':
      return <WifiOff className="h-4 w-4 text-amber-500" />;
    case 'ACCOUNT_ONLINE':
      return <Wifi className="h-4 w-4 text-emerald-500" />;
    default:
      return <Info className="h-4 w-4 text-gray-400" />;
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const loadCount = () =>
    notificationsApi
      .unreadCount()
      .then((r) => setUnread(r.count))
      .catch(() => undefined);

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const list = await notificationsApi.list().catch(() => []);
      setItems(list);
      if (unread > 0) {
        await notificationsApi.markAllRead().catch(() => undefined);
        setUnread(0);
      }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">
            Notifications
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">No notifications yet</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={cn('border-b border-gray-50 px-4 py-3', !n.readAt && 'bg-brand-50/40')}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">{iconFor(n.type)}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      {n.body && <div className="mt-0.5 text-xs text-gray-500">{n.body}</div>}
                      <div className="mt-1 text-[11px] text-gray-400">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
