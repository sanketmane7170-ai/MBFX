import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  Send,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch } from '@/components/ui/form';
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
      <PageHeader title="Settings" subtitle="Connect MetaApi for live trading and configure email delivery." />

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

        <SmtpCard />

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

function SmtpCard() {
  const toast = useToast();
  const { data: status, loading, reload } = useAsync(() => settingsApi.smtpStatus(), []);

  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [fromName, setFromName] = useState('Money Bank FX');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [testTo, setTestTo] = useState('');

  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Prefill from stored config once loaded (password is never returned).
  useEffect(() => {
    if (!status) return;
    if (status.host) setHost(status.host);
    if (status.port) setPort(String(status.port));
    setSecure(status.secure);
    if (status.user) setUser(status.user);
    if (status.fromName) setFromName(status.fromName);
    if (status.alertEmail) setAlertEmail(status.alertEmail);
    setAlertsEnabled(status.alertsEnabled);
    if (status.user && !testTo) setTestTo(status.user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Connection-only fields — what the /smtp/test endpoint accepts.
  const connPayload = () => ({
    host: host.trim(),
    port: Number(port) || 587,
    secure,
    user: user.trim(),
    password: password.trim() || undefined,
    fromName: fromName.trim() || undefined,
  });

  // Full config for save — adds alert settings.
  const savePayload = () => ({
    ...connPayload(),
    alertEmail: alertEmail.trim() || undefined,
    alertsEnabled,
  });

  const onTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await settingsApi.smtpTest(connPayload());
      setResult(r);
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const onSendTest = async () => {
    if (!testTo.trim()) {
      toast('Enter an address to send the test email to.', 'error');
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const r = await settingsApi.smtpTest({ ...connPayload(), to: testTo.trim() });
      setResult(r);
      if (r.ok) toast('Test email sent.', 'success');
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Send failed' });
    } finally {
      setSending(false);
    }
  };

  const onSave = async () => {
    if (!host.trim() || !user.trim()) {
      toast('Enter at least the SMTP host and sender email.', 'error');
      return;
    }
    if (!status?.configured && !password.trim()) {
      toast('Enter the SMTP / app password.', 'error');
      return;
    }
    setSaving(true);
    try {
      await settingsApi.smtpSet(savePayload());
      toast('Email settings saved.', 'success');
      setPassword('');
      setResult(null);
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
      await settingsApi.smtpClear();
      toast('Email settings removed.', 'success');
      setPassword('');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Remove failed', 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Mail className="h-4 w-4 text-brand-600" /> Email / SMTP
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
                Email configured{status.source === 'env' ? ' (from environment)' : ''}
              </div>
              <div className="mt-1 text-emerald-700">
                <span className="font-mono">
                  {status.host}:{status.port}
                </span>{' '}
                · {status.user}
                {status.updatedAt && <> · updated {new Date(status.updatedAt).toLocaleString()}</>}
              </div>
            </div>
          ) : (
            <p className="mb-5 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
              No email configured. Add your SMTP details to send admin invites, password-reset
              notices and copy alerts. For Gmail, use an app password (not your normal password).
            </p>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="SMTP host" hint="e.g. smtp.gmail.com">
                  <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.gmail.com" />
                </Field>
              </div>
              <Field label="Port" hint="587 or 465">
                <Input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="587"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-800">SSL/TLS (secure)</div>
                <div className="text-xs text-gray-400">On for port 465, off for 587 (STARTTLS).</div>
              </div>
              <Switch checked={secure} onChange={setSecure} />
            </div>

            <Field label="Sender email (SMTP user)" hint="The account that authenticates and sends mail.">
              <Input
                type="email"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="you@gmail.com"
              />
            </Field>

            <Field
              label="App password"
              hint={
                status?.configured
                  ? 'Stored encrypted. Leave blank to keep the current password.'
                  : 'Gmail: create an app password under Google Account → Security. Stored encrypted.'
              }
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={status?.configured ? 'Leave blank to keep current' : 'App password'}
              />
            </Field>

            <Field label="From name" hint="Display name shown on outgoing emails.">
              <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Money Bank FX" />
            </Field>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-800">Copy alerts</div>
                <div className="text-xs text-gray-400">Email when a copy fails (errors only).</div>
              </div>
              <Switch checked={alertsEnabled} onChange={setAlertsEnabled} />
            </div>

            <Field
              label="Alert recipient"
              hint="Where copy alerts go. Leave blank to notify all super-admins."
            >
              <Input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="alerts@yourdomain.com"
              />
            </Field>

            <Field label="Send test email to" hint="Verifies the whole path by delivering a real message.">
              <Input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            {result && (
              <div
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                  result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{result.message}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="secondary" onClick={onTest} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Test connection
              </Button>
              <Button variant="secondary" onClick={onSendTest} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send test email
              </Button>
              <Button onClick={onSave} loading={saving}>
                Save settings
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
  );
}
