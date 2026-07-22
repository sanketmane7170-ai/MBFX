import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Plus, Search, Server, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input, Switch } from '@/components/ui/form';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  StatCard,
  StatusBadge,
} from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { AddMasterDialog } from '@/components/masters/AddMasterDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAsync } from '@/hooks/useAsync';
import { mastersApi, type Master } from '@/lib/api';

const MAX_MASTERS = 2;

export default function MastersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: masters, loading, error, reload } = useAsync(() => mastersApi.list(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Master | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [q, setQ] = useState('');

  const list = masters ?? [];
  const connected = list.filter((m) => m.status === 'CONNECTED').length;
  const totalSlaves = list.reduce((n, m) => n + m._count.slaves, 0);
  const pct = Math.round((list.length / MAX_MASTERS) * 100);
  const filtered = list.filter(
    (m) =>
      m.label.toLowerCase().includes(q.toLowerCase()) ||
      m.login.includes(q) ||
      m.server.toLowerCase().includes(q.toLowerCase()),
  );

  const toggleConnection = async (m: Master) => {
    try {
      if (m.status === 'CONNECTED') await mastersApi.disconnect(m.id);
      else await mastersApi.connect(m.id);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await mastersApi.remove(toDelete.id);
      toast('Master account removed', 'success');
      setToDelete(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Account Configuration"
        subtitle="Manage master accounts and the slaves that copy them."
        actions={
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-500">
                {list.length}/{MAX_MASTERS}
              </span>
            </div>
            <Button onClick={() => setAddOpen(true)} disabled={list.length >= MAX_MASTERS}>
              <Plus className="h-4 w-4" /> Add Master
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Master Accounts" value={list.length} sub={`of ${MAX_MASTERS} allowed`} />
        <StatCard label="Connected" value={connected} sub="live master connections" />
        <StatCard label="Slave Accounts" value={totalSlaves} sub="across all masters" />
        <StatCard label="Capacity" value={`${pct}%`} sub="master slots used" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Server className="h-4 w-4 text-brand-600" /> Accounts
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search accounts"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Server className="h-10 w-10" />}
            title="No master accounts yet"
            description="Add your first master account to start copying trades."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add Master
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
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Slaves</th>
                  <th className="px-4 py-3">Connection</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/dashboard/masters/${m.id}`)}
                        className="font-medium text-gray-900 hover:text-brand-700"
                      >
                        {m.label}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{m.login}</td>
                    <td className="px-4 py-3">
                      <Badge tone="blue">{m.platform}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m._count.slaves}</td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={m.status === 'CONNECTED'}
                        onChange={() => toggleConnection(m)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/dashboard/masters/${m.id}`)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setToDelete(m)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                      No accounts match “{q}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddMasterDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        danger
        title="Delete master account?"
        confirmLabel="Delete"
        message={
          <>
            This will remove <span className="font-medium">{toDelete?.label}</span> and all of its
            slave subscriptions. This cannot be undone.
          </>
        }
      />
    </>
  );
}
