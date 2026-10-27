import { useState } from 'react';
import { normaliseHours, type Store } from '../../../domain/store';
import { useAction } from '../../../shared/lib/async';
import { DAY_LABEL, formatDateTime } from '../../../shared/lib/format';
import { useServices } from '../../../shared/lib/services';
import { Button, ButtonLink, Card, ErrorBox, Toast } from '../../../shared/ui/ui';
import { storeBase } from '../paths';
import { StorePage, StoreStatusBadge } from './storeShared';

export function StoreOverviewPage({ merchantId, storeId }: { merchantId: string; storeId: string }) {
  const [toast, setToast] = useState<string | null>(null);
  return (
    <StorePage
      merchantId={merchantId}
      storeId={storeId}
      title="Store overview"
      actions={
        <>
          <a href={`/shop/${merchantId}/${storeId}`} className="btn">
            View as shopper
          </a>
          <ButtonLink to={`${storeBase(merchantId, storeId)}/products/new`} variant="primary">
            + Product
          </ButtonLink>
        </>
      }
    >
      {(s, setStore) => (
        <>
          <Overview
            store={s}
            merchantId={merchantId}
            onUpdated={(next, msg) => {
              setStore(next);
              setToast(msg);
            }}
          />
          <Toast message={toast} onDone={() => setToast(null)} />
        </>
      )}
    </StorePage>
  );
}

function Overview({ store, merchantId, onUpdated }: { store: Store; merchantId: string; onUpdated: (s: Store, m: string) => void }) {
  const { stores } = useServices();
  const close = useAction(() => stores.close(merchantId, store.id));
  const reopen = useAction(() => stores.reopen(merchantId, store.id));
  const a = store.address;
  const c = store.config;
  const addressText = [a?.addressLine1, a?.addressLine2, a?.ward, a?.district, a?.city ?? a?.province].filter(Boolean).join(', ');
  const base = storeBase(merchantId, store.id);

  return (
    <div className="grid grid-2">
      <Card title="Details">
        <dl className="kv">
          <dt>Status</dt>
          <dd>
            <StoreStatusBadge status={store.status} />
          </dd>
          <dt>Email</dt>
          <dd>{store.email || '—'}</dd>
          <dt>Phone</dt>
          <dd>{store.phone || '—'}</dd>
          <dt>Address</dt>
          <dd>{addressText || '—'}</dd>
          <dt>Created</dt>
          <dd>{formatDateTime(store.createdAt)}</dd>
          <dt>Updated</dt>
          <dd>{formatDateTime(store.updatedAt)}</dd>
        </dl>
        <div style={{ height: 16 }} />
        <ErrorBox error={close.error ?? reopen.error} />
        <div className="row" style={{ marginTop: 8 }}>
          {store.status === 'CLOSED' ? (
            <Button
              variant="primary"
              loading={reopen.pending}
              onClick={async () => {
                const s = await reopen.run();
                if (s) onUpdated(s, 'Store reopened');
              }}
            >
              Reopen store
            </Button>
          ) : (
            <Button
              variant="danger"
              loading={close.pending}
              onClick={async () => {
                if (!window.confirm('Close this store? Shoppers will not be able to order.')) return;
                const s = await close.run();
                if (s) onUpdated(s, 'Store closed');
              }}
            >
              Close store
            </Button>
          )}
        </div>
      </Card>
      <Card title="Sales" actions={<ButtonLink to={`${base}/settings`}>Edit</ButtonLink>}>
        <dl className="kv">
          <dt>Order acceptance</dt>
          <dd>{c?.autoAcceptOrder ? 'Automatic' : 'Manual'}</dd>
          <dt>Pre-orders</dt>
          <dd>{c?.allowPreOrder ? 'Allowed' : 'Not allowed'}</dd>
          <dt>Preparation</dt>
          <dd>{c?.preparationTimeMinutes ?? '—'} min</dd>
          <dt>Max per day</dt>
          <dd>{c?.maxOrdersPerDay ?? 'No limit'}</dd>
          <dt>Time zone</dt>
          <dd>{c?.timeZone ?? '—'}</dd>
        </dl>
        <div style={{ height: 12 }} />
        <h3 style={{ marginBottom: 6 }}>Business hours</h3>
        <dl className="kv">
          {normaliseHours(store.businessHours).map((h) => (
            <div key={h.dayOfWeek} style={{ display: 'contents' }}>
              <dt>{DAY_LABEL[h.dayOfWeek]}</dt>
              <dd>{h.closed ? <span className="muted">Closed</span> : `${h.openingTime} – ${h.closingTime}`}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
