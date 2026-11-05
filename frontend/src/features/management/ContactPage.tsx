import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, FormField, Input, PageHeader, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import { apiFieldErrors, friendlyErrorMessage } from '@/lib/api/friendly-errors';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCreateContactQuery } from './hooks';
import { contactFormSchema } from './schemas';
import type { ContactQueryRequest } from '@/lib/api/types';

export function ContactPage(){
  useDocumentTitle('Contact us');const{user}=useAuth();const mutation=useCreateContactQuery();const[success,setSuccess]=useState(false);const[formError,setFormError]=useState('');
  const{register,handleSubmit,setError,clearErrors,reset,watch,formState:{errors,isSubmitting}}=useForm<ContactQueryRequest>({resolver:zodResolver(contactFormSchema),defaultValues:{name:user?.fullName??'',email:user?.email??'',subject:'',message:''}});
  const message=watch('message')??'';
  const submit=handleSubmit(async(values)=>{setFormError('');setSuccess(false);clearErrors();try{await mutation.mutateAsync({name:values.name,email:values.email,subject:values.subject,message:values.message});setSuccess(true);reset({name:'',email:'',subject:'',message:''});}catch(cause){if(cause instanceof ApiError&&cause.code==='VALIDATION_ERROR'&&cause.details.length){for(const[field,error]of Object.entries(apiFieldErrors(cause)))if(['name','email','subject','message'].includes(field))setError(field as keyof ContactQueryRequest,{message:error});else setFormError(friendlyErrorMessage(cause));}else setFormError(friendlyErrorMessage(cause));}});
  return <main className="public-page"><PageHeader title="Contact us" description="Send a question to your community team."/><Card className="contact-card">
    {success?<div role="status"><h2>Thanks, we received your message</h2><p>Our community team will review it.</p><Button variant="secondary" onClick={()=>setSuccess(false)}>Send another message</Button></div>:<form onSubmit={submit} noValidate>
      {formError&&<Alert tone="error">{formError}</Alert>}
      <FormField id="contact-name" label="Name" required error={errors.name?.message}><Input autoComplete="name" maxLength={200} {...register('name')}/></FormField>
      <FormField id="contact-email" label="Email" required error={errors.email?.message}><Input type="email" autoComplete="email" maxLength={254} {...register('email')}/></FormField>
      <FormField id="contact-subject" label="Subject" required error={errors.subject?.message}><Input maxLength={300} {...register('subject')}/></FormField>
      <FormField id="contact-message" label="Message" required error={errors.message?.message}><Textarea rows={7} maxLength={3000} {...register('message')}/><span className="character-count">{[...message].length}/2000</span></FormField>
      <Button type="submit" loading={isSubmitting}>Send message</Button>
    </form>}
  </Card><p className="contact-back"><Link to="/login">Sign in</Link> or <Link to="/register">create an account</Link>.</p></main>;
}
