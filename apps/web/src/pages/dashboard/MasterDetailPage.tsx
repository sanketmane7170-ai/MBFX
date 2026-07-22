import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
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
import { SlaveFormDialog } from '@/components/slaves/SlaveFormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAsync } from '@/hooks/useAsync';
import { mastersApi, slavesApi, type Slave } from '@/lib/api';

const MAX_SLAVES = 10;

function sizingText(s: Slave): string {
  if (s.sizingMode === 'FIXED_LOT') return `${s.multiplier} lots (fixed)`;
  if (s.sizingMode === 'MULTIPLIER') return `× ${s.multiplier}`;
  return 'balance ratio';
}

export default function MasterDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(
    async () => {
      const [master, slaves] = await Promise.all([
        mastersApi.get(id),
        slavesApi.listForMaster(id),
      ]);
      return { master, slaves };
    },
    [id],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editSlave, setEditSlave] = useState<Slave | null>(null);
  const [toDelete, setToDelete] = useState<Slave | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [closeAllOpen, setCloseAllOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const master = data?.master;
  const slaves = data?.slaves ?? [];

  const toggleConnection = async () => {
    if (!master) return;
    try {
      if (master.status === 'CONNECTED') await mastersApi.disconnect(master.id);
      else await mastersApi.connect(master.id);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  };

  const toggleSlave = async (s: Slave) => {
    try {
      if (s.enabled) await slavesApi.pause(s.id);
      else await slavesApi.resume(s.id);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await slavesApi.remove(toDelete.id);
      toast('Slave removed', 'success');
      setToDelete(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const confirmCloseAll = async () => {
    if (!master) return;
    setClosing(true);
    try {
      const res = await mastersApi.closeAll(master.id);
      toast(`Close-all sent to ${res.closed} account(s)`, 'success');
      setCloseAllOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Close-all failed', 'error');
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error || !master)
    return <ErrorState message={error ?? 'Master not found'} onRetry={reload} />;

  return (
    <>
      <Link
        to="/dashboard/masters"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to accounts
      </Link>

      <PageHeader
        title={master.label}
        subtitle={`${master.platform} · ${master.login} · ${master.server}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={toggleConnection}>
              {master.status === 'CONNECTED' ? (
                <>
                  <PowerOff className="h-4 w-4" /> Disconnect
                </>
              ) : (
                <>
                  <Power className="h-4 w-4" /> Connect
                </>
              )}
            </Button>
            <Button variant="danger" onClick={() => setCloseAllOpen(true)}>
              <ShieldAlert className="h-4 w-4" /> Close All
            </Button>
            <Button onClick={() => setAddOpen(true)} disabled={slaves.length >= MAX_SLAVES}>
              <Plus className="h-4 w-4" /> Add Slave
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={master.status} />
        <Badge tone="gray">
          {slaves.length}/{MAX_SLAVES} slaves
        </Badge>
        <span className="text-xs text-gray-400">Strategy {master.copyfactoryStrategyId}</span>
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-gray-100 p-4 text-sm font-semibold text-gray-800">
          <Users className="h-4 w-4 text-brand-600" /> Slave Accounts
        </div>

        {slaves.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No slave accounts"
            description="Add a slave to start mirroring this master's trades."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add Slave
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
                {slaves.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.label}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.platform} · {s.login}
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
                      <Switch checked={s.enabled} onChange={() => toggleSlave(s)} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditSlave(s)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setToDelete(s)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
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

      <SlaveFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        masterId={master.id}
        onSaved={reload}
      />
      <SlaveFormDialog
        open={!!editSlave}
        onClose={() => setEditSlave(null)}
        masterId={master.id}
        slave={editSlave}
        onSaved={reload}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        danger
        title="Delete slave account?"
        confirmLabel="Delete"
        message={
          <>
            Remove <span className="font-medium">{toDelete?.label}</span> and unsubscribe it from
            this master.
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
        message="This sends an emergency close to the master and every slave under it. This cannot be undone."
      />
    </>
  );
}
