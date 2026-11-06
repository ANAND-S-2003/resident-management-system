import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField, Input } from "./index";

describe("FormField accessibility wiring", () => {
  it("associates labels, hints, and validation errors with the form control", () => {
    render(
      <FormField
        id="email"
        label="Email"
        hint="Use your account email."
        error="Enter a valid email."
        required
      >
        <Input />
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("id", "email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-hint email-error");
    expect(input).toHaveAccessibleDescription(
      "Use your account email. Enter a valid email.",
    );
  });
});
