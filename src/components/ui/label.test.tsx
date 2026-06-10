import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Label } from "./label";
import { Input } from "./input";

describe("Label", () => {
  it("renders its children", () => {
    render(<Label>Email</Label>);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("associates with a control via htmlFor", () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" placeholder="email field" />
      </>,
    );
    // getByLabelText resolves the label→control association.
    expect(screen.getByLabelText("Email")).toBe(
      screen.getByPlaceholderText("email field"),
    );
  });

  it("merges a custom className", () => {
    render(<Label className="extra-label">L</Label>);
    expect(screen.getByText("L").className).toContain("extra-label");
    expect(screen.getByText("L").className).toContain("text-sm");
  });
});
