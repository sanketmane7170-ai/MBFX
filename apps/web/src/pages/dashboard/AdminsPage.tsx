import { useState } from 'react';
import { KeyRound, Plus, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Field, Input, Switch } from '@/components/ui/form';
import { Dialog } from '@/components/ui/dialog';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  StatusBadge,
} from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { AddAdminDialog } from '@/components/admins/AddAdminDialog';
import { useAsync } from '@/hooks/useAsync';
import { adminsApi, type Admin } from '@/lib/api';

export default function AdminsPage() {
  const toast = useToast();
  const { data: admins, loading, error, reload } = useAsync(() => adminsApi.list(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [resetFor, setResetFor] = useState<Admin | null>(null);
  const [newPass, setNewPass] = useState('');
  const [resetting, setResetting] = useState(false);

  const list = admins ?? [];

  const toggleStatus = async (a: Admin, active: boolean) => {
    try {
      await adminsApi.setStatus(a.id, active ? 'ACTIVE' : 'DISABLED');
      toast(active ? 'Admin enabled' : 'Admin disabled', 'success');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    }
  };

  const doReset = async () => {
    if (!resetFor) return;
    if (newPass.length < 8) {
      toast('Password must be at least 8 characters', 'error');
      return;
    }
    setResetting(true);
    try {
      await adminsApi.resetPassword(resetFor.id, newPass);
      toast('Password reset', 'success');
      setResetFor(null);
      setNewPass('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Reset failed', 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Admins"
        subtitle="Create and manage admin users."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Create Admin
          </Button>
        }
      />

      <Card>
        <div className="flex items-center gap-2 border-b border-gray-100 p-4 text-sm font-semibold text-gray-800">
          <ShieldCheck className="h-4 w-4 text-brand-600" /> Admin Users
        </div>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-10 w-10" />}
            title="No admins yet"
            description="Create an admin to delegate account management."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Create Admin
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Enabled</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.email}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={a.status === 'ACTIVE'}
                        onChange={(v) => toggleStatus(a, v)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            setResetFor(a);
                            setNewPass('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Reset password
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

      <AddAdminDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />

      <Dialog
        open={!!resetFor}
        onClose={() => setResetFor(null)}
        title="Reset password"
        description={resetFor?.email}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetFor(null)} disabled={resetting}>
              Cancel
            </Button>
            <Button loading={resetting} onClick={doReset}>
              Reset
            </Button>
          </>
        }
      >
        <Field label="New password" hint="At least 8 characters. This signs the admin out everywhere.">
          <Input
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
      </Dialog>
    </>
  );
}
