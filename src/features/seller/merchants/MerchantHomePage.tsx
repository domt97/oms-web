import { useEffect, useState, type FormEvent } from 'react';
import { useAction, useAsync, useObservable } from '../../../shared/lib/async';
import { formatDateTime } from '../../../shared/lib/format';
import { Link, navigate } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Badge, Button, ButtonLink, Card, Empty, ErrorBox, Field, IdChip, Input, Loading, PageHeader } from '../../../shared/ui/ui';
import { storeBase } from '../paths';

export function MerchantHomePage({ merchantId }: { merchantId: string }) {
  const { merchants, stores, workspace } = useServices();
  const merchant = useAsync(() => merchants.get(merchantId), [merchants, merchantId]);
  const ws = useObservable(workspace);
  const myStores = ws.stores.filter((s) => s.merchantId === merchantId);

  useEffect(() => {
    const m = merchant.data;
    if (m) workspace.rememberMerchant({ id: m.id, code: m.code, name: m.name });
  }, [merchant.data, workspace]);

  const [storeId, setStoreId] = useState('');
  const open = useAction((id: string) => stores.get(merchantId, id));
  const onOpen = async (e: FormEvent) => {
    e.preventDefault();
    const s = await open.run(storeId.trim());
    if (s) {
      workspace.rememberStore({ id: s.id, merchantId, code: s.code, name: s.name });
      navigate(storeBase(merchantId, s.id));
    }
  };

  if (merchant.loading && !merchant.data) return <Loading />;
  if (merchant.error)
    return (
      <div className="stack">
        <ErrorBox error={merchant.error} title="Could not open the merchant" />
        <div>
          <ButtonLink to="/seller/merchants">Choose another merchant</ButtonLink>
        </div>
      </div>
    );
  const m = merchant.data!;

  return (
    <>
      <PageHeader
        title={m.name}
        sub={
          <span className="row">
            <span className="mono">{m.code}</span>
            <Badge tone={m.status === 'ACTIVE' ? 'ok' : 'danger'}>{m.status === 'ACTIVE' ? 'Active' : 'Suspended'}</Badge>
            <IdChip id={m.id} />
            <span className="small">Registered {formatDateTime(m.createdAt)}</span>
          </span>
        }
        actions={
          <ButtonLink to={`/seller/m/${merchantId}/stores/new`} variant="primary">
            + New store
          </ButtonLink>
        }
      />
      <Card title="Stores" actions={<span className="small muted">{myStores.length} in this browser</span>} pad={false}>
        {myStores.length === 0 ? (
          <Empty>
            No stores yet. <Link to={`/seller/m/${merchantId}/stores/new`}>Create your first store</Link> or open one by ID below.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>ID</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {myStores.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.code}</td>
                    <td>
                      <Link to={storeBase(merchantId, s.id)}>{s.name}</Link>
                    </td>
                    <td>
                      <IdChip id={s.id} />
                    </td>
                    <td className="right">
                      <Button size="sm" variant="ghost" onClick={() => workspace.forgetStore(s.id)}>
                        Hide
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div style={{ height: 16 }} />
      <Card title="Open a store by ID">
        <form className="row" onSubmit={onOpen} style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Field label="Store ID">
              <Input value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="xxxxxxxx-xxxx-…" required />
            </Field>
          </div>
          <Button type="submit" loading={open.pending}>
            Open
          </Button>
        </form>
        <div style={{ height: 8 }} />
        <ErrorBox error={open.error} />
        <p className="small muted">The backend cannot list a merchant's stores yet, so this list shows stores created or opened in this browser.</p>
      </Card>
    </>
  );
}
