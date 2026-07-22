import { Link } from 'react-router-dom';
import { Activity, ArrowRight, HeartPulse } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  StatCard,
} from '@/components/ui/misc';
import { useAsync } from '@/hooks/useAsync';
import { accountsApi, copierApi, monitoringApi, type CopyEvent } from '@/lib/api';

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export default function OverviewPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [accounts, copiers] = await Promise.all([accountsApi.list(), copierApi.list()]);
    const eventLists = await Promise.all(
      copiers.map((c) => monitoringApi.copierEvents(c.id, 20).catch(() => [])),
    );
    const allEvents = eventLists.flat();
    const recent = [...allEvents].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 8);
    return { accounts, copiers, allEvents, recent };
  }, []);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorState message={error ?? 'Failed to load'} onRetry={reload} />;

  const { accounts, copiers, allEvents, recent } = data;
  const connected = accounts.filter((a) => a.status === 'CONNECTED').length;
  const activeCopiers = copiers.filter((c) => c.enabled).length;
  const receivers = copiers.reduce((n, c) => n + c._count.subscriptions, 0);
  const healthy = activeCopiers > 0;
  const copierName = (id: string | null) => copiers.find((c) => c.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your copy operation." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Accounts" value={accounts.length} sub={`${connected} connected`} />
        <StatCard label="Copiers" value={copiers.length} sub={`${activeCopiers} active`} />
        <StatCard label="Receivers" value={receivers} sub="across all copiers" />
        <StatCard label="Recent Copies" value={allEvents.length} sub="last events" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <HeartPulse className="h-4 w-4 text-brand-600" /> Copier Overview
            </div>
            {healthy ? (
              <Badge tone="green">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Stable
              </Badge>
            ) : (
              <Badge tone="gray">Idle</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Active Copiers" value={activeCopiers} />
            <MiniStat label="Total Receivers" value={receivers} />
            <MiniStat label="Connected Accounts" value={connected} />
            <MiniStat label="Recent Copies" value={allEvents.length} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Activity className="h-4 w-4 text-brand-600" /> Recent Copy Activity
            </div>
            <Link
              to="/dashboard/monitor"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Live monitor <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-10 w-10" />}
              title="No activity yet"
              description="Copy events appear here as trades are mirrored."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2.5">Copier</th>
                    <th className="px-4 py-2.5">Symbol</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5 text-right">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e: CopyEvent) => (
                    <tr key={e.id} className="border-b border-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{copierName(e.copierConfigId)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{e.symbol}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={e.action === 'OPEN' ? 'green' : 'gray'}>{e.action}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {e.pnl != null ? (
                          <span className={Number(e.pnl) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {Number(e.pnl) >= 0 ? '+' : ''}
                            {e.pnl}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
