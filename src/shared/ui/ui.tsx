import { Component, useEffect, useRef, useState, type ButtonHTMLAttributes, type ErrorInfo, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { AppError } from '../../domain/errors';
import { safeImageUrl } from '../../domain/catalog';
import { shortId } from '../lib/format';
import { Link } from '../lib/router';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'danger' | 'ghost';
  size?: 'sm';
  loading?: boolean;
};

export function Button({ variant, size, loading, className, children, disabled, type = 'button', ...rest }: BtnProps) {
  const cls = ['btn', variant && `btn-${variant}`, size && `btn-${size}`, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ to, variant, size, children }: { to: string; variant?: 'primary'; size?: 'sm'; children: ReactNode }) {
  const cls = ['btn', variant && `btn-${variant}`, size && `btn-${size}`].filter(Boolean).join(' ');
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label} {hint && <span className="hint">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input className="input" {...p} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select className="select" {...p} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="textarea" {...p} />;

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Card({ title, actions, children, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {pad ? <div className="card-body">{children}</div> : children}
    </section>
  );
}

export function Badge({ tone, children }: { tone?: 'ok' | 'warn' | 'danger' | 'mock'; children: ReactNode }) {
  return <span className={['badge', tone && `badge-${tone}`].filter(Boolean).join(' ')}>{children}</span>;
}

export function ErrorBox({ error, title }: { error?: AppError; title?: string }) {
  if (!error) return null;
  return (
    <div className="notice notice-error" role="alert">
      <strong>{title ?? error.message}</strong>
      {title && <div>{error.message}</div>}
      {error.details.length > 0 && (
        <ul>
          {error.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" aria-hidden /> {label}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function PageHeader({ title, sub, crumbs, actions }: { title: ReactNode; sub?: ReactNode; crumbs?: Array<{ to?: string; label: string }>; actions?: ReactNode }) {
  return (
    <>
      {crumbs && (
        <nav className="crumbs" aria-label="breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className="row" style={{ gap: 6 }}>
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
              {i < crumbs.length - 1 && <span aria-hidden>/</span>}
            </span>
          ))}
        </nav>
      )}
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </header>
    </>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string }>; value: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Shows a short id; click copies the full id. */
export function IdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="id-chip"
      title={`${id} — click to copy`}
      onClick={() => {
        navigator.clipboard?.writeText(id).then(() => setCopied(true), () => undefined);
      }}
    >
      {copied ? 'copied' : shortId(id)}
    </button>
  );
}

export function Notice({ tone, children }: { tone?: 'mock' | 'ok' | 'warn' | 'error'; children: ReactNode }) {
  return (
    <div className={['notice', tone && `notice-${tone}`].filter(Boolean).join(' ')} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

export function MockNotice({ children }: { children: ReactNode }) {
  return <Notice tone="mock">{children}</Notice>;
}

/** Renders only http(s) URLs (merchant input is untrusted); otherwise a neutral placeholder. */
export function Img({ src, alt, className, placeholder = 'No image' }: { src?: string | null; alt: string; className?: string; placeholder?: string }) {
  const safe = safeImageUrl(src);
  return <div className={['thumb', className].filter(Boolean).join(' ')}>{safe ? <img src={safe} alt={alt} loading="lazy" referrerPolicy="no-referrer" /> : <span aria-hidden>{placeholder}</span>}</div>;
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
  return <span className="skeleton" style={{ height, width }} aria-hidden />;
}

export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="row" style={{ justifyContent: 'center', marginTop: 20 }} aria-label="Pages">
      <Button size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>
        ‹ Previous
      </Button>
      <span className="small muted">
        {page + 1} / {totalPages}
      </span>
      <Button size="sm" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>
        Next ›
      </Button>
    </nav>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  // Keep the latest callback without restarting the timer on every parent render.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => done.current(), 2200);
    return () => clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}

/** Last line of defence: a render error shows a message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container page">
        <div className="notice notice-error" role="alert">
          Something went wrong on this page. <a href="/">Go to the home page</a> or reload.
        </div>
      </div>
    );
  }
}
