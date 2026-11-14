import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const auth =
  url && key
    ? createClient(
        url,
        key,
        import.meta.env.VITE_APP_ENV
          ? { auth: { storageKey: `takeoff-${import.meta.env.VITE_APP_ENV}-auth` } }
          : {},
      )
    : null;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const session = auth ? (await auth.auth.getSession()).data.session : null;
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      'X-Takeoff-Environment': import.meta.env.VITE_APP_ENV || 'production',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Ticketing API unavailable. Please try again later.');
  }
  if (!response.ok)
    throw new ApiError(result.error || 'Request failed', response.status, result.code);
  return result;
}
export interface Catalog {
  salesEnabled: boolean;
  types: { code: string; label: string; amount: number; currency: string }[];
  sectors: { code: string; label: string }[];
  currencies: { code: string; decimals: number }[];
}
export interface Attendee {
  full_name: string;
  email: string;
  company?: string;
  role?: string;
}
export type Profile = Record<string, string | number | boolean | null | string[]>;
export interface Ticket {
  id: string;
  type: string;
  label: string;
  status: string;
  attendee: Attendee | null;
  startup: Profile | null;
  investor: Profile | null;
  used: boolean;
  transferable: boolean;
  transfer: { id: string; email: string; expires_at: string } | null;
}
export interface OrderSummary {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
}
export interface Me {
  email: string;
  staffRole: 'admin' | 'checkin' | null;
  canAccessTickets: boolean;
  canAccessOrders: boolean;
  orders: OrderSummary[];
}
export interface Order extends OrderSummary {
  request_key?: string;
  discount_code?: string;
  discount_amount?: number;
  discount_percentage?: number;
  items: { id: string; label: string; quantity: number; unit_amount: number }[];
  tickets: { id: string; status: string; held_by_buyer: boolean }[];
}
export function money(amount: number, currency = 'JPY') {
  const decimals = currency === 'JPY' ? 0 : 2;
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    amount / 10 ** decimals,
  );
}
export function toMinor(value: string, currency: string): number | null {
  if (!value.trim()) return null;
  const decimals = currency === 'JPY' ? 0 : 2;
  const match = value.trim().match(/^(\d+)(?:\.(\d+))?$/);
  if (!match || (match[2]?.length || 0) > decimals)
    throw new Error(`Enter a valid ${currency} amount with at most ${decimals} decimal places.`);
  const amount = Number(
    BigInt(match[1]) * BigInt(10 ** decimals) +
      BigInt((match[2] || '').padEnd(decimals, '0') || '0'),
  );
  if (!Number.isSafeInteger(amount)) throw new Error('Amount is too large');
  return amount;
}
export function fromMinor(value: unknown, currency: string): string {
  return typeof value === 'number' ? String(value / (currency === 'JPY' ? 1 : 100)) : '';
}
