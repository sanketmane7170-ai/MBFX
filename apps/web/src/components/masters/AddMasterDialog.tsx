import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { mastersApi, type Platform } from '@/lib/api';

const empty = { label: '', login: '', password: '', server: '', platform: 'MT5' as Platform };

export function AddMasterDialog({
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

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!form.label || !form.login || !form.password || !form.server) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    try {
      await mastersApi.create(form);
      toast('Master account added', 'success');
      setForm(empty);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add master');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add Master Account"
      description="Connect a MetaTrader account to copy trades from."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={submit}>
            Add Master
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Label">
          <Input
            placeholder="e.g. Prop Master A"
            value={form.label}
            onChange={(e) => set('label')(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="MT Login">
            <Input
              placeholder="e.g. 5001234"
              value={form.login}
              onChange={(e) => set('login')(e.target.value)}
            />
          </Field>
          <Field label="Platform">
            <Select value={form.platform} onChange={(e) => set('platform')(e.target.value)}>
              <option value="MT5">MT5</option>
              <option value="MT4">MT4</option>
            </Select>
          </Field>
        </div>
        <Field label="Broker Server">
          <Input
            placeholder="e.g. ICMarkets-Live"
            value={form.server}
            onChange={(e) => set('server')(e.target.value)}
          />
        </Field>
        <Field label="Trade Password" hint="Encrypted at rest — never stored in plaintext.">
          <Input
            type="password"
            placeholder="Account password"
            value={form.password}
            onChange={(e) => set('password')(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
