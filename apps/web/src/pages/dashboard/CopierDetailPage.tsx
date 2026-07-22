import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, ShieldAlert, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/form';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  StatusBadge,
} from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { ReceiverFormDialog } from '@/components/copiers/ReceiverFormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAsync } from '@/hooks/useAsync';
import { copierApi, type Subscription } from '@/lib/api';

const MAX_RECEIVERS = 10;

function sizingText(s: Subscription): string {
  if (s.sizingMode === 'FIXED_LOT') return `${s.multiplier} lots (fixed)`;
  if (s.sizingMode === 'MULTIPLIER') return `× ${s.multiplier}`;
  return 'balance ratio';
}

export default function CopierDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data: config, loading, error, reload } = useAsync(() => copierApi.get(id), [id]);

  const [addOpen, setAddOpen] = useState(false);
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [toDelete, setToDelete] = useState<Subscription | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [closeAllOpen, setCloseAllOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const receivers = config?.subscriptions ?? [];

  const toggleEnabled = async () => {
    if (!config) return;
    try {
      await copierApi.update(config.id, { enabled: !config.enabled });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  };

  const toggleReceiver = async (s: Subscription) => {
    try {
      if (s.enabled) await copierApi.pauseReceiver(s.id);
      else await copierApi.resumeReceiver(s.id);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await copierApi.removeReceiver(toDelete.id);
      toast('Receiver removed', 'success');
      setToDelete(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const confirmCloseAll = async () => {
    if (!config) return;
    setClosing(true);
    try {
      const res = await copierApi.closeAll(config.id);
      toast(`Close-all sent to ${res.closed} account(s)`, 'success');
      setCloseAllOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Close-all failed', 'error');
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error || !config) return <ErrorState message={error ?? 'Copier not found'} onRetry={reload} />;

  return (
    <>
      <Link
        to="/dashboard/copiers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to copiers
      </Link>

      <PageHeader
        title={config.name}
        subtitle={`Source: ${config.sourceAccount.label} · ${config.sourceAccount.platform} · ${config.sourceAccount.login}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Switch checked={config.enabled} onChange={toggleEnabled} />
              {config.enabled ? 'Enabled' : 'Disabled'}
            </div>
            <Button variant="danger" onClick={() => setCloseAllOpen(true)}>
              <ShieldAlert className="h-4 w-4" /> Close All
            </Button>
            <Button onClick={() => setAddOpen(true)} disabled={receivers.length >= MAX_RECEIVERS}>
              <Plus className="h-4 w-4" /> Add Receiver
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={config.sourceAccount.status} />
        <Badge tone="gray">
          {receivers.length}/{MAX_RECEIVERS} receivers
        </Badge>
        <span className="text-xs text-gray-400">Strategy {config.copyfactoryStrategyId}</span>
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-gray-100 p-4 text-sm font-semibold text-gray-800">
          <Users className="h-4 w-4 text-brand-600" /> Receivers
        </div>

        {receivers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No receivers"
            description="Add a receiver account to start mirroring this source's trades."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add Receiver
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Sizing</th>
                  <th className="px-4 py-3">Rules</th>
                  <th className="px-4 py-3">Enabled</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {receivers.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.receiverAccount.label}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.receiverAccount.platform} · {s.receiverAccount.login}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{sizingText(s)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.copySl && <Badge tone="gray">SL</Badge>}
                        {s.copyTp && <Badge tone="gray">TP</Badge>}
                        {s.reverse && <Badge tone="amber">Reverse</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked={s.enabled} onChange={() => toggleReceiver(s)} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditSub(s)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setToDelete(s)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReceiverFormDialog open={addOpen} onClose={() => setAddOpen(false)} config={config} onSaved={reload} />
      <ReceiverFormDialog
        open={!!editSub}
        onClose={() => setEditSub(null)}
        config={config}
        subscription={editSub}
        onSaved={reload}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        danger
        title="Remove receiver?"
        confirmLabel="Remove"
        message={
          <>
            Stop <span className="font-medium">{toDelete?.receiverAccount.label}</span> from copying
            this source.
          </>
        }
      />
      <ConfirmDialog
        open={closeAllOpen}
        onClose={() => setCloseAllOpen(false)}
        onConfirm={confirmCloseAll}
        loading={closing}
        danger
        title="Close all open positions?"
        confirmLabel="Close All"
        message="This sends an emergency close to the source and every receiver in this copier. This cannot be undone."
      />
    </>
  );
}
