import { useEffect, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Card, EmptyState, ErrorState, LoadingBlock, StatCard } from '@/components/ui/misc';
import {
  accountsApi,
  reportsApi,
  type Account,
  type AccountReport,
  type OverviewReport,
  type ReportBucket,
  type ReportPeriod,
  type ReportSummary,
} from '@/lib/api';

/** Money arrives as a decimal string; format for display without re-introducing float drift upstream. */
const money = (v: string | null | undefined) => {
  if (v == null) return '—';
  const n = Number(v);
  return `${n >= 0 ? '' : '-'}$${Math.abs(n).toFixed(2)}`;
};
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const signClass = (v: string | null | undefined) =>
  v == null ? 'text-gray-400' : Number(v) >= 0 ? 'text-emerald-600' : 'text-red-600';

const isAccountReport = (r: AccountReport | OverviewReport): r is AccountReport =>
  'account' in r;

export default function ReportsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [bucket, setBucket] = useState<ReportBucket>('day');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [report, setReport] = useState<AccountReport | OverviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountsApi
      .list()
      .then(setAccounts)
      .catch(() => undefined);
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = {
        bucket,
        from: from ? new Date(from).toISOString() : undefined,
        // Include the whole end day, not just its midnight boundary.
        to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
      };
      setReport(accountId ? await reportsApi.account(accountId, q) : await reportsApi.overview(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = () => {
    if (!report) return;
    const header = ['period', 'start', 'trades', 'wins', 'losses', 'winRate', 'pnl', 'cumulativePnl'];
    const rows = report.periods.map((p: ReportPeriod) => [
      p.period,
      p.start,
      p.trades,
      p.wins,
      p.losses,
      p.winRate.toFixed(4),
      p.pnl,
      p.cumulativePnl,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    const who = report && isAccountReport(report) ? report.account.label.replace(/\s+/g, '-') : 'portfolio';
    a.download = `report-${who}-${bucket}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s: ReportSummary | undefined = report?.summary;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Realized P/L, win rate, drawdown and per-period performance."
        actions={
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={!report || report.periods.length === 0}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">All accounts (portfolio)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Period">
            <Select value={bucket} onChange={(e) => setBucket(e.target.value as ReportBucket)}>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button onClick={load} className="w-full">
              Apply
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !report || !s ? null : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Realized P/L"
              value={<span className={signClass(s.realizedPnl)}>{money(s.realizedPnl)}</span>}
              sub={`${s.trades} closed trade${s.trades === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Win Rate"
              value={pct(s.winRate)}
              sub={`${s.wins}W / ${s.losses}L${s.breakEven ? ` / ${s.breakEven}BE` : ''}`}
            />
            <StatCard
              label="Max Drawdown"
              value={<span className="text-red-600">{money(s.maxDrawdown)}</span>}
              sub="peak-to-trough, realized"
            />
            <StatCard
              label="Profit Factor"
              value={s.profitFactor == null ? '—' : s.profitFactor.toFixed(2)}
              sub={`${money(s.grossProfit)} gross / ${money(s.grossLoss)}`}
            />
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Unrealized P/L"
              value={
                isAccountReport(report) ? (
                  <span className={signClass(report.unrealizedPnl)}>{money(report.unrealizedPnl)}</span>
                ) : (
                  '—'
                )
              }
              sub={
                !isAccountReport(report)
                  ? 'select a single account'
                  : report.snapshotAt
                    ? `snapshot ${new Date(report.snapshotAt).toLocaleString()}`
                    : 'no snapshot recorded yet'
              }
            />
            <StatCard label="Avg Trade" value={money(s.avgPnl)} sub={`best ${money(s.bestTrade)} / worst ${money(s.worstTrade)}`} />
            <StatCard label="Volume" value={`${s.volumeLots} lots`} sub={`${s.opened} opened / ${s.closed} closed`} />
            <StatCard
              label="Avg Latency"
              value={s.avgLatencyMs == null ? '—' : `${s.avgLatencyMs}ms`}
              sub={`${s.failed} failed / ${s.filtered} filtered`}
            />
          </div>

          {isAccountReport(report) && report.asSource && (
            <Card className="mb-6 p-4 text-sm text-gray-600">
              This account is a <span className="font-medium text-gray-900">copier source</span>. It
              originated {report.asSource.events} copy event
              {report.asSource.events === 1 ? '' : 's'} to {report.asSource.receivers} receiver
              {report.asSource.receivers === 1 ? '' : 's'}, whose combined result was{' '}
              <span className={signClass(report.asSource.aggregateReceiverPnl)}>
                {money(report.asSource.aggregateReceiverPnl)}
              </span>
              . That figure belongs to the receivers — the stats above are this account's own results.
            </Card>
          )}

          <Card className="mb-6">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">
              Performance by {bucket === 'day' ? 'day' : bucket === 'week' ? 'week' : 'month'}
            </div>
            {report.periods.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="h-10 w-10" />}
                title="No closed trades"
                description="Nothing has been realized in this range yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Trades</th>
                      <th className="px-4 py-3">Win Rate</th>
                      <th className="px-4 py-3">P/L</th>
                      <th className="px-4 py-3">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.periods.map((p) => (
                      <tr key={p.period} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.period}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {p.trades} <span className="text-gray-400">({p.wins}W/{p.losses}L)</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{pct(p.winRate)}</td>
                        <td className={`px-4 py-3 font-medium ${signClass(p.pnl)}`}>{money(p.pnl)}</td>
                        <td className={`px-4 py-3 ${signClass(p.cumulativePnl)}`}>{money(p.cumulativePnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {!isAccountReport(report) && report.accounts.length > 0 && (
            <Card className="mb-6">
              <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">
                By account
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Trades</th>
                      <th className="px-4 py-3">Win Rate</th>
                      <th className="px-4 py-3">Realized P/L</th>
                      <th className="px-4 py-3">Max Drawdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.accounts.map((a) => (
                      <tr key={a.accountId} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-medium text-gray-900">{a.label}</td>
                        <td className="px-4 py-3 text-gray-600">{a.trades}</td>
                        <td className="px-4 py-3 text-gray-600">{pct(a.winRate)}</td>
                        <td className={`px-4 py-3 font-medium ${signClass(a.realizedPnl)}`}>
                          {money(a.realizedPnl)}
                        </td>
                        <td className="px-4 py-3 text-red-600">{money(a.maxDrawdown)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {report.symbols.length > 0 && (
            <Card>
              <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">
                By symbol
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-3">Symbol</th>
                      <th className="px-4 py-3">Trades</th>
                      <th className="px-4 py-3">Win Rate</th>
                      <th className="px-4 py-3">Volume</th>
                      <th className="px-4 py-3">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.symbols.map((sym) => (
                      <tr key={sym.symbol} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-medium text-gray-900">{sym.symbol}</td>
                        <td className="px-4 py-3 text-gray-600">{sym.trades}</td>
                        <td className="px-4 py-3 text-gray-600">{pct(sym.winRate)}</td>
                        <td className="px-4 py-3 text-gray-600">{sym.volumeLots}</td>
                        <td className={`px-4 py-3 font-medium ${signClass(sym.pnl)}`}>{money(sym.pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
