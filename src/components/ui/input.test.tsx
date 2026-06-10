import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";

describe("Input", () => {
  it("renders an input with a placeholder", () => {
    render(<Input placeholder="Your name" />);
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
  });

  it("forwards the type attribute", () => {
    render(<Input type="password" placeholder="pw" />);
    expect(screen.getByPlaceholderText("pw")).toHaveAttribute("type", "password");
  });

  it("merges a custom className with the base classes", () => {
    render(<Input className="extra-input" placeholder="x" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.className).toContain("rounded-md");
    expect(el.className).toContain("extra-input");
  });

  it("fires onChange as the user types (controlled)", async () => {
    const onChange = vi.fn();
    render(<Input value="" onChange={onChange} placeholder="t" />);
    await userEvent.type(screen.getByPlaceholderText("t"), "hi");
    expect(onChange).toHaveBeenCalled();
  });

  it("forwards a ref to the underlying input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} placeholder="r" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
