import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./card";

describe("Card", () => {
  it("renders the full composition with children", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>My title</CardTitle>
          <CardDescription>My description</CardDescription>
        </CardHeader>
        <CardContent>Body content</CardContent>
      </Card>,
    );
    expect(screen.getByText("My title")).toBeInTheDocument();
    expect(screen.getByText("My description")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("merges custom classNames onto the base classes", () => {
    render(
      <Card className="extra-card" data-testid="card">
        x
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("extra-card");
  });

  it("CardHeader / CardContent merge their base classes", () => {
    render(
      <>
        <CardHeader className="h-extra" data-testid="header">
          h
        </CardHeader>
        <CardContent className="c-extra" data-testid="content">
          c
        </CardContent>
      </>,
    );
    expect(screen.getByTestId("header").className).toContain("flex");
    expect(screen.getByTestId("header").className).toContain("h-extra");
    expect(screen.getByTestId("content").className).toContain("c-extra");
  });

  it("forwards arbitrary props", () => {
    render(<CardTitle data-testid="title">T</CardTitle>);
    expect(screen.getByTestId("title")).toHaveTextContent("T");
  });
});
