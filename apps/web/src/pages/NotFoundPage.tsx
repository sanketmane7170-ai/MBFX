import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { isAuthenticated } from '@/lib/api';

export default function NotFoundPage() {
  const authed = isAuthenticated();
  const to = authed ? '/dashboard' : '/';
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Compass className="h-7 w-7" />
      </div>
      <div className="mt-5 text-5xl font-bold tracking-tight text-gray-900">404</div>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        We couldn&rsquo;t find that page. It may have been moved, or the link is incorrect.
      </p>
      <Link
        to={to}
        className="mt-6 inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        {authed ? 'Back to dashboard' : 'Back to home'}
      </Link>
    </div>
  );
}
