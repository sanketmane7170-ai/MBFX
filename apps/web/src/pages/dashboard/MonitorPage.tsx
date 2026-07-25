import { useEffect, useRef, useState } from 'react';
import { type Socket } from 'socket.io-client';
import { Activity, Play, Radio, Square } from 'lucide-react';
import { PageHeader } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Badge, Card, EmptyState, LoadingBlock } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useAsync } from '@/hooks/useAsync';
import { connectStream, subscribe } from '@/lib/socket';
import { copierApi, monitoringApi, runtimeApi, simApi, type CopyEvent } from '@/lib/api';

function time(ts: string): string {
  return new Date(ts).toLocaleTimeString();
}

export default function MonitorPage() {
  const toast = useToast();
  const { data: copiers, loading } = useAsync(() => copierApi.list(), []);
  const { data: runtime } = useAsync(() => runtimeApi.info(), []);
  const [configId, setConfigId] = useState('');
  const [events, setEvents] = useState<CopyEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastTicket, setLastTicket] = useState<string | null>(null);

  const configIdRef = useRef(configId);
  configIdRef.current = configId;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (copiers && copiers.length > 0 && !configId) setConfigId(copiers[0].id);
  }, [copiers, configId]);

  useEffect(() => {
    const socket = connectStream();
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      if (configIdRef.current) subscribe(socket, { room: 'config', id: configIdRef.current });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('copy_event', (e: CopyEvent) => {
      if (e.copierConfigId === configIdRef.current) {
        setEvents((prev) => [e, ...prev].slice(0, 100));
      }
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!configId) return;
    if (socketRef.current?.connected) subscribe(socketRef.current, { room: 'config', id: configId });
    monitoringApi
      .copierEvents(configId, 50)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [configId]);

  const simulateOpen = async () => {
    if (!configId) return;
    try {
      const r = await simApi.open(configId, { symbol: 'EURUSD', side: 'BUY', lots: 1 });
      setLastTicket(r.sourceTicket);
      toast(`Simulated trade copied to ${r.copiedTo} receiver(s)`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Simulation failed', 'error');
    }
  };

  const simulateClose = async () => {
    if (!configId || !lastTicket) return;
    try {
      const r = await simApi.close(configId, lastTicket);
      toast(`Closed ${r.closed} position(s)`, 'success');
      setLastTicket(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Close failed', 'error');
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Live Monitor"
        subtitle="Real-time copy activity streamed over WebSocket."
        actions={
          connected ? (
            <Badge tone="green">
              <Radio className="h-3.5 w-3.5" /> Live
            </Badge>
          ) : (
            <Badge tone="red">Offline</Badge>
          )
        }
      />

      {!copiers || copiers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Activity className="h-10 w-10" />}
            title="No copiers"
            description="Create a copier first, then watch its copies stream here."
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="w-full max-w-xs">
              <Select value={configId} onChange={(e) => setConfigId(e.target.value)}>
                {copiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.sourceAccount.label}
                  </option>
                ))}
              </Select>
            </div>
            {runtime?.simulationEnabled && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={simulateOpen}>
                  <Play className="h-3.5 w-3.5" /> Simulate trade
                </Button>
                <Button variant="secondary" size="sm" onClick={simulateClose} disabled={!lastTicket}>
                  <Square className="h-3.5 w-3.5" /> Close last
                </Button>
              </div>
            )}
          </div>

          <Card>
            <div className="flex items-center gap-2 border-b border-gray-100 p-4 text-sm font-semibold text-gray-800">
              <Activity className="h-4 w-4 text-brand-600" /> Copy Log
              <span className="ml-auto text-xs font-normal text-gray-400">{events.length} events</span>
            </div>
            {events.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-10 w-10" />}
                title="Waiting for copy activity"
                description={
                  runtime?.simulationEnabled
                    ? 'When the source trades, copies appear here in real time. Use “Simulate trade” to try it.'
                    : 'When the source account places a trade, the copy to each receiver appears here in real time.'
                }
              />
            ) : (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Symbol</th>
                      <th className="px-4 py-3">Side</th>
                      <th className="px-4 py-3">Lots</th>
                      <th className="px-4 py-3">Latency</th>
                      <th className="px-4 py-3 text-right">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-b border-gray-50">
                        <td className="px-4 py-2.5 text-gray-500">{time(e.ts)}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={e.action === 'OPEN' ? 'green' : e.action === 'CLOSE' ? 'gray' : 'blue'}>
                            {e.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{e.symbol}</td>
                        <td className="px-4 py-2.5">
                          <span className={e.side === 'BUY' ? 'text-emerald-600' : 'text-red-600'}>
                            {e.side}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{e.lots}</td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {e.latencyMs != null ? `${e.latencyMs} ms` : '—'}
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
        </>
      )}
    </>
  );
}
