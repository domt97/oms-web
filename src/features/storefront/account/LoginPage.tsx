import { useState, type FormEvent } from 'react';
import { useAction } from '../../../shared/lib/async';
import { navigate, safeReturnPath, useLocation } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Button, Card, ErrorBox, Field, Input, MockNotice } from '../../../shared/ui/ui';

export function LoginPage() {
  const { session } = useServices();
  const { search } = useLocation();
  const next = safeReturnPath(search.get('next'));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const signIn = useAction(session.signIn);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (await signIn.run(name, phone)) navigate(next, { replace: true });
  };

  return (
    <div className="sf-auth stack">
      {search.get('reason') === 'cart' && <div className="notice notice-warn">Sign in to add items to your cart.</div>}
      <Card title="Sign in">
        <form className="stack" onSubmit={onSubmit}>
          <Field label="Your name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </Field>
          <Field label="Phone number" hint="Vietnamese mobile, e.g. 0901 234 567">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" required />
          </Field>
          <ErrorBox error={signIn.error} />
          <Button type="submit" variant="primary" className="btn-lg btn-block" loading={signIn.pending}>
            Continue
          </Button>
        </form>
      </Card>
      <MockNotice>Demo sign-in: no password and no server account yet. The same phone number brings back the same cart and orders on this browser.</MockNotice>
    </div>
  );
}
