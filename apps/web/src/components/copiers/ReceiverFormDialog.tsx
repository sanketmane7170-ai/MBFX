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
  type SymbolFilterMode,
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
  filterMode: SymbolFilterMode;
  filterList: string;
  minVolume: string;
  maxVolume: string;
  windowEnabled: boolean;
  windowStart: string; // HH:MM UTC
  windowEnd: string; // HH:MM UTC
}

const defaults: FormState = {
  receiverAccountId: '',
  sizingMode: 'MULTIPLIER',
  multiplier: '1',
  copySl: true,
  copyTp: true,
  reverse: false,
  mapping: '',
  filterMode: 'NONE',
  filterList: '',
  minVolume: '',
  maxVolume: '',
  windowEnabled: false,
  windowStart: '00:00',
  windowEnd: '23:59',
};

const minToHHMM = (m: number | null): string => {
  if (m == null) return '';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
const hhmmToMin = (s: string): number | null => {
  const [h, m] = s.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
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
      const hasWindow = subscription.tradeWindowStart != null && subscription.tradeWindowEnd != null;
      setForm({
        receiverAccountId: subscription.receiverAccountId,
        sizingMode: subscription.sizingMode,
        multiplier: String(subscription.multiplier),
        copySl: subscription.copySl,
        copyTp: subscription.copyTp,
        reverse: subscription.reverse,
        mapping: formatMapping(subscription.symbolMapping),
        filterMode: subscription.symbolFilterMode,
        filterList: (subscription.symbolFilterList ?? []).join(', '),
        minVolume: subscription.minVolume != null ? String(subscription.minVolume) : '',
        maxVolume: subscription.maxVolume != null ? String(subscription.maxVolume) : '',
        windowEnabled: hasWindow,
        windowStart: hasWindow ? minToHHMM(subscription.tradeWindowStart) : '00:00',
        windowEnd: hasWindow ? minToHHMM(subscription.tradeWindowEnd) : '23:59',
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

    const minVolume = form.minVolume.trim() ? Number(form.minVolume) : undefined;
    const maxVolume = form.maxVolume.trim() ? Number(form.maxVolume) : undefined;
    if (minVolume != null && (!Number.isFinite(minVolume) || minVolume <= 0))
      return setError('Min volume must be a positive number.');
    if (maxVolume != null && (!Number.isFinite(maxVolume) || maxVolume <= 0))
      return setError('Max volume must be a positive number.');
    if (minVolume != null && maxVolume != null && minVolume > maxVolume)
      return setError('Min volume cannot exceed max volume.');

    let tradeWindowStart: number | undefined;
    let tradeWindowEnd: number | undefined;
    if (form.windowEnabled) {
      const s = hhmmToMin(form.windowStart);
      const e = hhmmToMin(form.windowEnd);
      if (s == null || e == null) return setError('Enter a valid trading window (HH:MM).');
      if (s === e) return setError('Trading window start and end cannot be the same.');
      tradeWindowStart = s;
      tradeWindowEnd = e;
    }

    const filterSymbols = form.filterList
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const rules = {
      sizingMode: form.sizingMode,
      multiplier,
      copySl: form.copySl,
      copyTp: form.copyTp,
      reverse: form.reverse,
      symbolMapping: parseMapping(form.mapping),
      symbolFilterMode: form.filterMode,
      symbolFilterList: form.filterMode === 'NONE' ? [] : filterSymbols,
      // On edit, an empty field clears the value (null); on add, omit it.
      minVolume: minVolume ?? (isEdit ? null : undefined),
      maxVolume: maxVolume ?? (isEdit ? null : undefined),
      ...(form.windowEnabled
        ? { tradeWindowStart, tradeWindowEnd }
        : isEdit
          ? { tradeWindowStart: null, tradeWindowEnd: null }
          : {}),
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

        {/* Trade filters */}
        <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
          <div className="mb-3 text-sm font-semibold text-gray-700">Trade Filters</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Symbol filter">
              <Select
                value={form.filterMode}
                onChange={(e) => set('filterMode', e.target.value as SymbolFilterMode)}
              >
                <option value="NONE">Copy all symbols</option>
                <option value="INCLUDE">Whitelist (only these)</option>
                <option value="EXCLUDE">Blacklist (all except)</option>
              </Select>
            </Field>
            <Field
              label="Symbols"
              hint={form.filterMode === 'NONE' ? 'Disabled while copying all' : 'Comma-separated, e.g. XAUUSD, EURUSD'}
            >
              <Input
                value={form.filterList}
                onChange={(e) => set('filterList', e.target.value)}
                placeholder="XAUUSD, EURUSD"
                disabled={form.filterMode === 'NONE'}
              />
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Min volume (lots)" hint="Skip smaller trades. Blank = no minimum.">
              <Input type="number" step="0.01" min="0" value={form.minVolume}
                onChange={(e) => set('minVolume', e.target.value)} placeholder="e.g. 0.01" />
            </Field>
            <Field label="Max volume (lots)" hint="Cap copied lot size. Blank = no cap.">
              <Input type="number" step="0.01" min="0" value={form.maxVolume}
                onChange={(e) => set('maxVolume', e.target.value)} placeholder="e.g. 1.00" />
            </Field>
          </div>
        </div>

        {/* Trading-hours window */}
        <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
          <ToggleRow
            label="Trading-hours window (UTC)"
            checked={form.windowEnabled}
            onChange={(v) => set('windowEnabled', v)}
          />
          {form.windowEnabled && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <Field label="Open (UTC)">
                  <Input type="time" value={form.windowStart} onChange={(e) => set('windowStart', e.target.value)} />
                </Field>
                <Field label="Close (UTC)">
                  <Input type="time" value={form.windowEnd} onChange={(e) => set('windowEnd', e.target.value)} />
                </Field>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                New copied trades open only inside this window. Overnight windows (e.g. 22:00→06:00) are supported.
                Existing trades are not force-closed.
              </p>
            </>
          )}
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
