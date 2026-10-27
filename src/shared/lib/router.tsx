import { Fragment, useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { isUnder, matchPath, type Params } from './paths';

export { isUnder, matchPath, RESERVED_PREFIXES, safeReturnPath, type Params } from './paths';

// Small history-API router (ADR 0001). Swap for react-router when nested layouts/loaders are needed:
// only this module and its call sites change. Pure helpers live in ./paths.

export interface Location {
  path: string;
  search: URLSearchParams;
}

const NAV_EVENT = 'oms:navigate';

function snapshot(): string {
  return window.location.pathname + window.location.search;
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  if (to === snapshot()) return;
  if (options.replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAV_EVENT));
}

/** Current path + query; re-renders on navigation. */
export function useLocation(): Location {
  const url = useSyncExternalStore(subscribe, snapshot);
  const [path, query = ''] = url.split('?');
  return { path: path || '/', search: new URLSearchParams(query) };
}

export interface Route {
  path: string;
  render: (params: Params) => ReactNode;
}

export function Routes({ routes, fallback }: { routes: Route[]; fallback: ReactNode }) {
  const { path } = useLocation();
  // Braces matter: Chrome's scrollTo returns a Promise, and an effect may only return a cleanup function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  for (const route of routes) {
    const params = matchPath(route.path, path);
    // Keyed by path: a new URL gets fresh page state (quantity, selected option, page number).
    if (params) return <Fragment key={path}>{route.render(params)}</Fragment>;
  }
  return <>{fallback}</>;
}

export function Redirect({ to }: { to: string }) {
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to]);
  return null;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };

export function Link({ to, onClick, target, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || target) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} target={target} onClick={handle} {...rest} />;
}

export function NavLink({ to, exact, className, ...rest }: LinkProps & { exact?: boolean }) {
  const { path } = useLocation();
  const base = to.split('?')[0];
  const active = exact ? path === base : isUnder(path, base);
  return <Link to={to} aria-current={active ? 'page' : undefined} className={[className, active ? 'active' : ''].filter(Boolean).join(' ')} {...rest} />;
}
