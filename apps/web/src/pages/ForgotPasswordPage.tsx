import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { forgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <img src="/logo.png" alt="Money Bank FX" className="h-9 w-9 object-contain" />
          <span className="text-[15px] font-bold text-gray-900">Money Bank FX</span>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <MailCheck className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
            <p className="mt-2 text-sm text-gray-500">
              If an account exists for <span className="font-medium text-gray-700">{email}</span>, we&rsquo;ve
              sent a link to reset your password. It expires in 30 minutes.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900">Forgot your password?</h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Enter your account email and we&rsquo;ll send you a link to reset it.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="h-10 w-full rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <Link
              to="/login"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
