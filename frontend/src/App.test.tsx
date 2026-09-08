import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("<App />", () => {
  it("renders the page shell and the calculator", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Calculator" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Display" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Equals" })).toBeInTheDocument();
  });
});
