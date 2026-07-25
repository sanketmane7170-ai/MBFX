import { useEffect, useState } from 'react';
import { Download, History } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Card, EmptyState, ErrorState, LoadingBlock, StatusBadge } from '@/components/ui/misc';
import { monitoringApi, type CopyEvent, type CopyStatus } from '@/lib/api';

const PAGE = 50;

export default function HistoryPage() {
  const [status, setStatus] = useState<'' | CopyStatus>('');
  const [symbol, setSymbol] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const [items, setItems] = useState<CopyEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = () => ({
    status: status || undefined,
    symbol: symbol.trim() || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await monitoringApi.history({ ...filters(), limit: PAGE, offset: page * PAGE });
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const applyFilters = () => {
    setPage(0);
    load();
  };

  // Export the whole filtered result set (paged in chunks), not just this page.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const CHUNK = 500;
      const MAX = 20000; // safety cap
      const all: CopyEvent[] = [];
      let offset = 0;
      for (;;) {
        const r = await monitoringApi.history({ ...filters(), limit: CHUNK, offset });
        all.push(...r.items);
        offset += CHUNK;
        if (r.items.length === 0 || all.length >= r.total || all.length >= MAX) break;
      }
      const header = ['time', 'symbol', 'side', 'lots', 'action', 'status', 'latencyMs', 'pnl', 'sourceTicket', 'receiverTicket'];
      const rows = all.map((e) => [
        new Date(e.ts).toISOString(),
        e.symbol,
        e.side,
        e.lots,
        e.action,
        e.status,
        e.latencyMs ?? '',
        e.pnl ?? '',
        e.sourceTicket ?? '',
        e.receiverTicket ?? '',
      ]);
      const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `copy-events-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <PageHeader
        title="Copy History"
        subtitle="Every copied trade across your copiers."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={total === 0} loading={exporting}>
            <Download className="h-4 w-4" /> Export CSV{total > items.length ? ` (${total})` : ''}
          </Button>
        }
      />

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as '' | CopyStatus)}>
              <option value="">All</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="FILTERED">Filtered</option>
            </Select>
          </Field>
          <Field label="Symbol">
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="EURUSD" />
          </Field>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button onClick={applyFilters} className="w-full">
              Apply
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState icon={<History className="h-10 w-10" />} title="No copy events" description="Nothing matches these filters yet." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Side</th>
                    <th className="px-4 py-3">Lots</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Latency</th>
                    <th className="px-4 py-3">P/L</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-gray-500">{new Date(e.ts).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{e.symbol}</td>
                      <td className="px-4 py-3">{e.side}</td>
                      <td className="px-4 py-3 text-gray-600">{e.lots}</td>
                      <td className="px-4 py-3 text-gray-600">{e.action}</td>
                      <td className="px-4 py-3 text-gray-500">{e.latencyMs != null ? `${e.latencyMs}ms` : '—'}</td>
                      <td
                        className={`px-4 py-3 font-medium ${
                          e.pnl == null ? 'text-gray-400' : Number(e.pnl) >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {e.pnl == null ? '—' : Number(e.pnl).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
              <span>
                {total} event{total === 1 ? '' : 's'} · page {page + 1} of {pages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
