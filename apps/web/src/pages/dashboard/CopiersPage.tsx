import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Eye, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/form';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  StatCard,
} from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { CreateCopierDialog } from '@/components/copiers/CreateCopierDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAsync } from '@/hooks/useAsync';
import { copierApi, type CopierConfig } from '@/lib/api';

const MAX_COPIERS = 2;

export default function CopiersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: copiers, loading, error, reload } = useAsync(() => copierApi.list(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CopierConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  const list = copiers ?? [];
  const enabled = list.filter((c) => c.enabled).length;
  const receivers = list.reduce((n, c) => n + c._count.subscriptions, 0);

  const toggleEnabled = async (c: CopierConfig) => {
    try {
      await copierApi.update(c.id, { enabled: !c.enabled });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await copierApi.remove(toDelete.id);
      toast('Copier deleted', 'success');
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
        title="Copier"
        subtitle="Each copier mirrors one source account's trades to its receivers."
        actions={
          <Button onClick={() => setAddOpen(true)} disabled={list.length >= MAX_COPIERS}>
            <Plus className="h-4 w-4" /> Create Copier
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Copiers" value={list.length} sub={`of ${MAX_COPIERS} allowed`} />
        <StatCard label="Active" value={enabled} sub="copiers running" />
        <StatCard label="Receivers" value={receivers} sub="across all copiers" />
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-gray-100 p-4 text-sm font-semibold text-gray-800">
          <Copy className="h-4 w-4 text-brand-600" /> Copiers
        </div>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Copy className="h-10 w-10" />}
            title="No copiers yet"
            description="Create a copier and pick a source account to start copying trades."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Create Copier
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Receivers</th>
                  <th className="px-4 py-3">Enabled</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/dashboard/copiers/${c.id}`)}
                        className="font-medium text-gray-900 hover:text-brand-700"
                      >
                        {c.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.sourceAccount.label}
                      <span className="ml-1 text-gray-400">· {c.sourceAccount.login}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="gray">{c._count.subscriptions}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked={c.enabled} onChange={() => toggleEnabled(c)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/dashboard/copiers/${c.id}`)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setToDelete(c)}
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

      <CreateCopierDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        danger
        title="Delete copier?"
        confirmLabel="Delete"
        message={
          <>
            Delete <span className="font-medium">{toDelete?.name}</span> and all its receiver
            subscriptions? The accounts themselves stay. This cannot be undone.
          </>
        }
      />
    </>
  );
}
