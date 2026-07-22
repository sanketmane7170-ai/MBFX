import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { useAsync } from '@/hooks/useAsync';
import {
  accountsApi,
  copierApi,
  type CopierConfigDetail,
  type SizingMode,
  type Subscription,
  type SymbolMap,
} from '@/lib/api';

interface FormState {
  receiverAccountId: string;
  sizingMode: SizingMode;
  multiplier: string;
  copySl: boolean;
  copyTp: boolean;
  reverse: boolean;
  mapping: string;
}

const defaults: FormState = {
  receiverAccountId: '',
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

export function ReceiverFormDialog({
  open,
  onClose,
  config,
  subscription,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  config: CopierConfigDetail;
  subscription?: Subscription | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!subscription;
  const { data: accounts } = useAsync(() => accountsApi.list(), [open]);
  const [form, setForm] = useState<FormState>(defaults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (subscription) {
      setForm({
        receiverAccountId: subscription.receiverAccountId,
        sizingMode: subscription.sizingMode,
        multiplier: String(subscription.multiplier),
        copySl: subscription.copySl,
        copyTp: subscription.copyTp,
        reverse: subscription.reverse,
        mapping: formatMapping(subscription.symbolMapping),
      });
    } else {
      setForm(defaults);
    }
  }, [open, subscription]);

  const usedIds = new Set(config.subscriptions.map((s) => s.receiverAccountId));
  const available = (accounts ?? []).filter(
    (a) => a.id !== config.sourceAccountId && !usedIds.has(a.id),
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    const multiplier = Number(form.multiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0)
      return setError('Multiplier must be a positive number.');

    const rules = {
      sizingMode: form.sizingMode,
      multiplier,
      copySl: form.copySl,
      copyTp: form.copyTp,
      reverse: form.reverse,
      symbolMapping: parseMapping(form.mapping),
    };

    setLoading(true);
    try {
      if (isEdit && subscription) {
        await copierApi.updateReceiver(subscription.id, rules);
        toast('Receiver updated', 'success');
      } else {
        if (!form.receiverAccountId) throw new Error('Select a receiver account.');
        await copierApi.addReceiver(config.id, form.receiverAccountId, rules);
        toast('Receiver added', 'success');
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save receiver');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Edit Receiver' : 'Add Receiver'}
      description={isEdit ? 'Update copy rules for this receiver.' : 'Add an account that copies this source.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={submit}>
            {isEdit ? 'Save Changes' : 'Add Receiver'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!isEdit && (
          <Field label="Receiver account">
            {available.length === 0 ? (
              <p className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm text-amber-700">
                No available accounts to add as a receiver.
              </p>
            ) : (
              <Select
                value={form.receiverAccountId}
                onChange={(e) => set('receiverAccountId', e.target.value)}
              >
                <option value="">Select an account…</option>
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} · {a.platform} · {a.login}
                  </option>
                ))}
              </Select>
            )}
          </Field>
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
