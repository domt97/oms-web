import type { AvailabilityType, DayOfWeek, StoreStatus } from '../../domain/store';
import type { ProductStatus } from '../../domain/catalog';
import type { StockMovementType } from '../../domain/inventory';

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTime.format(d);
}

export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const DAY_LABEL: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

export const STORE_STATUS_LABEL: Record<StoreStatus, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', SUSPENDED: 'Suspended', CLOSED: 'Closed' };

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = { DRAFT: 'Draft', ACTIVE: 'On sale', INACTIVE: 'Not on sale' };

export const AVAILABILITY_LABEL: Record<AvailabilityType, string> = {
  TEMPORARY_CLOSURE: 'Temporary closure',
  HOLIDAY: 'Holiday',
  MAINTENANCE: 'Maintenance',
  STAFF_SHORTAGE: 'Staff shortage',
  INVENTORY: 'Stock take',
  EMERGENCY: 'Emergency',
};

export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  RECEIVE: 'Receive',
  SALE: 'Sale',
  RETURN: 'Return',
  ADJUSTMENT_IN: 'Adjustment (+)',
  ADJUSTMENT_OUT: 'Adjustment (−)',
  DAMAGE: 'Damage',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
};
