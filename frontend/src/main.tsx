import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/app/App';
import { createAppRouter } from '@/app/router';
import { branding } from '@/config/branding';
import '@/styles.css';

document.title = branding.appName;
const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
if (description) description.content = branding.tagline;

const router = createAppRouter();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App router={router} /></React.StrictMode>);
