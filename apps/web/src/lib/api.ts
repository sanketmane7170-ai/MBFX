// API client for the MoneyBank FX Trade Copier backend.
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
}

export interface Account {
  id: string;
  label: string;
  metaapiAccountId: string;
  login: string;
  server: string;
  platform: Platform;
  status: AccountStatus;
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
export const accountsApi = {
  list: () => apiFetch<Account[]>('/accounts'),
  get: (id: string) => apiFetch<Account>(`/accounts/${id}`),
  create: (body: CreateAccountInput) =>
    apiFetch<Account>('/accounts', { method: 'POST', body: JSON.stringify(body) }),
  rename: (id: string, label: string) =>
    apiFetch<Account>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify({ label }) }),
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
};

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------
export const monitoringApi = {
  copierEvents: (id: string, limit = 100) =>
    apiFetch<CopyEvent[]>(`/copiers/${id}/copy-events?limit=${limit}`),
  accountEvents: (id: string, limit = 100) =>
    apiFetch<CopyEvent[]>(`/accounts/${id}/copy-events?limit=${limit}`),
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
};
