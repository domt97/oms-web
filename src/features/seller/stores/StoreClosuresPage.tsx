import { useState } from 'react';
import type { AvailabilityType } from '../../../domain/store';
import { useAction, useObservable } from '../../../shared/lib/async';
import { AVAILABILITY_LABEL, formatDateTime } from '../../../shared/lib/format';
import { useServices } from '../../../shared/lib/services';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Select } from '../../../shared/ui/ui';
import { StorePage } from './storeShared';

const TYPES = Object.keys(AVAILABILITY_LABEL) as AvailabilityType[];

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StoreClosuresPage({ merchantId, storeId }: { merchantId: string; storeId: string }) {
  return (
    <StorePage merchantId={merchantId} storeId={storeId} title="Closures">
      {() => <Closures merchantId={merchantId} storeId={storeId} />}
    </StorePage>
  );
}

function Closures({ merchantId, storeId }: { merchantId: string; storeId: string }) {
  const { stores, workspace } = useServices();
  const ws = useObservable(workspace);
  const list = ws.closures?.[storeId] ?? [];
  const [type, setType] = useState<AvailabilityType>('TEMPORARY_CLOSURE');
  const [start, setStart] = useState(() => toLocalInput(new Date()));
  const [end, setEnd] = useState(() => toLocalInput(new Date(Date.now() + 2 * 3600_000)));
  const [reason, setReason] = useState('');
  const add = useAction(() =>
    stores.addClosure(merchantId, storeId, { type, startTime: new Date(start).toISOString(), endTime: end ? new Date(end).toISOString() : undefined, reason: reason.trim() || undefined }),
  );
  // 204 No Content: map success to `true` so a failed call (undefined) can be told apart.
  const cancel = useAction((id: string) => stores.cancelClosure(merchantId, storeId, id).then(() => true));

  return (
    <div className="grid grid-2">
      <Card title="Add a closure">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const a = await add.run();
            if (a) {
              workspace.rememberClosure(a);
              setReason('');
            }
          }}
        >
          <Field label="Reason">
            <Select value={type} onChange={(e) => setType(e.target.value as AvailabilityType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {AVAILABILITY_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <p className="small muted">Times are in your browser's time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}) and sent as exact instants.</p>
          <div className="grid grid-2">
            <Field label="Starts">
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
            </Field>
            <Field label="Ends" hint="optional">
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <Field label="Note">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <ErrorBox error={add.error} />
          <div>
            <Button type="submit" variant="primary" loading={add.pending}>
              Add closure
            </Button>
          </div>
          <p className="small muted">Shoppers do not see closures yet: the "open now" hint uses business hours only (BR-STO-04, partly decided).</p>
        </form>
      </Card>
      <Card title="Created in this browser" pad={false}>
        {cancel.error && (
          <div className="card-body">
            <ErrorBox error={cancel.error} />
          </div>
        )}
        {list.length === 0 ? (
          <Empty>None yet. The backend has no API to list closures.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {AVAILABILITY_LABEL[a.type]}
                      {a.reason && <div className="small muted">{a.reason}</div>}
                    </td>
                    <td className="small">
                      {formatDateTime(a.startTime)} → {a.endTime ? formatDateTime(a.endTime) : 'open-ended'}
                    </td>
                    <td className="right">
                      {a.cancelled ? (
                        <Badge>Cancelled</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={cancel.pending}
                          onClick={async () => {
                            if (await cancel.run(a.id)) workspace.rememberClosure({ ...a, cancelled: true });
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
