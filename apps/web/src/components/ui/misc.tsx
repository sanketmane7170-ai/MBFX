import { type HTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-gray-200 bg-white', className)}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-gray-400', className)} />;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

type Tone = 'gray' | 'green' | 'red' | 'amber' | 'blue';

const dot: Record<Tone, string> = {
  gray: 'bg-gray-400',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
};

const fill: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-600',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
};

const outline: Record<Tone, string> = {
  gray: 'border-gray-200 bg-gray-50 text-gray-500',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  red: 'border-red-200 bg-red-50 text-red-600',
  amber: 'border-amber-200 bg-amber-50 text-amber-600',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
};

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        fill[tone],
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  CONNECTED: 'green',
  COPYING: 'green',
  ACTIVE: 'green',
  SUCCESS: 'green',
  PROVISIONING: 'blue',
  PAUSED: 'amber',
  DISCONNECTED: 'amber',
  CLOSED: 'gray',
  DISABLED: 'gray',
  FILTERED: 'gray',
  ERROR: 'red',
  FAILED: 'red',
};

/** Outlined status pill (matches the reference "Disconnected" style). */
export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone[status] ?? 'gray';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
        outline[tone],
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dot[tone])} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </Card>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const local = name.split('@')[0] || name;
  const parts = local.split(/[.\s_-]+/).filter(Boolean);
  const initials = (
    parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  ).toUpperCase() || '?';
  return (
    <span
      className={cn(
        'grid shrink-0 place-content-center rounded-full bg-brand-100 font-semibold text-brand-700',
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {icon && <div className="text-gray-300">{icon}</div>}
      <div>
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertCircle className="h-8 w-8 text-red-400" />
      <p className="max-w-sm text-sm text-gray-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}
