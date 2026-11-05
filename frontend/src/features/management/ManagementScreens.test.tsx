import { createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { App } from '@/app/App';
import { appRoutes } from '@/app/router';
import { clearStoredSession, writeSession } from '@/features/auth/session';
import type { Role, UserSummary } from '@/lib/api/types';
import { testApiUrl } from '@/test/api-url';
import { server } from '@/test/server';

const emptyPage = <T,>(content:T[]=[],totalElements=content.length,page=0,size=20)=>({content,page,size,totalElements,totalPages:Math.ceil(totalElements/size)});
const residentRecord={id:31,fullName:'Unique Resident',email:'resident31@example.test',role:'USER' as const,flatNumber:'B-31',active:true,createdAt:'2026-11-03T08:00:00Z',updatedAt:'2026-11-03T08:00:00Z'};
const adminRecord={id:41,fullName:'Unique Admin',email:'admin41@example.test',role:'ADMIN' as const,flatNumber:null,active:true,createdAt:'2026-11-03T08:00:00Z',updatedAt:'2026-11-03T08:00:00Z'};
const serviceRecord={id:51,name:'Unique Plumbing',description:'Pipe repair',active:true};
const contactRecord={id:61,submittedById:null,name:'Asha Visitor',email:'asha@example.test',subject:'Water question',message:'<script>alert("x")</script> and <img src=x onerror=alert(1)>',createdAt:'2026-11-03T08:00:00Z'};
let consoleError:ReturnType<typeof vi.spyOn>;

function profile(role:Role){return role==='USER'?{...residentRecord}:role==='ADMIN'?{...adminRecord}:{...adminRecord,id:42,fullName:'Unique Super',email:'super@example.test',role:'SUPER_ADMIN' as const};}
function renderApp(path:string,role?:Role){
  if(role){const current=profile(role);writeSession({token:`token-${role}`,expiresAt:'2099-12-31T23:59:59Z',user:current});server.use(http.get(testApiUrl('/auth/me'),()=>HttpResponse.json(current)));}
  const router=createMemoryRouter(appRoutes,{initialEntries:[path]});return{...render(<App router={router}/>),router};
}
function baseHandlers(){
  server.use(
    http.get(testApiUrl('/users'),({request})=>{const role=new URL(request.url).searchParams.get('role');const records:UserSummary[]=role==='ADMIN'?[adminRecord]:[residentRecord];return HttpResponse.json(emptyPage(records));}),
    http.get(testApiUrl('/users/:id'),()=>HttpResponse.json(residentRecord)),
    http.get(testApiUrl('/services'),()=>HttpResponse.json(emptyPage([serviceRecord]))),
    http.get(testApiUrl('/contact-queries'),()=>HttpResponse.json(emptyPage([contactRecord]))),
    http.get(testApiUrl('/contact-queries/:id'),()=>HttpResponse.json(contactRecord)),
    http.get(testApiUrl('/dashboard/summary'),()=>HttpResponse.json({byStatus:{PENDING:0,IN_PROGRESS:0,COMPLETED:0,REJECTED:0},overdueCount:0,totalRequests:0,activeResidents:0,activeAdmins:0})),
    http.get(testApiUrl('/notifications/unread-count'),()=>HttpResponse.json({count:0})),
  );
}

describe('management and contact pages in the production route tree',()=>{
  beforeEach(()=>{server.resetHandlers();baseHandlers();consoleError=vi.spyOn(console,'error').mockImplementation(()=>undefined);});
  afterEach(()=>{cleanup();expect(consoleError).not.toHaveBeenCalled();vi.restoreAllMocks();clearStoredSession();});

  it('creates a resident with the exact payload and maps duplicate email to its field',async()=>{
    const user=userEvent.setup();let posted:unknown;let posts=0;
    server.use(http.post(testApiUrl('/users'),async({request})=>{posted=await request.json();posts+=1;if(posts>1)return HttpResponse.json({timestamp:'2026-11-03T08:00:00Z',status:409,code:'DUPLICATE_RESOURCE',message:'duplicate',path:'/api/v1/users',details:[]},{status:409});return HttpResponse.json(residentRecord,{status:201});}));
    renderApp('/admin/residents','ADMIN');
    await screen.findAllByText('Unique Resident');expect(within(screen.getByRole('table')).getByText('Unique Resident')).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Add resident'}));
    const dialog=screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox',{name:'Full name'}),'Ravi New');
    await user.type(within(dialog).getByRole('textbox',{name:'Email'}),'ravi@example.test');
    await user.type(within(dialog).getByRole('textbox',{name:'Flat number'}),'C-44');
    await user.type(within(dialog).getByLabelText('Initial password *'),'GoodPass123');
    await user.click(within(dialog).getByRole('button',{name:'Create'}));
    await waitFor(()=>expect(posted).toEqual({fullName:'Ravi New',email:'ravi@example.test',password:'GoodPass123',role:'USER',flatNumber:'C-44'}));
    expect(document.body.textContent).not.toContain('GoodPass123');
    await user.click(screen.getByRole('button',{name:'Add resident'}));const second=screen.getByRole('dialog');
    await user.type(within(second).getByRole('textbox',{name:'Full name'}),'Ravi Second');await user.type(within(second).getByRole('textbox',{name:'Email'}),'ravi@example.test');await user.type(within(second).getByRole('textbox',{name:'Flat number'}),'C-45');await user.type(within(second).getByLabelText('Initial password *'),'GoodPass123');await user.click(within(second).getByRole('button',{name:'Create'}));
    expect(await within(second).findByText('An account with this email already exists.')).toBeInTheDocument();
  });

  it('updates users, confirms deactivation, and reactivates with documented bodies',async()=>{
    const user=userEvent.setup();const patches:unknown[]=[];let active=true;let updated:unknown;
    server.use(http.get(testApiUrl('/users'),({request})=>{const role=new URL(request.url).searchParams.get('role');const records:UserSummary[]=role==='ADMIN'?[adminRecord]:[{...residentRecord,active}];return HttpResponse.json(emptyPage(records));}),http.put(testApiUrl('/users/:id'),async({request})=>{updated=await request.json();return HttpResponse.json(residentRecord);}),http.patch(testApiUrl('/users/:id/activation'),async({request})=>{const body=await request.json() as {active:boolean};patches.push(body);active=body.active;return HttpResponse.json({...residentRecord,active});}));
    renderApp('/admin/residents','ADMIN');await screen.findAllByText('Unique Resident');
    const row=within(screen.getByRole('table')).getByText('Unique Resident').closest('tr')!;
    await user.click(within(row).getByRole('button',{name:'Edit'}));const editDialog=screen.getByRole('dialog');await user.clear(within(editDialog).getByRole('textbox',{name:'Full name'}));await user.type(within(editDialog).getByRole('textbox',{name:'Full name'}),'Updated resident');await user.clear(within(editDialog).getByRole('textbox',{name:'Email'}));await user.type(within(editDialog).getByRole('textbox',{name:'Email'}),'updated@example.test');await user.clear(within(editDialog).getByRole('textbox',{name:'Flat number'}));await user.type(within(editDialog).getByRole('textbox',{name:'Flat number'}),'D-4');await user.click(within(editDialog).getByRole('button',{name:'Save changes'}));await waitFor(()=>expect(updated).toEqual({fullName:'Updated resident',email:'updated@example.test',flatNumber:'D-4'}));
    await user.click(within(row).getByRole('button',{name:'Deactivate'}));
    const dialog=screen.getByRole('dialog');expect(within(dialog).getByText(/signed out immediately/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button',{name:'Deactivate'}));
    await waitFor(()=>expect(patches).toEqual([{active:false}]));
    const rowAfter=within(screen.getByRole('table')).getByText('Unique Resident').closest('tr')!;await user.click(within(rowAfter).getByRole('button',{name:'Reactivate'}));await waitFor(()=>expect(patches).toEqual([{active:false},{active:true}]));
  });

  it('creates an ADMIN with no flatNumber and never lists the SUPER_ADMIN account',async()=>{
    const user=userEvent.setup();let posted:unknown;server.use(http.post(testApiUrl('/users'),async({request})=>{posted=await request.json();return HttpResponse.json(adminRecord,{status:201});}));
    renderApp('/admin/admins','SUPER_ADMIN');await screen.findAllByText('Unique Admin');expect(within(screen.getByRole('table')).getByText('Unique Admin')).toBeInTheDocument();expect(within(screen.getByRole('table')).queryByText('Unique Super')).not.toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Add admin'}));const dialog=screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox',{name:'Full name'}),'New admin');await user.type(within(dialog).getByRole('textbox',{name:'Email'}),'newadmin@example.test');await user.type(within(dialog).getByLabelText('Initial password *'),'AdminPass123');await user.click(within(dialog).getByRole('button',{name:'Create'}));
    await waitFor(()=>expect(posted).toEqual({fullName:'New admin',email:'newadmin@example.test',password:'AdminPass123',role:'ADMIN'}));expect(document.body.textContent).not.toContain('AdminPass123');
  });

  it('maps duplicate service names and sends only service fields',async()=>{
    const user=userEvent.setup();let posted:unknown;let posts=0;
    server.use(http.post(testApiUrl('/services'),async({request})=>{posted=await request.json();posts+=1;if(posts>1)return HttpResponse.json({timestamp:'2026-11-03T08:00:00Z',status:409,code:'DUPLICATE_RESOURCE',message:'duplicate',path:'/api/v1/services',details:[]},{status:409});return HttpResponse.json({id:52,name:'Unique service',description:'Details',active:true},{status:201});}));
    renderApp('/admin/services','ADMIN');await screen.findAllByText('Unique Plumbing',{}, {timeout:5000});
    await user.click(screen.getByRole('button',{name:'Add service'}));const dialog=screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox',{name:'Name'}),'Unique service');await user.type(within(dialog).getByRole('textbox',{name:'Description'}),'Details');
    await user.click(within(dialog).getByRole('button',{name:'Create service'}));
    await waitFor(()=>expect(posted).toEqual({name:'Unique service',description:'Details'}));
    await user.click(screen.getByRole('button',{name:'Add service'}));const second=screen.getByRole('dialog');await user.type(within(second).getByRole('textbox',{name:'Name'}),'Unique service');await user.click(within(second).getByRole('button',{name:'Create service'}));expect(await within(second).findByText('A service with this name already exists.')).toBeInTheDocument();
  });

  it('lists and opens messages as literal text, and skips invalid message IDs without calling the API',async()=>{
    let detailCalls=0;server.use(http.get(testApiUrl('/contact-queries/:id'),()=>{detailCalls+=1;return HttpResponse.json(contactRecord);}));
    renderApp('/admin/messages','ADMIN');await screen.findAllByText('Visitor');expect(within(screen.getByRole('table')).getByText('Visitor')).toBeInTheDocument();
    await userEvent.setup().click(within(screen.getByRole('table')).getByRole('link',{name:'Water question'}));
    expect(await screen.findByText(contactRecord.message)).toBeInTheDocument();expect(screen.getByRole('link',{name:contactRecord.email})).toHaveAttribute('href',`mailto:${encodeURIComponent(contactRecord.email)}`);
    expect(document.querySelector('img')).toBeNull();
    cleanup();
    renderApp('/admin/messages/not-a-number','ADMIN');expect(await screen.findByRole('heading',{name:'Message not found'})).toBeInTheDocument();expect(detailCalls).toBe(1);
  });

  it('restricts admin management to SUPER_ADMIN and offers its navigation item only to that role',async()=>{
    renderApp('/admin/admins','ADMIN');expect(await screen.findByRole('heading',{name:'Access denied'})).toBeInTheDocument();expect(screen.queryByRole('link',{name:'Admins'})).not.toBeInTheDocument();
    cleanup();renderApp('/admin/admins','SUPER_ADMIN');expect(await within(await screen.findByRole('table')).findByText('Unique Admin')).toBeInTheDocument();expect(within(screen.getByRole('navigation',{name:'Main navigation'})).getByRole('link',{name:'Admins'})).toBeInTheDocument();
  });

  it('submits anonymous contact without authorization and handles 429 with the wait time',async()=>{
    const user=userEvent.setup();let authHeader:string|null='sentinel';let count=0;
    server.use(http.post(testApiUrl('/contact-queries'),({request})=>{authHeader=request.headers.get('Authorization');count+=1;if(count===1)return HttpResponse.json({id:70,createdAt:'2026-11-03T08:00:00Z'},{status:201});return HttpResponse.json({timestamp:'2026-11-03T08:00:00Z',status:429,code:'TOO_MANY_REQUESTS',message:'limited',path:'/api/v1/contact-queries',details:[]},{status:429,headers:{'Retry-After':'43'}});}));
    renderApp('/contact');await user.type(await screen.findByRole('textbox',{name:'Name'}),'A visitor');await user.type(screen.getByRole('textbox',{name:'Email'}),'visitor@example.test');await user.type(screen.getByRole('textbox',{name:'Subject'}),'A question');await user.type(screen.getByRole('textbox',{name:'Message'}),'Hello there');await user.click(screen.getByRole('button',{name:'Send message'}));
    expect(await screen.findByText('Thanks, we received your message')).toBeInTheDocument();expect(authHeader).toBeNull();
    await user.click(screen.getByRole('button',{name:'Send another message'}));await user.type(screen.getByRole('textbox',{name:'Name'}),'A visitor');await user.type(screen.getByRole('textbox',{name:'Email'}),'visitor@example.test');await user.type(screen.getByRole('textbox',{name:'Subject'}),'Another question');await user.type(screen.getByRole('textbox',{name:'Message'}),'Hello again');await user.click(screen.getByRole('button',{name:'Send message'}));expect(await screen.findByText('Please wait 43 seconds before trying again.')).toBeInTheDocument();
  });

  it('prefills signed-in contact fields and sends the authenticated session',async()=>{
    const user=userEvent.setup();let authHeader:string|null=null;let payload:unknown;
    server.use(http.post(testApiUrl('/contact-queries'),async({request})=>{authHeader=request.headers.get('Authorization');payload=await request.json();return HttpResponse.json({id:71,createdAt:'2026-11-03T08:00:00Z'},{status:201});}));
    renderApp('/contact','USER');expect(await screen.findByRole('textbox',{name:'Name'})).toHaveValue('Unique Resident');expect(screen.getByRole('textbox',{name:'Email'})).toHaveValue('resident31@example.test');
    await user.type(screen.getByRole('textbox',{name:'Subject'}),'A signed-in question');await user.type(screen.getByRole('textbox',{name:'Message'}),'Hello signed in');await user.click(screen.getByRole('button',{name:'Send message'}));await screen.findByText('Thanks, we received your message');
    expect(authHeader).toBe('Bearer token-USER');expect(payload).toEqual({name:'Unique Resident',email:'resident31@example.test',subject:'A signed-in question',message:'Hello signed in'});
  });

  it.each([
    ['/admin/residents','ADMIN','Residents'],['/admin/services','ADMIN','Services'],['/admin/messages','ADMIN','Messages'],['/admin/admins','SUPER_ADMIN','Admins'],['/contact',undefined,'Contact us'],
  ] as const)('loads the real page %s without ComingSoon',async(path,role,title)=>{
    renderApp(path,role);expect(await screen.findByRole('heading',{name:title})).toBeInTheDocument();expect(screen.queryByText(/More community tools will be available here soon/i)).not.toBeInTheDocument();
    if(path==='/admin/residents'||path==='/admin/admins')await screen.findAllByText(path==='/admin/admins'?'Unique Admin':'Unique Resident');
    if(path==='/admin/services')await screen.findAllByText('Unique Plumbing');
    if(path==='/admin/messages')await screen.findAllByText('Water question');
    const results=await axe.run(document.body,{rules:{'color-contrast':{enabled:false}}});expect(results.violations).toEqual([]);
  });
});
