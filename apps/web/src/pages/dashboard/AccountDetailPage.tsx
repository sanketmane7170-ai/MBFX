import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  StatCard,
  StatusBadge,
} from '@/components/ui/misc';
import {
  accountsApi,
  monitoringApi,
  type Account,
  type AccountSnapshot,
  type CopyEvent,
  type OpenPosition,
} from '@/lib/api';
import { money, pnlColor } from '@/lib/format';

export default function AccountDetailPage() {
  const { id = '' } = useParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [events, setEvents] = useState<CopyEvent[]>([]);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [acc, snap, evts, pos] = await Promise.all([
        accountsApi.get(id),
        monitoringApi.snapshot(id).catch(() => null),
        monitoringApi.accountEvents(id, 50).catch(() => []),
        accountsApi.positions(id).catch(() => []),
      ]);
      setAccount(acc);
      setSnapshot(snap);
      setEvents(evts);
      setPositions(pos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load account');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Refresh live positions every 15s while the page is open.
    const t = setInterval(() => {
      accountsApi.positions(id).then(setPositions).catch(() => undefined);
      monitoringApi.snapshot(id).then(setSnapshot).catch(() => undefined);
    }, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!account) return null;

  const fmt = (v?: string | null) => (v == null ? '—' : Number(v).toLocaleString());

  return (
    <>
      <Link to="/dashboard/accounts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Accounts
      </Link>

      <PageHeader
        title={account.label}
        subtitle={`${account.login} · ${account.server} · ${account.platform}`}
        actions={<StatusBadge status={account.status} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Balance" value={fmt(snapshot?.balance)} sub={snapshot ? 'latest snapshot' : 'no data yet'} />
        <StatCard label="Equity" value={fmt(snapshot?.equity)} sub={snapshot ? 'latest snapshot' : 'no data yet'} />
        <StatCard label="Open Positions" value={positions.length || (snapshot?.openPositions ?? '—')} sub="live" />
        <StatCard label="Copy Events" value={events.length} sub="most recent" />
      </div>

      <Card className="mb-6">
        <div className="flex items-center gap-2 border-b border-gray-100 p-4 text-sm font-semibold text-gray-800">
          Open Positions
          <span className="ml-auto text-xs font-normal text-gray-400">live · refreshes every 15s</span>
        </div>
        {positions.length === 0 ? (
          <EmptyState title="No open positions" description="This account has no open trades right now." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3 text-right">Volume</th>
                  <th className="px-4 py-3 text-right">Open</th>
                  <th className="px-4 py-3 text-right">Current</th>
                  <th className="px-4 py-3 text-right">SL</th>
                  <th className="px-4 py-3 text-right">TP</th>
                  <th className="px-4 py-3 text-right">Swap</th>
                  <th className="px-4 py-3 text-right">P/L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.symbol}</td>
                    <td className="px-4 py-3">
                      <Badge tone={p.type === 'BUY' ? 'green' : 'red'}>{p.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{p.volume}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{p.openPrice}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{p.currentPrice ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{p.stopLoss ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{p.takeProfit ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{money(p.swap)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${pnlColor(p.profit)}`}>
                      {money(p.profit, { sign: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="border-b border-gray-100 p-4 text-sm font-semibold text-gray-800">Recent copy activity</div>
        {events.length === 0 ? (
          <EmptyState title="No copy events" description="This account has no recorded copy activity yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3">Lots</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-gray-500">{new Date(e.ts).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{e.symbol}</td>
                    <td className="px-4 py-3">{e.side}</td>
                    <td className="px-4 py-3 text-gray-600">{e.lots}</td>
                    <td className="px-4 py-3 text-gray-600">{e.action}</td>
                    <td className="px-4 py-3">
                      {e.sourceAccountId === id ? <Badge tone="blue">Source</Badge> : <Badge tone="gray">Receiver</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
