// API client for the Money Bank FX Trade Copier backend.
// Requests go through the Vite dev proxy (`/api` → http://localhost:3000).

const API = '/api/v1';

const TOKEN_KEY = 'tcp.accessToken';
const REFRESH_KEY = 'tcp.refreshToken';
const USER_KEY = 'tcp.user';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type Role = 'SUPER_ADMIN' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type Platform = 'MT4' | 'MT5';
export type AccountStatus = 'PROVISIONING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
export type ReceiverStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';
export type SizingMode = 'FIXED_LOT' | 'MULTIPLIER' | 'BALANCE_RATIO';
export type SymbolFilterMode = 'NONE' | 'INCLUDE' | 'EXCLUDE';
export type Side = 'BUY' | 'SELL';
export type CopyAction = 'OPEN' | 'CLOSE' | 'MODIFY';
export type CopyStatus = 'SUCCESS' | 'FAILED' | 'FILTERED';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
}

export interface Admin {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountMini {
  id: string;
  label: string;
  login: string;
  server: string;
  platform: Platform;
  status: AccountStatus;
  marginMode: string | null;
}

export interface Account {
  id: string;
  label: string;
  metaapiAccountId: string;
  login: string;
  server: string;
  platform: Platform;
  status: AccountStatus;
  marginMode: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  sourceForConfig: { id: string; name: string } | null;
  _count: { receiverSubscriptions: number };
}

export interface SymbolMap {
  from: string;
  to: string;
}

export interface Subscription {
  id: string;
  copierConfigId: string;
  receiverAccountId: string;
  sizingMode: SizingMode;
  multiplier: string;
  copySl: boolean;
  copyTp: boolean;
  reverse: boolean;
  symbolMapping: SymbolMap[] | null;
  symbolFilterMode: SymbolFilterMode;
  symbolFilterList: string[];
  minVolume: number | null;
  maxVolume: number | null;
  tradeWindowStart: number | null;
  tradeWindowEnd: number | null;
  enabled: boolean;
  status: ReceiverStatus;
  createdAt: string;
  receiverAccount: AccountMini;
}

export interface CopierConfig {
  id: string;
  name: string;
  sourceAccountId: string;
  copyfactoryStrategyId: string;
  enabled: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  sourceAccount: AccountMini;
  _count: { subscriptions: number };
}

export interface CopierConfigDetail extends CopierConfig {
  subscriptions: Subscription[];
}

export interface CopyEvent {
  id: string;
  copierConfigId: string | null;
  sourceAccountId: string;
  receiverAccountId: string;
  sourceTicket: string;
  receiverTicket: string | null;
  symbol: string;
  side: Side;
  lots: string;
  sl: string | null;
  tp: string | null;
  action: CopyAction;
  status: CopyStatus;
  latencyMs: number | null;
  pnl: string | null;
  ts: string;
}

export interface MetaApiStatus {
  configured: boolean;
  region: string;
  tokenPreview: string | null;
  source: 'settings' | 'env' | 'none';
  updatedAt: string | null;
}

export interface SmtpStatus {
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  fromName: string | null;
  fromEmail: string | null;
  alertEmail: string | null;
  alertsEnabled: boolean;
  source: 'settings' | 'env' | 'none';
  updatedAt: string | null;
}

export interface SmtpInput {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  fromName?: string;
  fromEmail?: string;
  alertEmail?: string;
  alertsEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}
export function isAuthenticated(): boolean {
  return !!getToken();
}
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
function storeSession(data: { accessToken: string; refreshToken: string; user?: AuthUser }): void {
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
  if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

// ---------------------------------------------------------------------------
// Core fetch with typed errors + one-shot refresh on 401
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.message === 'string') return body.message;
    if (Array.isArray(body?.message)) return body.message.join(', ');
    if (typeof body?.error === 'string') return body.error;
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    storeSession(await res.json());
    return true;
  } catch {
    return false;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
  });

  if (res.status === 401 && allowRefresh) {
    if (await tryRefresh()) return apiFetch<T>(path, options, false);
    logout();
    if (window.location.pathname !== '/login') window.location.assign('/login');
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  const data = await res.json();
  storeSession(data);
  return data.user as AuthUser;
}
export const fetchMe = () => apiFetch<AuthUser>('/auth/me');
export const logoutServer = () =>
  apiFetch<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
export const changePassword = (currentPassword: string, newPassword: string) =>
  apiFetch<void>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
// Public reset flow — these do not require auth.
export const forgotPassword = (email: string) =>
  apiFetch<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
export const resetPassword = (email: string, token: string, newPassword: string) =>
  apiFetch<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, token, newPassword }),
  });

export interface Session {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}
export const sessionsApi = {
  list: () => apiFetch<Session[]>('/auth/sessions'),
  revoke: (id: string) => apiFetch<void>(`/auth/sessions/${id}`, { method: 'DELETE' }),
  revokeOthers: () => apiFetch<void>('/auth/sessions/revoke-others', { method: 'POST' }),
};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export interface CreateAccountInput {
  label: string;
  login: string;
  password: string;
  server: string;
  platform: Platform;
}
export interface OpenPosition {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  swap: number;
  profit: number;
  time: string | null;
}

export const accountsApi = {
  list: () => apiFetch<Account[]>('/accounts'),
  get: (id: string) => apiFetch<Account>(`/accounts/${id}`),
  positions: (id: string) => apiFetch<OpenPosition[]>(`/accounts/${id}/positions`),
  create: (body: CreateAccountInput) =>
    apiFetch<Account>('/accounts', { method: 'POST', body: JSON.stringify(body) }),
  rename: (id: string, label: string) =>
    apiFetch<Account>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify({ label }) }),
  update: (id: string, body: { label?: string; password?: string; server?: string }) =>
    apiFetch<Account>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  /** Broker-server suggestions (in-use servers + curated list). Free text still allowed. */
  servers: (q?: string) =>
    apiFetch<{ server: string; inUse: boolean }[]>(
      `/accounts/servers${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    ),
  connect: (id: string) => apiFetch<Account>(`/accounts/${id}/connect`, { method: 'POST' }),
  disconnect: (id: string) => apiFetch<Account>(`/accounts/${id}/disconnect`, { method: 'POST' }),
  remove: (id: string) => apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Copiers (configs + receivers)
// ---------------------------------------------------------------------------
export interface ReceiverRules {
  sizingMode?: SizingMode;
  multiplier?: number;
  copySl?: boolean;
  copyTp?: boolean;
  reverse?: boolean;
  symbolMapping?: SymbolMap[];
  symbolFilterMode?: SymbolFilterMode;
  symbolFilterList?: string[];
  minVolume?: number | null;
  maxVolume?: number | null;
  tradeWindowStart?: number | null;
  tradeWindowEnd?: number | null;
}
export const copierApi = {
  list: () => apiFetch<CopierConfig[]>('/copiers'),
  get: (id: string) => apiFetch<CopierConfigDetail>(`/copiers/${id}`),
  create: (name: string, sourceAccountId: string) =>
    apiFetch<CopierConfig>('/copiers', {
      method: 'POST',
      body: JSON.stringify({ name, sourceAccountId }),
    }),
  update: (id: string, body: { name?: string; enabled?: boolean }) =>
    apiFetch<CopierConfig>(`/copiers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/copiers/${id}`, { method: 'DELETE' }),
  closeAll: (id: string) =>
    apiFetch<{ closed: number }>(`/copiers/${id}/close-all`, { method: 'POST' }),

  addReceiver: (configId: string, receiverAccountId: string, rules: ReceiverRules) =>
    apiFetch<Subscription>(`/copiers/${configId}/receivers`, {
      method: 'POST',
      body: JSON.stringify({ receiverAccountId, ...rules }),
    }),
  updateReceiver: (subId: string, rules: ReceiverRules & { enabled?: boolean }) =>
    apiFetch<Subscription>(`/receivers/${subId}`, { method: 'PATCH', body: JSON.stringify(rules) }),
  pauseReceiver: (subId: string) =>
    apiFetch<Subscription>(`/receivers/${subId}/pause`, { method: 'POST' }),
  resumeReceiver: (subId: string) =>
    apiFetch<Subscription>(`/receivers/${subId}/resume`, { method: 'POST' }),
  removeReceiver: (subId: string) => apiFetch<void>(`/receivers/${subId}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Admins (Super Admin)
// ---------------------------------------------------------------------------
export const adminsApi = {
  list: () => apiFetch<Admin[]>('/admins'),
  create: (email: string, password: string) =>
    apiFetch<Admin>('/admins', { method: 'POST', body: JSON.stringify({ email, password }) }),
  setStatus: (id: string, status: UserStatus) =>
    apiFetch<Admin>(`/admins/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  resetPassword: (id: string, password: string) =>
    apiFetch<void>(`/admins/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  remove: (id: string) => apiFetch<void>(`/admins/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------
export interface AccountSnapshot {
  id: string;
  accountId: string;
  balance: string;
  equity: string;
  margin: string;
  openPositions: number;
  ts: string;
}

export interface HistoryQuery {
  status?: CopyStatus;
  symbol?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export const monitoringApi = {
  copierEvents: (id: string, limit = 100) =>
    apiFetch<CopyEvent[]>(`/copiers/${id}/copy-events?limit=${limit}`),
  accountEvents: (id: string, limit = 100) =>
    apiFetch<CopyEvent[]>(`/accounts/${id}/copy-events?limit=${limit}`),
  snapshot: (id: string) => apiFetch<AccountSnapshot | null>(`/accounts/${id}/snapshot`),
  history: (q: HistoryQuery = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v != null && v !== '' && p.set(k, String(v)));
    return apiFetch<{ items: CopyEvent[]; total: number }>(`/copy-events?${p.toString()}`);
  },
};

// ---------------------------------------------------------------------------
// Reports (FR-20) — money fields arrive as decimal strings, never floats
// ---------------------------------------------------------------------------
export type ReportBucket = 'day' | 'week' | 'month';

export interface ReportSummary {
  trades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  realizedPnl: string;
  grossProfit: string;
  grossLoss: string;
  profitFactor: number | null;
  avgPnl: string;
  bestTrade: string | null;
  worstTrade: string | null;
  maxDrawdown: string;
  volumeLots: string;
  opened: number;
  closed: number;
  failed: number;
  filtered: number;
  avgLatencyMs: number | null;
}

export interface ReportPeriod {
  period: string;
  start: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: string;
  cumulativePnl: string;
}

export interface ReportSymbol {
  symbol: string;
  trades: number;
  wins: number;
  winRate: number;
  pnl: string;
  volumeLots: string;
}

export interface ReportRange {
  from: string | null;
  to: string | null;
  bucket: ReportBucket;
}

export interface AccountReport {
  account: { id: string; label: string; login: string; platform: Platform };
  range: ReportRange;
  summary: ReportSummary;
  unrealizedPnl: string | null;
  snapshotAt: string | null;
  periods: ReportPeriod[];
  symbols: ReportSymbol[];
  asSource: { events: number; receivers: number; aggregateReceiverPnl: string } | null;
}

export interface OverviewReport {
  range: ReportRange;
  summary: ReportSummary;
  periods: ReportPeriod[];
  symbols: ReportSymbol[];
  accounts: Array<{
    accountId: string;
    label: string;
    trades: number;
    wins: number;
    winRate: number;
    realizedPnl: string;
    maxDrawdown: string;
  }>;
}

export interface ReportQuery {
  from?: string;
  to?: string;
  bucket?: ReportBucket;
}

const reportQuery = (q: ReportQuery) => {
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => v != null && v !== '' && p.set(k, String(v)));
  return p.toString();
};

export const reportsApi = {
  overview: (q: ReportQuery = {}) => apiFetch<OverviewReport>(`/reports/overview?${reportQuery(q)}`),
  account: (id: string, q: ReportQuery = {}) =>
    apiFetch<AccountReport>(`/reports/accounts/${id}?${reportQuery(q)}`),
};

// ---------------------------------------------------------------------------
// Audit log (Super Admin) + runtime flags
// ---------------------------------------------------------------------------
export interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: unknown;
  ts: string;
  user: { email: string } | null;
}
export interface AuditQuery {
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
export const auditApi = {
  list: (q: AuditQuery = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v != null && v !== '' && p.set(k, String(v)));
    return apiFetch<{ items: AuditLog[]; total: number }>(`/audit-logs?${p.toString()}`);
  },
};

// ---------------------------------------------------------------------------
// In-app notifications (bell)
// ---------------------------------------------------------------------------
export type NotificationType = 'COPY_FAILED' | 'ACCOUNT_OFFLINE' | 'ACCOUNT_ONLINE' | 'INFO';
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  meta: unknown;
  readAt: string | null;
  createdAt: string;
}
export const notificationsApi = {
  list: () => apiFetch<Notification[]>('/notifications'),
  unreadCount: () => apiFetch<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => apiFetch<void>('/notifications/read-all', { method: 'POST' }),
};

export interface RuntimeInfo {
  liveTrading: boolean;
  simulationEnabled: boolean;
}
export const runtimeApi = {
  info: () => apiFetch<RuntimeInfo>('/runtime'),
};

// Dev-only simulation (disabled server-side when METAAPI_TOKEN is set).
export const simApi = {
  open: (copierId: string, body: { symbol?: string; side?: Side; lots?: number; sl?: number; tp?: number }) =>
    apiFetch<{ sourceTicket: string; copiedTo: number }>(`/dev/simulate/copiers/${copierId}/open`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  close: (copierId: string, sourceTicket: string) =>
    apiFetch<{ closed: number }>(`/dev/simulate/copiers/${copierId}/close`, {
      method: 'POST',
      body: JSON.stringify({ sourceTicket }),
    }),
};

// ---------------------------------------------------------------------------
// Settings (Super Admin) — MetaApi token
// ---------------------------------------------------------------------------
export const settingsApi = {
  status: () => apiFetch<MetaApiStatus>('/settings/metaapi'),
  set: (token: string, region: string) =>
    apiFetch<MetaApiStatus>('/settings/metaapi', { method: 'PUT', body: JSON.stringify({ token, region }) }),
  test: (token?: string, region?: string) =>
    apiFetch<{ ok: boolean; message: string; accounts?: number }>('/settings/metaapi/test', {
      method: 'POST',
      body: JSON.stringify({ token, region }),
    }),
  clear: () => apiFetch<MetaApiStatus>('/settings/metaapi', { method: 'DELETE' }),

  // ---- Email / SMTP ----
  smtpStatus: () => apiFetch<SmtpStatus>('/settings/smtp'),
  smtpSet: (body: SmtpInput) =>
    apiFetch<SmtpStatus>('/settings/smtp', { method: 'PUT', body: JSON.stringify(body) }),
  smtpTest: (body: Partial<SmtpInput> & { to?: string }) =>
    apiFetch<{ ok: boolean; message: string }>('/settings/smtp/test', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  smtpClear: () => apiFetch<SmtpStatus>('/settings/smtp', { method: 'DELETE' }),
};
