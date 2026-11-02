import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './Providers';
import { router } from './router';
import { RootErrorFallback } from './pages';

class RootErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Do not log user data or response bodies. */ }
  render() { return this.state.failed ? <RootErrorFallback /> : this.props.children; }
}

export function App() { return <RootErrorBoundary><Providers><Suspense fallback={<p role="status">Loading...</p>}><RouterProvider router={router} /></Suspense></Providers></RootErrorBoundary>; }
