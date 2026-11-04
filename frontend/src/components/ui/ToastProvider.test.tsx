import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './index';

function ToastTrigger({ message, tone = 'success' }: { message: string; tone?: 'success' | 'error' }) {
  const toast = useToast();
  return <button type="button" onClick={() => toast(message, tone)}>Show toast</button>;
}

async function advance(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}

describe('ToastProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a success announcement for at least six seconds and preserves the live region', async () => {
    render(<ToastProvider><ToastTrigger message="Saved successfully." /></ToastProvider>);
    const region = screen.getByTestId('toast-region');
    expect(region).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Saved successfully.');
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
    await advance(5_999);
    expect(toast).toBeInTheDocument();
    await advance(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('toast-region')).toBe(region);
  });

  it('keeps long success messages for ten seconds and announces errors assertively', async () => {
    render(<ToastProvider><ToastTrigger message={'A'.repeat(61)} /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    await advance(9_999);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await advance(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    render(<ToastProvider><ToastTrigger message="Could not save." tone="error" /></ToastProvider>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Show toast' }).at(-1)!);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.');
  });

  it('pauses the remaining lifetime while hovered or keyboard-focused', async () => {
    render(<ToastProvider><ToastTrigger message="Still here." /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    const toast = screen.getByRole('status');
    await advance(2_000);
    fireEvent.mouseEnter(toast);
    await advance(20_000);
    expect(toast).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    await advance(3_999);
    expect(toast).toBeInTheDocument();
    await advance(1);
    expect(toast).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    const focusedToast = screen.getByRole('status');
    const dismiss = screen.getByRole('button', { name: 'Dismiss notification' });
    fireEvent.focus(dismiss);
    await advance(20_000);
    expect(focusedToast).toBeInTheDocument();
    fireEvent.blur(dismiss, { relatedTarget: document.body });
    await advance(6_000);
    expect(focusedToast).not.toBeInTheDocument();
  });
});
