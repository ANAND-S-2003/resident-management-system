import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './index';

describe('Dialog accessibility behavior', () => {
  it('traps focus at both ends, closes with Escape and restores focus', () => {
    const onClose = vi.fn();
    render(<><button>Open</button><Dialog open title="Confirm" onClose={onClose}><button>First</button><button>Last</button></Dialog></>);
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });
    expect(first).toHaveFocus();
    last.focus(); fireEvent.keyDown(document, { key: 'Tab' }); expect(first).toHaveFocus();
    first.focus(); fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(onClose).toHaveBeenCalledOnce();
  });
});
