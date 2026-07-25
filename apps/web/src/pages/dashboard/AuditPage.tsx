import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock } from '@/components/ui/misc';
import { auditApi, type AuditLog } from '@/lib/api';

const PAGE = 50;

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(0);

  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await auditApi.list({
        action: action.trim() || undefined,
        entityType: entityType.trim() || undefined,
        limit: PAGE,
        offset: page * PAGE,
      });
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const apply = () => {
    setPage(0);
    load();
  };

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <PageHeader title="Audit Log" subtitle="A record of every state-changing action on the platform." />

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Action">
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. ACCOUNT_CREATED" />
          </Field>
          <Field label="Entity type">
            <Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="e.g. Account" />
          </Field>
          <div className="flex items-end">
            <Button onClick={apply} className="w-full">
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
          <EmptyState icon={<ScrollText className="h-10 w-10" />} title="No audit entries" description="Nothing matches these filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id} className="border-b border-gray-50 align-top hover:bg-gray-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">{new Date(e.ts).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-700">{e.user?.email ?? <span className="text-gray-400">system</span>}</td>
                      <td className="px-4 py-3">
                        <Badge tone={e.action.includes('FAILED') || e.action.includes('DELETED') ? 'red' : 'gray'}>
                          {e.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {e.entityType ?? '—'}
                        {e.entityId ? <span className="text-gray-300"> · {e.entityId.slice(0, 8)}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {e.meta ? (
                          <code className="whitespace-pre-wrap break-all">{JSON.stringify(e.meta)}</code>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
              <span>
                {total} entr{total === 1 ? 'y' : 'ies'} · page {page + 1} of {pages}
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
