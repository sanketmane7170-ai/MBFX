import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import {
  slavesApi,
  type Platform,
  type SizingMode,
  type Slave,
  type SymbolMap,
} from '@/lib/api';

interface FormState {
  label: string;
  login: string;
  password: string;
  server: string;
  platform: Platform;
  sizingMode: SizingMode;
  multiplier: string;
  copySl: boolean;
  copyTp: boolean;
  reverse: boolean;
  mapping: string;
}

const defaults: FormState = {
  label: '',
  login: '',
  password: '',
  server: '',
  platform: 'MT5',
  sizingMode: 'MULTIPLIER',
  multiplier: '1',
  copySl: true,
  copyTp: true,
  reverse: false,
  mapping: '',
};

function formatMapping(mapping: SymbolMap[] | null): string {
  return (mapping ?? []).map((m) => `${m.from}=${m.to}`).join(', ');
}
function parseMapping(text: string): SymbolMap[] {
  return text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [from, to] = p.split('=').map((s) => s.trim());
      return from && to ? { from, to } : null;
    })
    .filter((m): m is SymbolMap => m !== null);
}

const multiplierLabel: Record<SizingMode, string> = {
  FIXED_LOT: 'Fixed lot size',
  MULTIPLIER: 'Lot multiplier (×)',
  BALANCE_RATIO: 'Multiplier (ignored for balance ratio)',
};

export function SlaveFormDialog({
  open,
  onClose,
  masterId,
  slave,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  masterId: string;
  slave?: Slave | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!slave;
  const [form, setForm] = useState<FormState>(defaults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (slave) {
      setForm({
        ...defaults,
        label: slave.label,
        platform: slave.platform,
        sizingMode: slave.sizingMode,
        multiplier: String(slave.multiplier),
        copySl: slave.copySl,
        copyTp: slave.copyTp,
        reverse: slave.reverse,
        mapping: formatMapping(slave.symbolMapping),
      });
    } else {
      setForm(defaults);
    }
  }, [open, slave]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    const multiplier = Number(form.multiplier);
    if (!form.label) return setError('Label is required.');
    if (!Number.isFinite(multiplier) || multiplier <= 0)
      return setError('Multiplier must be a positive number.');

    const rules = {
      label: form.label,
      sizingMode: form.sizingMode,
      multiplier,
      copySl: form.copySl,
      copyTp: form.copyTp,
      reverse: form.reverse,
      symbolMapping: parseMapping(form.mapping),
    };

    setLoading(true);
    try {
      if (isEdit && slave) {
        await slavesApi.update(slave.id, rules);
        toast('Slave updated', 'success');
      } else {
        if (!form.login || !form.password || !form.server)
          throw new Error('Login, server and password are required.');
        await slavesApi.create(masterId, {
          login: form.login,
          password: form.password,
          server: form.server,
          platform: form.platform,
          ...rules,
        });
        toast('Slave account added', 'success');
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save slave');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Edit Slave' : 'Add Slave Account'}
      description={
        isEdit
          ? 'Update copy rules for this slave.'
          : 'Connect a slave and configure how it copies the master.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={submit}>
            {isEdit ? 'Save Changes' : 'Add Slave'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Label">
          <Input value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Client 1" />
        </Field>

        {!isEdit && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="MT Login">
                <Input value={form.login} onChange={(e) => set('login', e.target.value)} placeholder="e.g. 6001234" />
              </Field>
              <Field label="Platform">
                <Select value={form.platform} onChange={(e) => set('platform', e.target.value as Platform)}>
                  <option value="MT5">MT5</option>
                  <option value="MT4">MT4</option>
                </Select>
              </Field>
            </div>
            <Field label="Broker Server">
              <Input value={form.server} onChange={(e) => set('server', e.target.value)} placeholder="e.g. Pepperstone-Live" />
            </Field>
            <Field label="Trade Password" hint="Encrypted at rest — never stored in plaintext.">
              <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Account password" />
            </Field>
          </>
        )}

        <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
          <div className="mb-3 text-sm font-semibold text-gray-700">Copy Rules</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sizing mode">
              <Select value={form.sizingMode} onChange={(e) => set('sizingMode', e.target.value as SizingMode)}>
                <option value="MULTIPLIER">Multiplier</option>
                <option value="FIXED_LOT">Fixed lot</option>
                <option value="BALANCE_RATIO">Balance ratio</option>
              </Select>
            </Field>
            <Field label={multiplierLabel[form.sizingMode]}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.multiplier}
                onChange={(e) => set('multiplier', e.target.value)}
                disabled={form.sizingMode === 'BALANCE_RATIO'}
              />
            </Field>
          </div>

          <div className="mt-4 space-y-3">
            <ToggleRow label="Copy Stop Loss" checked={form.copySl} onChange={(v) => set('copySl', v)} />
            <ToggleRow label="Copy Take Profit" checked={form.copyTp} onChange={(v) => set('copyTp', v)} />
            <ToggleRow label="Reverse copy (mirror opposite direction)" checked={form.reverse} onChange={(v) => set('reverse', v)} />
          </div>

          <div className="mt-4">
            <Field label="Symbol mapping" hint="Comma-separated, e.g. EURUSD=EURUSD.r, GBPUSD=GBPUSD.r">
              <Input value={form.mapping} onChange={(e) => set('mapping', e.target.value)} placeholder="EURUSD=EURUSD.r" />
            </Field>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}
