import { useEffect, useState } from 'react';
import { Loader2, Monitor } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { sessionsApi, type Session } from '@/lib/api';

export function SessionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSessions(await sessionsApi.list());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load sessions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      await sessionsApi.revoke(id);
      toast('Session signed out', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const revokeOthers = async () => {
    setBusy(true);
    try {
      await sessionsApi.revokeOthers();
      toast('Signed out of other devices', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const hasOthers = sessions.some((s) => !s.current);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Active sessions"
      description="Devices currently signed in to your account."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="danger" onClick={revokeOthers} disabled={busy || !hasOthers}>
            Sign out other devices
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
              <Monitor className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-800">
                  {s.userAgent || 'Unknown device'}
                  {s.current && <span className="ml-2 text-xs font-normal text-brand-600">This device</span>}
                </div>
                <div className="text-xs text-gray-400">
                  {s.ip ? `${s.ip} · ` : ''}active {new Date(s.lastUsedAt).toLocaleString()}
                </div>
              </div>
              {!s.current && (
                <button
                  onClick={() => revoke(s.id)}
                  disabled={busy}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                >
                  Sign out
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
