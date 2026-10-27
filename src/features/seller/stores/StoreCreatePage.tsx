import { useState, type FormEvent } from 'react';
import { CURRENCY } from '../../../domain/money';
import { newId } from '../../../domain/ids';
import { DEFAULT_TIME_ZONE, defaultBusinessHours, hoursProblems, type Address } from '../../../domain/store';
import { useAction } from '../../../shared/lib/async';
import { navigate } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Button, Card, Checkbox, ErrorBox, Field, Input, PageHeader } from '../../../shared/ui/ui';
import type { CreateStoreInput } from '../../../ports';
import { merchantBase, storeBase } from '../paths';
import { BusinessHoursEditor, HoursProblems } from './storeShared';

const newUuid = (): string => newId();

export function StoreCreatePage({ merchantId }: { merchantId: string }) {
  const { stores, workspace } = useServices();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Store.ownerId is still a required UUID with no users behind it (open question 31).
  const [ownerId, setOwnerId] = useState(newUuid);
  const [address, setAddress] = useState<Address>({ addressLine1: '', ward: '', district: '', city: 'Ho Chi Minh City', country: 'VN' });
  const [autoAcceptOrder, setAutoAccept] = useState(false);
  const [allowPreOrder, setAllowPreOrder] = useState(true);
  const [prep, setPrep] = useState(15);
  const [maxOrders, setMaxOrders] = useState('');
  const [hours, setHours] = useState(defaultBusinessHours);
  const create = useAction((input: CreateStoreInput) => stores.create(merchantId, input));
  const setAddr = (k: keyof Address) => (e: { target: { value: string } }) => setAddress((a) => ({ ...a, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const s = await create.run({
      code: code.trim(),
      name: name.trim(),
      ownerId,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: { ...address, phone: phone.trim() || undefined },
      config: { autoAcceptOrder, allowPreOrder, timeZone: DEFAULT_TIME_ZONE, currency: CURRENCY, preparationTimeMinutes: prep, maxOrdersPerDay: maxOrders ? Number(maxOrders) : undefined },
      businessHours: hours,
    });
    if (s) {
      workspace.rememberStore({ id: s.id, merchantId, code: s.code, name: s.name });
      navigate(storeBase(merchantId, s.id));
    }
  };

  return (
    <>
      <PageHeader title="New store" crumbs={[{ to: merchantBase(merchantId), label: 'Stores' }, { label: 'New store' }]} />
      <form className="stack" onSubmit={onSubmit}>
        <Card title="Details">
          <div className="grid grid-2">
            <Field label="Store code" hint="unique in your business, max 50">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. Q1-NGUYENHUE" maxLength={50} required />
            </Field>
            <Field label="Store name" hint="shown to shoppers">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tea House Nguyen Hue" maxLength={255} required />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} />
            </Field>
            <Field label="Owner ID" hint="temporary: no user accounts yet">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required className="input mono" />
                <Button size="sm" onClick={() => setOwnerId(newUuid())}>
                  New
                </Button>
              </div>
            </Field>
          </div>
        </Card>
        <Card title="Address">
          <div className="grid grid-2">
            <Field label="Street address">
              <Input value={address.addressLine1 ?? ''} onChange={setAddr('addressLine1')} placeholder="Number, street" />
            </Field>
            <Field label="Ward">
              <Input value={address.ward ?? ''} onChange={setAddr('ward')} />
            </Field>
            <Field label="District">
              <Input value={address.district ?? ''} onChange={setAddr('district')} />
            </Field>
            <Field label="City / province">
              <Input value={address.city ?? ''} onChange={setAddr('city')} />
            </Field>
          </div>
        </Card>
        <Card title="Sales settings">
          <div className="grid grid-2">
            <Field label="Preparation time (minutes)">
              <Input type="number" min={1} value={prep} onChange={(e) => setPrep(Number(e.target.value))} required />
            </Field>
            <Field label="Max orders per day" hint="empty = no limit">
              <Input type="number" min={1} value={maxOrders} onChange={(e) => setMaxOrders(e.target.value)} />
            </Field>
            <Checkbox label="Accept orders automatically" checked={autoAcceptOrder} onChange={setAutoAccept} />
            <Checkbox label="Allow pre-orders" checked={allowPreOrder} onChange={setAllowPreOrder} />
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Time zone {DEFAULT_TIME_ZONE}, currency {CURRENCY} (one market, one currency).
          </p>
        </Card>
        <Card title="Business hours" pad={false}>
          <BusinessHoursEditor value={hours} onChange={setHours} />
        </Card>
        <HoursProblems hours={hours} />
        <ErrorBox error={create.error} title="Could not create the store" />
        <div className="row">
          <Button type="submit" variant="primary" loading={create.pending} disabled={hoursProblems(hours).length > 0}>
            Create store
          </Button>
          <Button variant="ghost" onClick={() => navigate(merchantBase(merchantId))}>
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
