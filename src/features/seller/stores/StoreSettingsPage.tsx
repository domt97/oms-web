import { useState } from 'react';
import { hoursProblems, normaliseHours, type Store, type StoreConfig } from '../../../domain/store';
import { useAction } from '../../../shared/lib/async';
import { useServices } from '../../../shared/lib/services';
import { Button, Card, Checkbox, ErrorBox, Field, Input, Toast } from '../../../shared/ui/ui';
import { BusinessHoursEditor, HoursProblems, StorePage } from './storeShared';

export function StoreSettingsPage({ merchantId, storeId }: { merchantId: string; storeId: string }) {
  const [toast, setToast] = useState<string | null>(null);
  return (
    <StorePage merchantId={merchantId} storeId={storeId} title="Settings & hours">
      {(s, setStore) => {
        const updated = (next: Store, msg: string) => {
          setStore(next);
          setToast(msg);
        };
        return (
          <div className="stack">
            <ConfigForm store={s} merchantId={merchantId} onUpdated={updated} />
            <HoursForm store={s} merchantId={merchantId} onUpdated={updated} />
            <Toast message={toast} onDone={() => setToast(null)} />
          </div>
        );
      }}
    </StorePage>
  );
}

function ConfigForm({ store, merchantId, onUpdated }: { store: Store; merchantId: string; onUpdated: (s: Store, m: string) => void }) {
  const { stores } = useServices();
  const c = store.config;
  const [form, setForm] = useState<StoreConfig>({
    autoAcceptOrder: c?.autoAcceptOrder ?? false,
    allowPreOrder: c?.allowPreOrder ?? false,
    openingTime: c?.openingTime ?? null,
    closingTime: c?.closingTime ?? null,
    timeZone: c?.timeZone ?? 'Asia/Ho_Chi_Minh',
    currency: c?.currency ?? 'VND',
    preparationTimeMinutes: c?.preparationTimeMinutes ?? 15,
    maxOrdersPerDay: c?.maxOrdersPerDay ?? null,
  });
  const save = useAction((body: StoreConfig) => stores.updateConfig(merchantId, store.id, body));
  const set = (patch: Partial<StoreConfig>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Card title="Sales settings">
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const s = await save.run(form);
          if (s) onUpdated(s, 'Settings saved');
        }}
      >
        <div className="grid grid-2">
          <Field label="Preparation time (minutes)">
            <Input type="number" min={1} value={form.preparationTimeMinutes} onChange={(e) => set({ preparationTimeMinutes: Number(e.target.value) })} required />
          </Field>
          <Field label="Max orders per day" hint="empty = no limit">
            <Input type="number" min={1} value={form.maxOrdersPerDay ?? ''} onChange={(e) => set({ maxOrdersPerDay: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Checkbox label="Accept orders automatically" checked={form.autoAcceptOrder} onChange={(v) => set({ autoAcceptOrder: v })} />
          <Checkbox label="Allow pre-orders" checked={form.allowPreOrder} onChange={(v) => set({ allowPreOrder: v })} />
          <Field label="Time zone">
            <Input value={form.timeZone} onChange={(e) => set({ timeZone: e.target.value })} required />
          </Field>
          <Field label="Currency" hint="platform currency">
            <Input value={form.currency} disabled />
          </Field>
        </div>
        <ErrorBox error={save.error} />
        <div>
          <Button type="submit" variant="primary" loading={save.pending}>
            Save settings
          </Button>
        </div>
      </form>
    </Card>
  );
}

function HoursForm({ store, merchantId, onUpdated }: { store: Store; merchantId: string; onUpdated: (s: Store, m: string) => void }) {
  const { stores } = useServices();
  const [hours, setHours] = useState(() => normaliseHours(store.businessHours));
  const save = useAction(() => stores.updateBusinessHours(merchantId, store.id, hours));
  return (
    <Card
      title="Business hours"
      actions={
        <Button
          variant="primary"
          size="sm"
          loading={save.pending}
          disabled={hoursProblems(hours).length > 0}
          onClick={async () => {
            const s = await save.run();
            if (s) onUpdated(s, 'Business hours saved');
          }}
        >
          Save hours
        </Button>
      }
      pad={false}
    >
      {(save.error || hoursProblems(hours).length > 0) && (
        <div className="card-body stack">
          <HoursProblems hours={hours} />
          <ErrorBox error={save.error} />
        </div>
      )}
      <BusinessHoursEditor value={hours} onChange={setHours} />
    </Card>
  );
}
