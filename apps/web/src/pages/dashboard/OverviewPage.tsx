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
import {
  mastersApi,
  monitoringApi,
  slavesApi,
  type CopyEvent,
  type Master,
} from '@/lib/api';

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
    const masters = await mastersApi.list();
    const [slaveLists, eventLists] = await Promise.all([
      Promise.all(masters.map((m) => slavesApi.listForMaster(m.id).catch(() => []))),
      Promise.all(masters.map((m) => monitoringApi.masterEvents(m.id, 20).catch(() => []))),
    ]);
    const slaves = slaveLists.flat();
    const allEvents = eventLists.flat();
    const recent = [...allEvents]
      .sort((a, b) => b.ts.localeCompare(a.ts))
      .slice(0, 8);
    return { masters, slaves, allEvents, recent };
  }, []);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorState message={error ?? 'Failed to load'} onRetry={reload} />;

  const { masters, slaves, allEvents, recent } = data;
  const connected = masters.filter((m) => m.status === 'CONNECTED').length;
  const activeSlaves = slaves.filter((s) => s.enabled).length;
  const healthy = connected > 0;
  const masterLabel = (id: string) =>
    masters.find((m: Master) => m.id === id)?.label ?? '—';

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your copy operation." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Master Accounts" value={masters.length} sub={`${connected} connected`} />
        <StatCard label="Slave Accounts" value={slaves.length} sub={`${activeSlaves} active`} />
        <StatCard label="Connected" value={connected} sub="live masters" />
        <StatCard label="Recent Copies" value={allEvents.length} sub="last events" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Copier overview */}
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
            <MiniStat label="Active Slaves" value={activeSlaves} />
            <MiniStat label="Masters Connected" value={connected} />
            <MiniStat label="Total Masters" value={masters.length} />
            <MiniStat label="Recent Copies" value={allEvents.length} />
          </div>
        </Card>

        {/* Recent activity */}
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
              description="Copy events will appear here as trades are mirrored."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2.5">Master</th>
                    <th className="px-4 py-2.5">Symbol</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5 text-right">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e: CopyEvent) => (
                    <tr key={e.id} className="border-b border-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{masterLabel(e.masterAccountId)}</td>
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
