export type StoreStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'CLOSED';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export type AvailabilityType = 'TEMPORARY_CLOSURE' | 'HOLIDAY' | 'MAINTENANCE' | 'STAFF_SHORTAGE' | 'INVENTORY' | 'EMERGENCY';

export interface Address {
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  ward?: string | null;
  district?: string | null;
  province?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
}

/** Times are "HH:mm" in the domain (adapters normalise "HH:mm:ss"). */
export interface BusinessHour {
  dayOfWeek: DayOfWeek;
  openingTime?: string | null;
  closingTime?: string | null;
  closed: boolean;
}

export interface StoreConfig {
  autoAcceptOrder: boolean;
  allowPreOrder: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
  timeZone: string;
  currency: string;
  preparationTimeMinutes: number;
  maxOrdersPerDay?: number | null;
}

export interface Store {
  id: string;
  merchantId: string;
  name: string;
  code: string;
  ownerId: string;
  email?: string | null;
  phone?: string | null;
  status: StoreStatus;
  address?: Address | null;
  config?: StoreConfig | null;
  businessHours: BusinessHour[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreAvailability {
  id: string;
  storeId: string;
  type: AvailabilityType;
  startTime: string;
  endTime?: string | null;
  reason?: string | null;
  cancelled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A shop reference: enough to fetch it and link to it. */
export interface ShopRef {
  merchantId: string;
  storeId: string;
  name: string;
}

export const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function defaultBusinessHours(): BusinessHour[] {
  return DAYS.map((d) => ({ dayOfWeek: d, openingTime: '08:00', closingTime: '22:00', closed: false }));
}

/** Exactly 7 days in order; missing days get defaults. */
export function normaliseHours(hours: BusinessHour[] | null | undefined): BusinessHour[] {
  return DAYS.map((d) => {
    const h = hours?.find((x) => x.dayOfWeek === d);
    return h
      ? { ...h, openingTime: h.openingTime || '08:00', closingTime: h.closingTime || '22:00' }
      : { dayOfWeek: d, openingTime: '08:00', closingTime: '22:00', closed: false };
  });
}

const WEEKDAY: Record<string, DayOfWeek> = { Mon: 'MONDAY', Tue: 'TUESDAY', Wed: 'WEDNESDAY', Thu: 'THURSDAY', Fri: 'FRIDAY', Sat: 'SATURDAY', Sun: 'SUNDAY' };

/** Day and "HH:mm" of an instant in a time zone. */
export function localDayTime(now: Date, timeZone: string): { day: DayOfWeek; time: string } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const day = WEEKDAY[get('weekday')];
    return day ? { day, time: `${get('hour')}:${get('minute')}` } : null;
  } catch {
    return null;
  }
}

/**
 * Display hint: is the store inside today's business hours, in its own time zone?
 * Matches stores-service `BusinessHour.isOpen` (opening and closing minute inclusive, no overnight hours).
 * BR-STO-04 also requires no active closure window; that part is 🟡 and closures cannot be listed, so it is ignored.
 * Not used to accept orders.
 */
export function isOpenNow(store: Pick<Store, 'status' | 'config' | 'businessHours'>, now = new Date()): boolean {
  if (store.status !== 'ACTIVE') return false;
  const at = localDayTime(now, store.config?.timeZone || DEFAULT_TIME_ZONE);
  if (!at) return false;
  const h = store.businessHours.find((b) => b.dayOfWeek === at.day);
  if (!h || h.closed || !h.openingTime || !h.closingTime) return false;
  return at.time >= h.openingTime && at.time <= h.closingTime;
}

export function todaysHours(store: Pick<Store, 'config' | 'businessHours'>, now = new Date()): BusinessHour | undefined {
  const at = localDayTime(now, store.config?.timeZone || DEFAULT_TIME_ZONE);
  return at ? store.businessHours.find((b) => b.dayOfWeek === at.day) : undefined;
}

/** Decision 2026-10-27 (BR-STO-02): only ACTIVE stores take orders and appear in storefront feeds. */
export function takesOrders(store: Pick<Store, 'status'>): boolean {
  return store.status === 'ACTIVE';
}

/**
 * Hours the backend can evaluate: an open day needs both times and opening < closing
 * (stores-service `BusinessHour.isOpen` has no overnight hours and fails on missing times).
 */
export function hoursProblems(hours: BusinessHour[]): string[] {
  const out: string[] = [];
  for (const h of hours) {
    if (h.closed) continue;
    if (!h.openingTime || !h.closingTime) out.push(`${h.dayOfWeek}: set both opening and closing time, or mark the day closed`);
    else if (h.openingTime >= h.closingTime) out.push(`${h.dayOfWeek}: opening time must be before closing time (no overnight hours)`);
  }
  return out;
}
