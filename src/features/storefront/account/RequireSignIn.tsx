import type { ReactNode } from 'react';
import { useObservable } from '../../../shared/lib/async';
import { useLocation } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { ButtonLink, Empty } from '../../../shared/ui/ui';

/** BR-USR-02: cart and orders need a customer account. UX guard only — the server must enforce it. */
export function RequireSignIn({ children, what }: { children: ReactNode; what: string }) {
  const { session } = useServices();
  const customer = useObservable(session);
  const { path } = useLocation();
  if (customer) return <>{children}</>;
  return (
    <Empty>
      <div className="stack" style={{ alignItems: 'center' }}>
        <span>Sign in to see {what}.</span>
        <ButtonLink to={`/login?next=${encodeURIComponent(path)}`} variant="primary">
          Sign in
        </ButtonLink>
      </div>
    </Empty>
  );
}
