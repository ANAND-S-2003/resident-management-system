import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Dialog, EmptyState, ErrorState, FormField, Input, PageHeader, Pagination, Select, Skeleton, useToast } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import { friendlyErrorMessage } from '@/lib/api/friendly-errors';
import type { FieldError, Role, UserSummary } from '@/lib/api/types';
import { ROLES } from '@/lib/constants';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useAuth } from '@/features/auth/AuthProvider';
import { adminCreateSchema, adminEditSchema, residentCreateSchema, residentEditSchema } from './schemas';
import { useCreateUser, useSetUserActive, useUpdateUser, useUsers } from './hooks';
import { ActivationBadge, ListToolbar } from './components';
import { mayManageUser } from './user-policy';

const USER_SORTS = ['createdAt,desc','createdAt,asc','fullName,asc','fullName,desc','email,asc','email,desc','role,asc','role,desc'] as const;
const DEFAULT_SORT = USER_SORTS[0];
const SIZES = [10,20,50,100];
type FormErrors = Record<string, string>;

function readState(search: URLSearchParams) {
  const rawPage = Number(search.get('page')); const rawSize = Number(search.get('size')); const rawSort = search.get('sort'); const activeRaw = search.get('active');
  return { q: [...(search.get('q') ?? '').trim()].slice(0,100).join(''), page: Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0, size: search.get('size') === null ? 20 : Number.isInteger(rawSize) ? Math.min(100,Math.max(1,rawSize)) : 20, sort: (USER_SORTS as readonly string[]).includes(rawSort ?? '') ? rawSort! : DEFAULT_SORT, active: activeRaw === 'true' || activeRaw === 'false' ? activeRaw : '' };
}

export function UserManagementPage({ adminsOnly = false }: { adminsOnly?: boolean }) {
  const role: Role = adminsOnly ? ROLES[1] : ROLES[0];
  const title = adminsOnly ? 'Admins' : 'Residents';
  useDocumentTitle(title);
  const [search, setSearch] = useSearchParams(); const state = readState(search);
  const params = { role, ...(state.q ? { q: state.q } : {}), ...(state.active ? { active: state.active === 'true' } : {}), page: state.page, size: state.size, sort: state.sort };
  const users = useUsers(params); const { user: actor } = useAuth(); const toast = useToast();
  const create = useCreateUser();
  const [createOpen, setCreateOpen] = useState(false); const [editingId, setEditingId] = useState<number | null>(null); const [activationId, setActivationId] = useState<number | null>(null);
  const records = users.data?.content ?? [];
  const editing = records.find((item) => item.id === editingId);
  const activationTarget = records.find((item) => item.id === activationId);
  const updateSearch = (changes: Record<string,string | null>, resetPage = true) => { const next = new URLSearchParams(search); for (const [key,value] of Object.entries(changes)) { if (value) next.set(key,value); else next.delete(key); } if (resetPage) next.delete('page'); setSearch(next); };

  if (users.isLoading) return <><PageHeader title={title} /><Skeleton className="list-skeleton" /><Skeleton className="list-skeleton" /></>;
  if (users.isError) return <><PageHeader title={title} /><ErrorState error={users.error} onRetry={() => void users.refetch()} /></>;
  return <>
    <PageHeader title={title} description={adminsOnly ? 'Manage administrator accounts.' : 'Manage resident accounts.'} actions={<Button onClick={() => setCreateOpen(true)}>Add {adminsOnly ? 'admin' : 'resident'}</Button>} />
    <Card><ListToolbar query={state.q} onQuery={(q) => updateSearch({ q: q || null })} placeholder={adminsOnly ? 'Search by name or email' : 'Search by resident name or email'} onClear={() => { setSearch(new URLSearchParams()); }}>
      <FormField id="user-active-filter" label="Status"><Select value={state.active} onChange={(event) => updateSearch({ active: event.target.value || null })}><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></Select></FormField>
      <FormField id="user-sort-filter" label="Sort"><Select value={state.sort} onChange={(event) => updateSearch({ sort: event.target.value })}>{USER_SORTS.map((sort) => <option key={sort} value={sort}>{sortLabel(sort)}</option>)}</Select></FormField>
      <FormField id="user-size-filter" label="Page size"><Select value={state.size} onChange={(event) => updateSearch({ size: event.target.value })}>{SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</Select></FormField>
    </ListToolbar></Card>
    {records.length === 0 ? <Card><EmptyState title={state.q || state.active ? 'No accounts match these filters' : `No ${adminsOnly ? 'admins' : 'residents'} yet`}>Adjust the filters or add an account.</EmptyState></Card> : <>
      <div className="management-table-wrap"><table className="management-table"><thead><tr><th>Name</th><th>Email</th>{!adminsOnly && <th>Flat number</th>}<th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{records.map((record) => <UserRow key={record.id} record={record} actorRole={actor!.role} actorId={actor!.id} adminsOnly={adminsOnly} onEdit={() => setEditingId(record.id)} onDeactivate={() => setActivationId(record.id)} />)}</tbody></table></div>
      <div className="management-cards">{records.map((record) => <UserCard key={record.id} record={record} actorRole={actor!.role} actorId={actor!.id} adminsOnly={adminsOnly} onEdit={() => setEditingId(record.id)} onDeactivate={() => setActivationId(record.id)} />)}</div>
      <Pagination page={state.page} size={state.size} totalElements={users.data?.totalElements ?? 0} onPageChange={(page) => updateSearch({ page: String(page) }, false)} onSizeChange={(size) => updateSearch({ size: String(size) })} />
    </>}
    <UserFormDialog open={createOpen} title={`Add ${adminsOnly ? 'admin' : 'resident'}`} adminsOnly={adminsOnly} onClose={() => setCreateOpen(false)} onSubmit={async (values) => {
      await create.mutateAsync({ ...values, role }); toast(`${adminsOnly ? 'Admin' : 'Resident'} created successfully.`); setCreateOpen(false);
    }} saving={create.isPending} />
    {editing && <UserEditDialog key={`edit-${editing.id}`} record={editing} adminsOnly={adminsOnly} onClose={() => setEditingId(null)} />}
    {activationTarget && <ActivationDialog record={activationTarget} adminsOnly={adminsOnly} actorId={actor!.id} onClose={() => setActivationId(null)} />}
  </>;
}

function UserRow({ record, actorRole, actorId, adminsOnly, onEdit, onDeactivate }: { record: UserSummary; actorRole: Role; actorId: number; adminsOnly: boolean; onEdit: () => void; onDeactivate: () => void }) {
  return <tr><td>{record.fullName}</td><td>{record.email}</td>{!adminsOnly && <td>{record.flatNumber}</td>}<td><ActivationBadge active={record.active} /></td><td>{record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '-'}</td><td className="management-actions"><UserActionButtons record={record} actorRole={actorRole} actorId={actorId} onEdit={onEdit} onDeactivate={onDeactivate}/></td></tr>;
}
function UserCard({ record, actorRole, actorId, adminsOnly, onEdit, onDeactivate }: { record: UserSummary; actorRole: Role; actorId: number; adminsOnly: boolean; onEdit: () => void; onDeactivate: () => void }) {
  return <Card className="management-card"><h2>{record.fullName}</h2><p>{record.email}</p>{!adminsOnly && <p>Flat {record.flatNumber}</p>}<ActivationBadge active={record.active} /><div className="management-actions"><UserActionButtons record={record} actorRole={actorRole} actorId={actorId} onEdit={onEdit} onDeactivate={onDeactivate}/></div></Card>;
}

function UserActionButtons({record,actorRole,actorId,onEdit,onDeactivate}:{record:UserSummary;actorRole:Role;actorId:number;onEdit:()=>void;onDeactivate:()=>void}){
  const mutation=useSetUserActive(record.id);const toast=useToast();const canEdit=mayManageUser(actorRole,record.role,'edit',actorId,record.id);const canToggle=mayManageUser(actorRole,record.role,record.active?'deactivate':'activate',actorId,record.id);
  const reactivate=()=>mutation.mutate({active:true},{onSuccess:()=>toast('Account reactivated.'),onError:(error)=>toast(friendlyErrorMessage(error),'error')});
  return <>{canEdit&&<Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>}{canToggle&&<Button variant={record.active?'danger':'secondary'} size="sm" loading={mutation.isPending} onClick={record.active?onDeactivate:reactivate}>{record.active?'Deactivate':'Reactivate'}</Button>}</>;
}

function UserFormDialog({ open, title, adminsOnly, onClose, onSubmit, saving }: { open: boolean; title: string; adminsOnly: boolean; onClose: () => void; onSubmit: (body: { fullName: string; email: string; password: string; flatNumber?: string }) => Promise<void>; saving: boolean }) {
  const [values, setValues] = useState({ fullName: '', email: '', flatNumber: '', password: '' }); const [errors, setErrors] = useState<FormErrors>({}); const [showPassword, setShowPassword] = useState(false); const [formError, setFormError] = useState('');
  const schema = adminsOnly ? adminCreateSchema : residentCreateSchema;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setErrors({}); setFormError('');
    const result = schema.safeParse(values);
    if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
    try {
      const body = adminsOnly ? adminCreateSchema.parse(values) : residentCreateSchema.parse(values);
      await onSubmit(body);
      setValues({ fullName: '', email: '', flatNumber: '', password: '' });
    }
    catch (error) { mapFormError(error, setErrors, setFormError); }
    finally { setValues((current) => ({ ...current, password: '' })); }
  };
  return <Dialog open={open} title={title} onClose={onClose}><form onSubmit={submit} noValidate>
    {formError && <Alert tone="error">{formError}</Alert>}
    <FormField id="create-fullName" label="Full name" required error={errors.fullName}><Input autoComplete="name" value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} /></FormField>
    <FormField id="create-email" label="Email" required error={errors.email}><Input type="email" autoComplete="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></FormField>
    {!adminsOnly && <FormField id="create-flat" label="Flat number" required error={errors.flatNumber}><Input value={values.flatNumber} onChange={(e) => setValues({ ...values, flatNumber: e.target.value })} /></FormField>}
    <FormField id="create-password" label="Initial password" required error={errors.password}><div className="password-control"><Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button></div></FormField>
    <div className="dialog-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>Create</Button></div>
  </form></Dialog>;
}

function UserEditDialog({ record, adminsOnly, onClose }: { record: UserSummary; adminsOnly: boolean; onClose: () => void }) {
  const mutation = useUpdateUser(record.id); const toast = useToast(); const [errors, setErrors] = useState<FormErrors>({}); const [formError, setFormError] = useState('');
  const [fullName, setFullName] = useState(record.fullName); const [email, setEmail] = useState(record.email); const [flatNumber, setFlatNumber] = useState(record.flatNumber ?? '');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setErrors({}); setFormError(''); const schema = adminsOnly ? adminEditSchema : residentEditSchema; const parsed = schema.safeParse({ fullName, email, flatNumber }); if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
    try { const body = adminsOnly ? { ...adminEditSchema.parse({ fullName, email }), flatNumber: null } : residentEditSchema.parse({ fullName, email, flatNumber }); await mutation.mutateAsync(body); toast('Account updated successfully.'); onClose(); } catch (error) { mapFormError(error, setErrors, setFormError); }
  };
  return <Dialog open title={`Edit ${adminsOnly ? 'admin' : 'resident'}`} onClose={onClose}><form onSubmit={submit} noValidate>{formError && <Alert tone="error">{formError}</Alert>}
    <FormField id="edit-fullName" label="Full name" required error={errors.fullName}><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></FormField><FormField id="edit-email" label="Email" required error={errors.email}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>{!adminsOnly && <FormField id="edit-flat" label="Flat number" required error={errors.flatNumber}><Input value={flatNumber} onChange={(e) => setFlatNumber(e.target.value)} /></FormField>}
    <div className="dialog-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={mutation.isPending}>Save changes</Button></div></form></Dialog>;
}

function ActivationDialog({ record, adminsOnly, actorId, onClose }: { record: UserSummary; adminsOnly: boolean; actorId: number; onClose: () => void }) {
  const mutation = useSetUserActive(record.id); const toast = useToast(); const deactivate = record.active; const allowed = mayManageUser(adminsOnly ? ROLES[2] : ROLES[1], record.role, deactivate ? 'deactivate' : 'activate', actorId, record.id);
  const [error, setError] = useState('');
  const apply = async () => { setError(''); try { await mutation.mutateAsync({ active: !deactivate }); toast(`${adminsOnly ? 'Admin' : 'Resident'} ${deactivate ? 'deactivated' : 'reactivated'}.`); onClose(); } catch (cause) { setError(friendlyErrorMessage(cause)); } };
  return <Dialog open title={`${deactivate ? 'Deactivate' : 'Reactivate'} ${adminsOnly ? 'admin' : 'resident'}`} onClose={onClose}><p>{deactivate ? 'They will be signed out immediately and can no longer sign in until reactivated.' : `Reactivate ${record.fullName}'s account?`}</p>{error && <Alert tone="error">{error}</Alert>}<div className="dialog-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={deactivate ? 'danger' : 'primary'} loading={mutation.isPending} disabled={!allowed} onClick={() => void apply()}>{deactivate ? 'Deactivate' : 'Reactivate'}</Button></div></Dialog>;
}

function mapFormError(error: unknown, setErrors: (errors: FormErrors) => void, setFormError: (message: string) => void) {
  if (error instanceof ApiError && error.code === 'DUPLICATE_RESOURCE') { setErrors({ email: 'An account with this email already exists.' }); return; }
  if (error instanceof ApiError && error.code === 'VALIDATION_ERROR' && error.details.length) { setErrors(Object.fromEntries(error.details.map((item: FieldError) => [item.field, item.message]))); return; }
  setFormError(friendlyErrorMessage(error));
}
function sortLabel(sort: string) { const [field,dir] = sort.split(','); const label = field === 'createdAt' ? 'Created' : field === 'fullName' ? 'Name' : field === 'email' ? 'Email' : 'Role'; return `${label} (${dir})`; }
