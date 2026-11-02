import { Component, Suspense, type ReactNode } from 'react';
import { RouterProvider, type DataRouter } from 'react-router-dom';
import { Providers } from './Providers';
import { RootErrorFallback } from './pages';

class RootErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* Do not log user data or response bodies. */ }
  render() { return this.state.failed ? <RootErrorFallback /> : this.props.children; }
}

export function App({ router }: { router: DataRouter }) {
  return <RootErrorBoundary><Providers><Suspense fallback={<p role="status">Loading...</p>}><RouterProvider router={router} /></Suspense></Providers></RootErrorBoundary>;
}
