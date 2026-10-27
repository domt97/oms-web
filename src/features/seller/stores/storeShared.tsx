import { useEffect, type ReactNode } from 'react';
import { hoursProblems, type BusinessHour, type Store } from '../../../domain/store';
import { useAsync } from '../../../shared/lib/async';
import { DAY_LABEL, STORE_STATUS_LABEL } from '../../../shared/lib/format';
import { useServices } from '../../../shared/lib/services';
import { Badge, ErrorBox, IdChip, Loading, PageHeader } from '../../../shared/ui/ui';
import { merchantBase } from '../paths';

/** Loads a store and remembers it in the workspace (no list API yet). */
export function useStore(merchantId: string, storeId: string) {
  const { stores, workspace } = useServices();
  const state = useAsync(() => stores.get(merchantId, storeId), [stores, merchantId, storeId]);
  useEffect(() => {
    const s = state.data;
    if (s) workspace.rememberStore({ id: s.id, merchantId, code: s.code, name: s.name });
  }, [state.data, merchantId, workspace]);
  return state;
}

export function StoreStatusBadge({ status }: { status: Store['status'] }) {
  return <Badge tone={status === 'ACTIVE' ? 'ok' : status === 'CLOSED' ? 'danger' : 'warn'}>{STORE_STATUS_LABEL[status]}</Badge>;
}

/** Page frame for every per-store page: loads the store, shows header, then renders children with it. */
export function StorePage({ merchantId, storeId, title, actions, children }: { merchantId: string; storeId: string; title: string; actions?: ReactNode; children: (store: Store, setStore: (s: Store) => void) => ReactNode }) {
  const store = useStore(merchantId, storeId);
  if (store.loading && !store.data) return <Loading />;
  if (store.error) return <ErrorBox error={store.error} title="Could not open the store" />;
  const s = store.data!;
  return (
    <>
      <PageHeader
        crumbs={[{ to: merchantBase(merchantId), label: 'Stores' }, { label: s.name }]}
        title={title}
        sub={
          <span className="row">
            <strong>{s.name}</strong>
            <span className="mono">{s.code}</span>
            <StoreStatusBadge status={s.status} />
            <IdChip id={s.id} />
          </span>
        }
        actions={actions}
      />
      {children(s, store.setData)}
    </>
  );
}

export function BusinessHoursEditor({ value, onChange }: { value: BusinessHour[]; onChange: (v: BusinessHour[]) => void }) {
  const set = (i: number, patch: Partial<BusinessHour>) => onChange(value.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Opens</th>
            <th>Closes</th>
            <th>Closed</th>
          </tr>
        </thead>
        <tbody>
          {value.map((h, i) => (
            <tr key={h.dayOfWeek}>
              <td>{DAY_LABEL[h.dayOfWeek]}</td>
              <td>
                <input className="input" type="time" value={h.openingTime ?? ''} disabled={h.closed} onChange={(e) => set(i, { openingTime: e.target.value })} aria-label={`${DAY_LABEL[h.dayOfWeek]} opens`} />
              </td>
              <td>
                <input className="input" type="time" value={h.closingTime ?? ''} disabled={h.closed} onChange={(e) => set(i, { closingTime: e.target.value })} aria-label={`${DAY_LABEL[h.dayOfWeek]} closes`} />
              </td>
              <td>
                <input type="checkbox" checked={h.closed} onChange={(e) => set(i, { closed: e.target.checked })} aria-label={`Closed on ${DAY_LABEL[h.dayOfWeek]}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export function HoursProblems({ hours }: { hours: BusinessHour[] }) {
  const problems = hoursProblems(hours);
  if (problems.length === 0) return null;
  return (
    <div className="notice notice-error" role="alert">
      <strong>Fix the business hours:</strong>
      <ul>
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
