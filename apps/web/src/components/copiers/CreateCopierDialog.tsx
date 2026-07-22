import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { useAsync } from '@/hooks/useAsync';
import { accountsApi, copierApi } from '@/lib/api';

export function CreateCopierDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const { data: accounts } = useAsync(() => accountsApi.list(), [open]);
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A source can only drive one copier, so exclude accounts already used as a source.
  const available = (accounts ?? []).filter((a) => !a.sourceForConfig);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError('Enter a copier name.');
    if (!sourceId) return setError('Select a source account.');
    setLoading(true);
    try {
      await copierApi.create(name.trim(), sourceId);
      toast('Copier created', 'success');
      setName('');
      setSourceId('');
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create copier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Copier"
      description="Pick the source account whose trades will be copied to receivers."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={submit} disabled={available.length === 0}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Copier name">
          <Input placeholder="e.g. MBFX Main Copier" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Source account (master)" hint="The account whose trades are copied.">
          {available.length === 0 ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm text-amber-700">
              No available accounts. <Link to="/dashboard/accounts" className="font-medium underline">Add an account</Link> first
              (accounts already used as a source can't be reused).
            </p>
          ) : (
            <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Select an account…</option>
              {available.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {a.platform} · {a.login}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
