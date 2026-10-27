import { checkLine, isBlocking, type CartLine, type LineIssue } from '../../../domain/cart';
import { useAsync } from '../../../shared/lib/async';
import { useServices } from '../../../shared/lib/services';

/**
 * BR-CRT-03 (decision 2026-10-27): re-check prices, stock and availability whenever the cart is viewed,
 * and flag problems on the line without removing it. Checkout is blocked while a blocking issue exists.
 */
export function useCartChecks(lines: CartLine[]) {
  const { catalog } = useServices();
  // Re-check when the set of SKUs or quantities changes.
  const key = lines.map((l) => `${l.skuId}:${l.quantity}`).join(',');
  const checks = useAsync(() => catalog.checkCart(lines), [catalog, key], lines.length > 0);
  const issues: Record<string, LineIssue[]> = {};
  for (const l of lines) issues[l.skuId] = checkLine(l, checks.data?.checks[l.skuId]);
  const blocking = Object.values(issues).some((list) => list.some(isBlocking));
  // Some facts unknown (a service was down): not blocking (unknown ≠ unavailable), but the shopper is told.
  const incomplete = !!checks.error || (checks.data?.failedCalls ?? 0) > 0;
  return { issues, blocking, checking: checks.loading, incomplete, recheck: checks.reload };
}
