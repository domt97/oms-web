import { useState, type FormEvent } from 'react';
import { useAction, useAsync } from '../../../shared/lib/async';
import { Link } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, Textarea } from '../../../shared/ui/ui';
import { storeBase } from '../paths';
import { StorePage } from '../stores/storeShared';

export function CollectionsPage({ merchantId, storeId }: { merchantId: string; storeId: string }) {
  return (
    <StorePage merchantId={merchantId} storeId={storeId} title="Collections">
      {() => <Collections merchantId={merchantId} storeId={storeId} />}
    </StorePage>
  );
}

function Collections({ merchantId, storeId }: { merchantId: string; storeId: string }) {
  const { collections } = useServices();
  const list = useAsync(() => collections.list(merchantId, storeId), [collections, merchantId, storeId]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useAction(() => collections.create(merchantId, storeId, { name: name.trim(), description: description.trim() || undefined }));
  const base = storeBase(merchantId, storeId);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (await create.run()) {
      setName('');
      setDescription('');
      list.reload();
    }
  };

  return (
    <div className="grid grid-2">
      <Card title="Collections" pad={false}>
        {list.loading && !list.data ? (
          <div className="card-body">
            <Loading />
          </div>
        ) : list.error ? (
          <div className="card-body">
            <ErrorBox error={list.error} />
          </div>
        ) : !list.data?.length ? (
          <Empty>No collections yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="num">Products</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`${base}/collections/${c.id}`}>{c.name}</Link>
                      {c.description && <div className="small muted">{c.description}</div>}
                    </td>
                    <td className="num">{c.productCount}</td>
                    <td>
                      <Badge tone={c.status === 'ACTIVE' ? 'ok' : undefined}>{c.status === 'ACTIVE' ? 'Visible' : 'Hidden'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="New collection">
        <form className="stack" onSubmit={onCreate}>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} required placeholder="e.g. New arrivals" />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </Field>
          <ErrorBox error={create.error} />
          <div>
            <Button type="submit" variant="primary" loading={create.pending}>
              Create collection
            </Button>
          </div>
          <p className="small muted">Add products on the collection's page.</p>
        </form>
      </Card>
    </div>
  );
}
