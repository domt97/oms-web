import { useState, type FormEvent } from 'react';
import { isValidMerchantCode, MERCHANT_CODE_MAX, type Merchant } from '../../../domain/merchant';
import { useAction, useObservable } from '../../../shared/lib/async';
import { navigate } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Button, Card, Empty, ErrorBox, Field, IdChip, Input, PageHeader } from '../../../shared/ui/ui';
import { merchantBase } from '../paths';

/** Register, open or pick a merchant. No login yet (Q36): the merchant id stands in for the session. */
export function MerchantsPage() {
  const { merchants, workspace } = useServices();
  const ws = useObservable(workspace);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const register = useAction(merchants.register);
  const codeInvalid = code.trim() !== '' && !isValidMerchantCode(code);
  const [openId, setOpenId] = useState('');
  const open = useAction(merchants.get);

  const enter = (m: Pick<Merchant, 'id' | 'code' | 'name'>) => {
    workspace.rememberMerchant({ id: m.id, code: m.code, name: m.name });
    navigate(merchantBase(m.id));
  };

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    const m = await register.run(code, name);
    if (m) enter(m);
  };
  const onOpen = async (e: FormEvent) => {
    e.preventDefault();
    const m = await open.run(openId.trim());
    if (m) enter(m);
  };

  return (
    <>
      <PageHeader title="Welcome to the Seller Centre" sub="Register your business or open one you already have." />
      <div className="grid grid-2">
        <Card title="Register a merchant">
          <form className="stack" onSubmit={onRegister}>
            <Field label="Merchant code" hint={`letters and digits, max ${MERCHANT_CODE_MAX}, case-insensitive`}>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. TEAHOUSE" maxLength={MERCHANT_CODE_MAX + 4} required aria-invalid={codeInvalid} />
            </Field>
            {codeInvalid && <div className="small" style={{ color: 'var(--danger)' }}>Use letters (A–Z) and digits only: no spaces, symbols or accents.</div>}
            <Field label="Business name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tea House" maxLength={255} required />
            </Field>
            <ErrorBox error={register.error} />
            <div>
              <Button type="submit" variant="primary" loading={register.pending} disabled={codeInvalid}>
                Register
              </Button>
            </div>
          </form>
        </Card>
        <Card title="Open a merchant by ID">
          <form className="stack" onSubmit={onOpen}>
            <Field label="Merchant ID" hint="the UUID returned on registration">
              <Input value={openId} onChange={(e) => setOpenId(e.target.value)} placeholder="xxxxxxxx-xxxx-…" required />
            </Field>
            <ErrorBox error={open.error} />
            <div>
              <Button type="submit" loading={open.pending}>
                Open
              </Button>
            </div>
            <p className="small muted">Seller sign-in arrives with identity; until then the ID is used.</p>
          </form>
        </Card>
      </div>
      <div style={{ height: 16 }} />
      <Card title="Recently used" pad={false}>
        {ws.merchants.length === 0 ? (
          <Empty>None yet.</Empty>
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
                {ws.merchants.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{m.code}</td>
                    <td>{m.name}</td>
                    <td>
                      <IdChip id={m.id} />
                    </td>
                    <td className="right">
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="primary" onClick={() => enter(m)}>
                          Enter
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => workspace.forgetMerchant(m.id)}>
                          Forget
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
