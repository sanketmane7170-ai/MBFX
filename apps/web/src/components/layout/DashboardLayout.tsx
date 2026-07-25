import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  ChevronDown,
  Copy,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUser, logout, logoutServer } from '@/lib/api';
import { ToastProvider } from '@/components/ui/toast';
import { Avatar } from '@/components/ui/misc';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { SessionsDialog } from '@/components/SessionsDialog';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

function UserMenu() {
  const user = getUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onLogout = async () => {
    await logoutServer();
    logout();
    navigate('/login');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-100"
      >
        <Avatar name={user?.email ?? '?'} className="h-9 w-9 text-sm" />
        <div className="hidden text-left sm:block">
          <div className="text-sm font-semibold leading-tight text-gray-900">
            {user?.email?.split('@')[0]}
          </div>
          <div className="text-xs leading-tight text-gray-400">
            {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="truncate text-sm font-medium text-gray-800">{user?.email}</div>
            <div className="text-xs text-brand-600">{user?.role}</div>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              setPwOpen(true);
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <KeyRound className="h-4 w-4" /> Change password
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setSessionsOpen(true);
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <MonitorSmartphone className="h-4 w-4" /> Active sessions
          </button>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}

      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
      <SessionsDialog open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
    </div>
  );
}

export default function DashboardLayout() {
  const user = getUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === '1',
  );

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      localStorage.setItem('sidebar_collapsed', v ? '0' : '1');
      return !v;
    });

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'General',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/dashboard/accounts', label: 'Accounts', icon: SlidersHorizontal },
      ],
    },
    {
      label: 'Copier',
      items: [
        { to: '/dashboard/copiers', label: 'Copiers', icon: Copy },
        { to: '/dashboard/monitor', label: 'Live Monitor', icon: Activity },
        { to: '/dashboard/history', label: 'Copy History', icon: History },
        { to: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
      ],
    },
    ...(user?.role === 'SUPER_ADMIN'
      ? [
          {
            label: 'Administration',
            items: [
              { to: '/dashboard/admins', label: 'Admins', icon: ShieldCheck },
              { to: '/dashboard/audit', label: 'Audit Log', icon: ScrollText },
              { to: '/dashboard/settings', label: 'Settings', icon: Settings },
            ] as NavItem[],
          },
        ]
      : []),
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-[transform,width] md:translate-x-0',
            collapsed ? 'md:w-16' : 'md:w-64',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div
            className={cn(
              'flex h-16 items-center border-b border-gray-100',
              collapsed ? 'justify-between px-5 md:justify-center md:px-2' : 'justify-between px-5',
            )}
          >
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="MoneyBank FX" className="h-9 w-9 shrink-0 object-contain" />
              <span className={cn('text-[15px] font-bold text-gray-900', collapsed && 'md:hidden')}>
                MoneyBank FX
              </span>
            </div>
            <button
              className="text-gray-400 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
            {groups.map((group) => (
              <div key={group.label}>
                <div
                  className={cn(
                    'px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400',
                    collapsed && 'md:hidden',
                  )}
                >
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          collapsed && 'md:justify-center md:px-2',
                          isActive
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-gray-600 hover:bg-gray-100',
                        )
                      }
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className={cn(collapsed && 'md:hidden')}>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-gray-900/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Content */}
        <div
          className={cn(
            'flex min-h-screen flex-col transition-[padding]',
            collapsed ? 'md:pl-16' : 'md:pl-64',
          )}
        >
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-4 backdrop-blur sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-gray-600 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={toggleCollapsed}
              className="hidden text-gray-500 hover:text-gray-800 md:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2 md:hidden">
              <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
              <span className="font-bold text-gray-900">MoneyBank FX</span>
            </div>
            <div className="ml-auto">
              <UserMenu />
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
            <Outlet />
          </main>

          {/* Footer — shown at the bottom of every dashboard page */}
          <footer className="border-t border-gray-100 px-4 py-4 text-center text-xs text-gray-400 sm:px-6">
            <div>MoneyBank FX · v{__APP_VERSION__}</div>
            <div>
              Developed by <span className="font-medium text-gray-500">Sanket Patil</span> · 9270507170
            </div>
          </footer>
        </div>
      </div>
    </ToastProvider>
  );
}
