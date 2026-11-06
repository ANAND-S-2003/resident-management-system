import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ConfirmDialog, Dialog } from "./index";

function ModalHarness({ confirmation = false }: { confirmation?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <button onClick={() => setOpen(true)}>Open modal</button>
      <h1>Page heading</h1>
      {confirmation ? (
        <ConfirmDialog
          open={open}
          title="Confirm action"
          onClose={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        >
          Are you sure?
        </ConfirmDialog>
      ) : (
        <Dialog open={open} title="Modal title" onClose={() => setOpen(false)}>
          <button onClick={() => setOpen(false)}>Close modal</button>
          <button>Last action</button>
        </Dialog>
      )}
    </main>
  );
}

describe.each([
  { name: "Dialog", confirmation: false },
  { name: "ConfirmDialog", confirmation: true },
])("$name focus management", ({ confirmation }) => {
  it("moves focus into the modal, traps Tab, and restores the opener after Escape", async () => {
    const user = userEvent.setup();
    render(<ModalHarness confirmation={confirmation} />);
    const opener = screen.getByRole("button", { name: "Open modal" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog");
    const firstAction = confirmation
      ? screen.getByRole("button", { name: "Cancel" })
      : screen.getByRole("button", { name: "Close modal" });
    expect(firstAction).toHaveFocus();
    expect(opener).toHaveAttribute("inert");
    expect(opener).toHaveAttribute("aria-hidden", "true");

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(
      confirmation
        ? screen.getByRole("button", { name: "Confirm" })
        : screen.getByRole("button", { name: "Last action" }),
    ).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(firstAction).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(opener).toHaveFocus());
    expect(dialog).not.toBeInTheDocument();
    expect(opener).not.toHaveAttribute("inert");
    expect(opener).not.toHaveAttribute("aria-hidden");
  });

  it("closes on backdrop click, restores focus, and restores background attributes", async () => {
    const user = userEvent.setup();
    render(<ModalHarness confirmation={confirmation} />);
    const opener = screen.getByRole("button", { name: "Open modal" });
    await user.click(opener);
    const backdrop = document.querySelector(".dialog-backdrop");
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as HTMLElement);
    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).not.toHaveAttribute("inert");
    expect(opener).not.toHaveAttribute("aria-hidden");
  });

  it("restores focus after its visible close action", async () => {
    const user = userEvent.setup();
    render(<ModalHarness confirmation={confirmation} />);
    const opener = screen.getByRole("button", { name: "Open modal" });
    await user.click(opener);
    await user.click(
      confirmation
        ? screen.getByRole("button", { name: "Cancel" })
        : screen.getByRole("button", { name: "Close modal" }),
    );
    await waitFor(() => expect(opener).toHaveFocus());
    expect(opener).not.toHaveAttribute("inert");
    expect(opener).not.toHaveAttribute("aria-hidden");
  });
});
