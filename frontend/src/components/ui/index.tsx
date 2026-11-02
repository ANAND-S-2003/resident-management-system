import { Children, cloneElement, createContext, forwardRef, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { RequestStatus } from '@/lib/api/types';
import { REQUEST_STATUSES } from '@/lib/constants';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md' | 'lg'; loading?: boolean };
/** A consistent action button with visible keyboard focus and an announced loading state. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', loading = false, disabled, type = 'button', children, ...props }, ref) {
  return <button ref={ref} type={type} className={`button button-${variant} button-${size}`} disabled={disabled || loading} aria-busy={loading} {...props}>{loading && <Spinner size="sm" />}{children}</button>;
});
/** A labelled input primitive; use FormField to connect its accessible description and error state. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) { return <input ref={ref} className="control" {...props} />; });
/** A labelled multiline text primitive. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) { return <textarea ref={ref} className="control" {...props} />; });
/** A native keyboard-friendly select primitive. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) { return <select ref={ref} className="control" {...props} />; });

/** Label, hint and validation text with stable IDs for screen-reader descriptions. */
export function FormField({ id, label, hint, error, required, children }: { id: string; label: string; hint?: string; error?: string; required?: boolean; children: ReactNode }) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  const controlProps = { id, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error), required };
  const wireControl = (node: ReactNode): ReactNode => {
    if (!isValidElement<{ children?: ReactNode; id?: string; required?: boolean; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>(node)) return node;
    const control = node.type === Input || node.type === Textarea || node.type === Select || (typeof node.type === 'string' && ['input', 'textarea', 'select'].includes(node.type));
    if (control) {
      const existingDescriptions = node.props['aria-describedby'];
      const ariaDescribedBy = [existingDescriptions, describedBy].filter(Boolean).join(' ') || undefined;
      return cloneElement(node, { ...controlProps, 'aria-describedby': ariaDescribedBy, required: required ?? node.props.required });
    }
    if (node.props.children) return cloneElement(node, { children: Children.map(node.props.children, wireControl) });
    return node;
  };
  return <div className="form-field"><label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label><div className="field-control">{Children.map(children, wireControl)}</div>{hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}{error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}</div>;
}

/** Surface for grouping related content. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }
/** Compact semantic label used for counts and status. */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
/** Status is communicated with wording as well as a color; overdue is a separate label. */
export function StatusBadge({ status, overdue = false }: { status: RequestStatus; overdue?: boolean }) { const tone = status === REQUEST_STATUSES[2] ? 'success' : status === REQUEST_STATUSES[3] ? 'danger' : status === REQUEST_STATUSES[1] ? 'info' : 'warning'; return <span className="status-group"><Badge tone={tone}>{status.replace('_', ' ')}</Badge>{overdue && <Badge tone="danger">Overdue</Badge>}</span>; }
/** Inline message region with assertive announcement reserved for errors. */
export function Alert({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode }) { return <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>; }
/** Small animated progress indicator; its parent provides the accessible status label. */
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) { return <span className={`spinner spinner-${size}`} aria-hidden="true" />; }
/** Decorative loading placeholder hidden from assistive technology. */
export function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton ${className}`} aria-hidden="true" />; }
/** Friendly empty collection state with a clear heading. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) { return <div className="empty-state"><h2>{title}</h2>{children && <p>{children}</p>}</div>; }
/** Standard page heading with optional description and actions. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) { return <div className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions}</div>; }
/** Bounded list controls with item range, page-size selection, and previous/next actions. */
export function Pagination({ page, size, totalElements, onPageChange, onSizeChange }: { page: number; size: number; totalElements: number; onPageChange: (page: number) => void; onSizeChange: (size: number) => void }) {
  const pageSizeId = useId();
  const start = totalElements === 0 ? 0 : page * size + 1;
  const end = Math.min((page + 1) * size, totalElements);
  return <nav className="pagination" aria-label="Pagination"><span>Showing {start}-{end} of {totalElements}</span><label htmlFor={pageSizeId}>Page size</label><Select id={pageSizeId} value={size} onChange={(event) => onSizeChange(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></Select><Button variant="secondary" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>Previous</Button><Button variant="secondary" disabled={end >= totalElements} onClick={() => onPageChange(page + 1)}>Next</Button></nav>;
}

/** Focus-trapped modal that restores focus and closes on Escape. */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null); const previousFocus = useRef<HTMLElement | null>(null); const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  useLayoutEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const changedAttributes: Array<{ element: HTMLElement; inert: string | null; ariaHidden: string | null }> = [];
    let branch: HTMLElement | null = dialogRef.current?.parentElement ?? null;
    while (branch && branch !== document.body) {
      const parent: HTMLElement | null = branch.parentElement;
      if (!parent) break;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
        changedAttributes.push({ element: sibling, inert: sibling.getAttribute('inert'), ariaHidden: sibling.getAttribute('aria-hidden') });
        sibling.setAttribute('inert', '');
        sibling.setAttribute('aria-hidden', 'true');
      }
      branch = parent;
    }
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    (focusable ?? dialog)?.focus();
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'Tab' && dialog) {
        const items = Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((item) => !item.hasAttribute('disabled'));
        if (!items.length) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1]?.focus(); }
        else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', keyHandler); return () => {
      document.removeEventListener('keydown', keyHandler);
      for (const { element, inert, ariaHidden } of changedAttributes) {
        if (inert === null) element.removeAttribute('inert'); else element.setAttribute('inert', inert);
        if (ariaHidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', ariaHidden);
      }
      requestAnimationFrame(() => {
        const opener = previousFocus.current;
        const target = opener?.isConnected && !opener.closest('[inert]') ? opener : document.querySelector<HTMLElement>('main h1, main [role="heading"]');
        if (target?.isConnected) { if (target !== opener) target.setAttribute('tabindex', '-1'); target.focus(); }
      });
    };
  }, [open]);
  if (!open) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}><div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><h2 id={titleId}>{title}</h2>{children}</div></div>;
}
/** Confirmation modal that keeps the same keyboard and focus guarantees as Dialog. */
export function ConfirmDialog(props: { open: boolean; title: string; onClose: () => void; onConfirm: () => void; children: ReactNode }) { return <Dialog open={props.open} title={props.title} onClose={props.onClose}><div>{props.children}</div><div className="dialog-actions"><Button variant="secondary" onClick={props.onClose}>Cancel</Button><Button variant="danger" onClick={props.onConfirm}>Confirm</Button></div></Dialog>; }

interface ToastItem { id: number; message: string }
/** Polite, dismissible transient announcements. */
export function ToastProvider({ children }: { children: ReactNode }) { const [items, setItems] = useState<ToastItem[]>([]); const nextId = useRef(0); const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  useEffect(() => { if (!items.length) return; const timers = items.map((item) => window.setTimeout(() => dismiss(item.id), 5000)); return () => timers.forEach(window.clearTimeout); }, [items, dismiss]);
  const toast = (message: string) => setItems((current) => [...current, { id: ++nextId.current, message }]);
  return <ToastContext.Provider value={toast}>{children}<div className="toast-region" aria-live="polite" aria-relevant="additions text">{items.map((item) => <div className="toast" key={item.id}>{item.message}<button aria-label="Dismiss notification" onClick={() => dismiss(item.id)}><span aria-hidden="true">×</span></button></div>)}</div></ToastContext.Provider>;
}
const ToastContext = createContext<((message: string) => void) | null>(null);
export function useToast() { const toast = useContext(ToastContext); if (!toast) throw new Error('useToast must be used inside ToastProvider'); return toast; }
