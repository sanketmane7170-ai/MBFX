import { useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, Loader2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Badge, Card, LoadingBlock } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useAsync } from '@/hooks/useAsync';
import { settingsApi } from '@/lib/api';

const REGIONS = ['new-york', 'london', 'singapore'];

export default function SettingsPage() {
  const toast = useToast();
  const { data: status, loading, reload } = useAsync(() => settingsApi.status(), []);
  const [token, setToken] = useState('');
  const [region, setRegion] = useState('new-york');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await settingsApi.test(token || undefined, region);
      setTestResult(r);
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    if (token.trim().length < 20) {
      toast('Enter a valid MetaApi token (paste the full token).', 'error');
      return;
    }
    setSaving(true);
    try {
      await settingsApi.set(token.trim(), region);
      toast('MetaApi token saved — the platform will now use live MetaApi.', 'success');
      setToken('');
      setTestResult(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    setClearing(true);
    try {
      await settingsApi.clear();
      toast('MetaApi token removed — back to mock mode.', 'success');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Remove failed', 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Connect your MetaApi account to enable live trading." />

      <div className="max-w-2xl space-y-6">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <KeyRound className="h-4 w-4 text-brand-600" /> MetaApi Connection
            </div>
            {!loading &&
              (status?.configured ? (
                <Badge tone="green">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
                </Badge>
              ) : (
                <Badge tone="amber">Not configured</Badge>
              ))}
          </div>

          {loading ? (
            <LoadingBlock />
          ) : (
            <>
              {status?.configured ? (
                <div className="mb-5 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm">
                  <div className="font-medium text-emerald-800">
                    Token configured{status.source === 'env' ? ' (from environment)' : ''}
                  </div>
                  <div className="mt-1 text-emerald-700">
                    <span className="font-mono">{status.tokenPreview}</span> · region{' '}
                    <span className="font-medium">{status.region}</span>
                    {status.updatedAt && (
                      <> · updated {new Date(status.updatedAt).toLocaleString()}</>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mb-5 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
                  No MetaApi token yet. Paste your token below to connect real MT4/MT5 accounts.
                  Until then the platform runs in mock mode.
                </p>
              )}

              <div className="space-y-4">
                <Field label="Region" hint="The MetaApi region closest to your accounts.">
                  <Select value={region} onChange={(e) => setRegion(e.target.value)}>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="MetaApi Token"
                  hint="One token manages all your accounts. Stored encrypted — never shown again."
                >
                  <Input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={status?.configured ? 'Paste a new token to replace' : 'Paste your MetaApi token'}
                  />
                </Field>

                {testResult && (
                  <div
                    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                      testResult.ok
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {testResult.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button variant="secondary" onClick={onTest} disabled={testing}>
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Test connection
                  </Button>
                  <Button onClick={onSave} loading={saving}>
                    Save token
                  </Button>
                  {status?.configured && status.source === 'settings' && (
                    <Button variant="danger" onClick={onClear} loading={clearing}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-800">How it works</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>• You create <span className="font-medium">one</span> MetaApi token — it manages every account (masters + slaves), across any number of brokers.</li>
            <li>• Get it from your MetaApi dashboard, paste it here once.</li>
            <li>• After saving, adding accounts provisions them live via MetaApi + CopyFactory.</li>
          </ul>
          <a
            href="https://app.metaapi.cloud"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Open MetaApi dashboard <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Card>
      </div>
    </>
  );
}
