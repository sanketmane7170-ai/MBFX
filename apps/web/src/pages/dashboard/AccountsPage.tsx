import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Server, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Switch } from '@/components/ui/form';
import { Combobox } from '@/components/ui/combobox';
import { useBrokerServers } from '@/hooks/useBrokerServers';
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
import { AddAccountDialog } from '@/components/accounts/AddAccountDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAsync } from '@/hooks/useAsync';
import { accountsApi, type Account } from '@/lib/api';

function RoleBadges({ a }: { a: Account }) {
  const isSource = !!a.sourceForConfig;
  const isReceiver = a._count.receiverSubscriptions > 0;
  if (!isSource && !isReceiver) return <span className="text-xs text-gray-400">Unused</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {isSource && <Badge tone="blue">Source</Badge>}
      {isReceiver && <Badge tone="gray">Receiver</Badge>}
    </div>
  );
}

export default function AccountsPage() {
  const toast = useToast();
  const { data: accounts, loading, error, reload } = useAsync(() => accountsApi.list(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editFor, setEditFor] = useState<Account | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editServer, setEditServer] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const serverOpts = useBrokerServers(!!editFor);

  useEffect(() => {
    if (editFor) {
      setEditLabel(editFor.label);
      setEditServer(editFor.server);
      setEditPassword('');
    }
  }, [editFor]);

  const saveEdit = async () => {
    if (!editFor) return;
    if (!editLabel.trim() || !editServer.trim()) {
      toast('Name and server are required.', 'error');
      return;
    }
    const body: { label?: string; server?: string; password?: string } = {};
    if (editLabel.trim() !== editFor.label) body.label = editLabel.trim();
    if (editServer.trim() !== editFor.server) body.server = editServer.trim();
    if (editPassword.trim()) body.password = editPassword.trim();
    if (Object.keys(body).length === 0) {
      setEditFor(null);
      return;
    }
    setSaving(true);
    try {
      await accountsApi.update(editFor.id, body);
      toast('Account updated', 'success');
      setEditFor(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const list = accounts ?? [];
  const connected = list.filter((a) => a.status === 'CONNECTED').length;
  const sources = list.filter((a) => a.sourceForConfig).length;
  const receivers = list.filter((a) => a._count.receiverSubscriptions > 0).length;
  const filtered = list.filter(
    (a) =>
      a.label.toLowerCase().includes(q.toLowerCase()) ||
      a.login.includes(q) ||
      a.server.toLowerCase().includes(q.toLowerCase()),
  );

  const toggleConnection = async (a: Account) => {
    try {
      if (a.status === 'CONNECTED') await accountsApi.disconnect(a.id);
      else await accountsApi.connect(a.id);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await accountsApi.remove(toDelete.id);
      toast('Account removed', 'success');
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
        subtitle="Connect your MetaTrader accounts. Wire them into copiers next."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Account
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Accounts" value={list.length} sub="connected via MetaApi" />
        <StatCard label="Connected" value={connected} sub="live connections" />
        <StatCard label="Sources" value={sources} sub="acting as masters" />
        <StatCard label="Receivers" value={receivers} sub="copying a source" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Server className="h-4 w-4 text-brand-600" /> Accounts
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input className="pl-9" placeholder="Search accounts" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Server className="h-10 w-10" />}
            title="No accounts yet"
            description="Add your first MetaTrader account to get started."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add Account
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
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Connection</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/dashboard/accounts/${a.id}`} className="text-gray-900 hover:text-brand-700 hover:underline">
                        {a.label}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{a.login}</td>
                    <td className="px-4 py-3">
                      <Badge tone="blue">{a.platform}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadges a={a} />
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked={a.status === 'CONNECTED'} onChange={() => toggleConnection(a)} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditFor(a)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setToDelete(a)}
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

      <AddAccountDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />

      <Dialog
        open={!!editFor}
        onClose={() => setEditFor(null)}
        title="Edit account"
        description={editFor ? `${editFor.login} · ${editFor.platform}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditFor(null)} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} onClick={saveEdit}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Account label" />
          </Field>
          <Field
            label="Broker server"
            hint="Start typing to search. Not listed? Type the exact name from your MT terminal."
          >
            <Combobox
              value={editServer}
              onChange={setEditServer}
              options={serverOpts.options}
              loading={serverOpts.loading}
              placeholder="e.g. ICMarkets-Live02"
            />
          </Field>
          <Field
            label="Broker password"
            hint="Leave blank to keep the current password. Stored encrypted."
          >
            <Input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Enter to rotate the password"
              autoComplete="new-password"
            />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        danger
        title="Delete account?"
        confirmLabel="Delete"
        message={
          <>
            Remove <span className="font-medium">{toDelete?.label}</span>? Any copier using it (as
            source or receiver) will be updated. This cannot be undone.
          </>
        }
      />
    </>
  );
}
