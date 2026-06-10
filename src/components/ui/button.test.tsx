import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("renders its children as a button", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("applies the default variant + size classes", () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole("button", { name: "Default" });
    expect(btn.className).toContain("bg-primary");
    expect(btn.className).toContain("h-10");
  });

  it("applies variant-specific classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" }).className).toContain(
      "bg-destructive",
    );
  });

  it("applies size-specific classes", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button", { name: "Small" }).className).toContain("h-9");
  });

  it("merges a custom className", () => {
    render(<Button className="my-custom">Custom</Button>);
    expect(screen.getByRole("button", { name: "Custom" }).className).toContain(
      "my-custom",
    );
  });

  it("forwards arbitrary props (onClick, disabled)", () => {
    render(<Button disabled>Off</Button>);
    expect(screen.getByRole("button", { name: "Off" })).toBeDisabled();
  });

  it("renders the child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/somewhere">Go</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/somewhere");
    // asChild merges the button classes onto the anchor.
    expect(link.className).toContain("inline-flex");
  });

  it("buttonVariants exposes the variant class generator", () => {
    expect(typeof buttonVariants).toBe("function");
    expect(buttonVariants({ variant: "outline" })).toContain("border");
  });
});
