import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { calculate } from "../api/calculator";
import { Calculator } from "./Calculator";

vi.mock("../api/calculator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/calculator")>();
  return { ...actual, calculate: vi.fn() };
});

const calculateMock = vi.mocked(calculate);
const user = () => userEvent.setup();
const display = () => within(screen.getByRole("status", { name: "Display" }));

beforeEach(() => calculateMock.mockReset());
afterEach(() => vi.clearAllMocks());

describe("<Calculator />", () => {
  it("renders a keypad and a display showing 0", () => {
    render(<Calculator />);
    expect(screen.getByRole("button", { name: "7" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Equals" })).toBeInTheDocument();
    expect(display().getByText("0")).toBeInTheDocument();
  });

  it("computes 7 − 6 by clicking keys", async () => {
    const u = user();
    calculateMock.mockResolvedValue({ operation: "subtract", a: 7, b: 6, result: 1 });

    render(<Calculator />);
    await u.click(screen.getByRole("button", { name: "7" }));
    await u.click(screen.getByRole("button", { name: "Subtract" }));
    await u.click(screen.getByRole("button", { name: "6" }));
    await u.click(screen.getByRole("button", { name: "Equals" }));

    expect(calculateMock).toHaveBeenCalledWith("subtract", 7, 6);
    await waitFor(() => expect(display().getByText("1")).toBeInTheDocument());
    expect(display().getByText("7 − 6 =")).toBeInTheDocument();
  });

  it("accepts keyboard input", async () => {
    const u = user();
    calculateMock.mockResolvedValue({ operation: "multiply", a: 8, b: 4, result: 32 });

    render(<Calculator />);
    await u.keyboard("8*4{Enter}");

    expect(calculateMock).toHaveBeenCalledWith("multiply", 8, 4);
    await waitFor(() => expect(display().getByText("32")).toBeInTheDocument());
  });

  it("shows a friendly error on division by zero and keeps history", async () => {
    const u = user();
    calculateMock
      .mockResolvedValueOnce({ operation: "add", a: 2, b: 3, result: 5 })
      .mockRejectedValueOnce(new ApiError("DIVISION_BY_ZERO", "x"));

    render(<Calculator />);
    await u.keyboard("2+3=");
    await waitFor(() => expect(display().getByText("5")).toBeInTheDocument());

    await u.keyboard("/0=");
    expect(
      await screen.findByText("You can't divide by zero."),
    ).toBeInTheDocument();

    // History from before the error survives; the next digit clears the error.
    const history = screen.getByRole("region", { name: /history/i });
    expect(within(history).getByText("2 + 3")).toBeInTheDocument();
    await u.keyboard("5");
    expect(display().getByText("5")).toBeInTheDocument();
  });

  it("Clear and Backspace edit the entry", async () => {
    const u = user();
    render(<Calculator />);

    await u.keyboard("789");
    expect(display().getByText("789")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Backspace" }));
    expect(display().getByText("78")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Clear" }));
    expect(display().getByText("0")).toBeInTheDocument();
  });

  it("maps the alternate keyboard keys (x, ^, %, comma, Escape)", async () => {
    const u = user();
    calculateMock.mockResolvedValue({ operation: "power", a: 2, b: 10, result: 1024 });

    render(<Calculator />);
    await u.keyboard("2^10{Enter}");
    expect(calculateMock).toHaveBeenLastCalledWith("power", 2, 10);
    await waitFor(() => expect(display().getByText("1024")).toBeInTheDocument());

    calculateMock.mockResolvedValue({ operation: "multiply", a: 3, b: 4, result: 12 });
    await u.keyboard("{Escape}3x4=");
    expect(calculateMock).toHaveBeenLastCalledWith("multiply", 3, 4);

    calculateMock.mockResolvedValue({ operation: "percentage", a: 1.5, b: 200, result: 3 });
    await u.keyboard("{Escape}1,5%200=");
    expect(calculateMock).toHaveBeenLastCalledWith("percentage", 1.5, 200);
  });

  it("ignores keystrokes that carry a modifier", async () => {
    const u = user();
    render(<Calculator />);
    await u.keyboard("{Control>}5{/Control}");
    expect(display().getByText("0")).toBeInTheDocument();
  });

  it("supports '.' decimal, Backspace, Delete, and ignores unhandled keys", async () => {
    const u = user();
    render(<Calculator />);

    await u.keyboard("3.5");
    expect(display().getByText("3.5")).toBeInTheDocument();

    await u.keyboard("q"); // unhandled -> no-op
    expect(display().getByText("3.5")).toBeInTheDocument();

    await u.keyboard("{Backspace}");
    expect(display().getByText("3.")).toBeInTheDocument();

    await u.keyboard("{Delete}");
    expect(display().getByText("0")).toBeInTheDocument();
  });

  it("subtracts via the '-' key", async () => {
    const u = user();
    calculateMock.mockResolvedValue({ operation: "subtract", a: 9, b: 4, result: 5 });
    render(<Calculator />);
    await u.keyboard("9-4{Enter}");
    expect(calculateMock).toHaveBeenCalledWith("subtract", 9, 4);
    await waitFor(() => expect(display().getByText("5")).toBeInTheDocument());
  });

  it("logs results to history", async () => {
    const u = user();
    calculateMock.mockResolvedValue({ operation: "add", a: 2, b: 3, result: 5 });

    render(<Calculator />);
    await u.keyboard("2+3=");
    await waitFor(() => expect(display().getByText("5")).toBeInTheDocument());

    const history = screen.getByRole("region", { name: /history/i });
    expect(within(history).getByText("2 + 3")).toBeInTheDocument();

    await u.click(within(history).getByRole("button", { name: /clear/i }));
    expect(within(history).queryByText("2 + 3")).not.toBeInTheDocument();
  });
});
