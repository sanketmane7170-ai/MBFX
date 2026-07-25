import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/components/ui/toast';
import { useBrokerServers } from '@/hooks/useBrokerServers';
import { accountsApi, type Platform } from '@/lib/api';

const empty = { label: '', login: '', password: '', server: '', platform: 'MT5' as Platform };

export function AddAccountDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const servers = useBrokerServers(open);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!form.label || !form.login || !form.password || !form.server) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    try {
      await accountsApi.create(form);
      toast('Account connected', 'success');
      setForm(empty);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add Account"
      description="Connect a MetaTrader account. Assign it as a source or receiver in a copier afterwards."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={submit}>
            Add Account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Account name">
          <Input placeholder="e.g. Sanket Master" value={form.label} onChange={(e) => set('label')(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="MT Login">
            <Input placeholder="e.g. 5001234" value={form.login} onChange={(e) => set('login')(e.target.value)} />
          </Field>
          <Field label="Platform">
            <Select value={form.platform} onChange={(e) => set('platform')(e.target.value)}>
              <option value="MT5">MT5</option>
              <option value="MT4">MT4</option>
            </Select>
          </Field>
        </div>
        <Field
          label="Broker Server"
          hint="Start typing to search. Not listed? Type the exact name from your MT terminal."
        >
          <Combobox
            value={form.server}
            onChange={set('server')}
            options={servers.options}
            loading={servers.loading}
            placeholder="e.g. ICMarkets-Live02"
          />
        </Field>
        <Field
          label="Password"
          hint="Receivers need the trade (master) password; sources can use investor. Encrypted at rest."
        >
          <Input type="password" placeholder="Account password" value={form.password} onChange={(e) => set('password')(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
