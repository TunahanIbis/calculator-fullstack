import { render, screen, within } from "@testing-library/react";
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

beforeEach(() => {
  calculateMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Fresh user-event session per call; safe to interleave with assertions. */
const user = () => userEvent.setup();

/** Scopes queries to the result panel (its value also echoes into history). */
const resultPanel = () => within(screen.getByRole("status", { name: "Result" }));

describe("<Calculator />", () => {
  it("submits the chosen operation and shows the formatted result", async () => {
    const u = user();
    calculateMock.mockResolvedValue({
      operation: "multiply",
      a: 6,
      b: 7,
      result: 42,
    });

    render(<Calculator />);

    await u.click(screen.getByRole("radio", { name: "Multiply" }));
    await u.type(screen.getByLabelText(/value a/i), "6");
    await u.type(screen.getByLabelText(/value b/i), "7");
    await u.click(screen.getByRole("button", { name: /^calculate$/i }));

    expect(calculateMock).toHaveBeenCalledWith("multiply", 6, 7);
    expect(await resultPanel().findByText("42")).toBeInTheDocument();
    expect(resultPanel().getByText("6 × 7 =")).toBeInTheDocument();
  });

  it("hides operand b when a unary operation is selected", async () => {
    const u = user();
    render(<Calculator />);

    expect(screen.getByLabelText(/value b/i)).toBeInTheDocument();
    await u.click(screen.getByRole("radio", { name: "Square root" }));
    expect(screen.queryByLabelText(/value b/i)).not.toBeInTheDocument();
  });

  it("validates input locally and never calls the API for bad input", async () => {
    const u = user();
    render(<Calculator />);

    await u.type(screen.getByLabelText(/value a/i), "abc");
    await u.type(screen.getByLabelText(/value b/i), "2");
    await u.click(screen.getByRole("button", { name: /^calculate$/i }));

    expect(calculateMock).not.toHaveBeenCalled();
    expect(screen.getByText("Not a valid number")).toBeInTheDocument();
    expect(screen.getByText(/please fix the highlighted/i)).toBeInTheDocument();
  });

  it("shows a friendly message when the API rejects the calculation", async () => {
    const u = user();
    calculateMock.mockRejectedValue(
      new ApiError("DIVISION_BY_ZERO", "division by zero is undefined"),
    );

    render(<Calculator />);

    await u.click(screen.getByRole("radio", { name: "Divide" }));
    await u.type(screen.getByLabelText(/value a/i), "1");
    await u.type(screen.getByLabelText(/value b/i), "0");
    await u.click(screen.getByRole("button", { name: /^calculate$/i }));

    expect(
      await screen.findByText("You can't divide by zero."),
    ).toBeInTheDocument();
  });

  it("appends successful calculations to the history list and can clear it", async () => {
    const u = user();
    calculateMock.mockResolvedValue({ operation: "add", a: 2, b: 3, result: 5 });

    render(<Calculator />);

    await u.type(screen.getByLabelText(/value a/i), "2");
    await u.type(screen.getByLabelText(/value b/i), "3");
    await u.click(screen.getByRole("button", { name: /^calculate$/i }));
    await resultPanel().findByText("5");

    const history = screen.getByRole("region", { name: /history/i });
    expect(within(history).getByText("2 + 3")).toBeInTheDocument();

    await u.click(within(history).getByRole("button", { name: /clear/i }));
    expect(within(history).queryByText("2 + 3")).not.toBeInTheDocument();
    expect(within(history).getByText(/show up here/i)).toBeInTheDocument();
  });

  it("paginates history and resets to the first page on a new calculation", async () => {
    const u = user();
    let n = 0;
    calculateMock.mockImplementation(async () => {
      n += 1;
      return { operation: "add", a: n, b: 0, result: n };
    });

    render(<Calculator />);
    await u.type(screen.getByLabelText(/value b/i), "0");

    // Six calculations: 1 + 0 … 6 + 0. Page size is 5.
    for (let i = 1; i <= 6; i += 1) {
      await u.clear(screen.getByLabelText(/value a/i));
      await u.type(screen.getByLabelText(/value a/i), String(i));
      await u.click(screen.getByRole("button", { name: /^calculate$/i }));
      await resultPanel().findByText(String(i));
    }

    const history = screen.getByRole("region", { name: /history/i });
    // Newest first, first page: 6..2 visible, 1 on page two.
    expect(within(history).getByText("6 + 0")).toBeInTheDocument();
    expect(within(history).queryByText("1 + 0")).not.toBeInTheDocument();
    expect(within(history).getByText("1 / 2")).toBeInTheDocument();

    await u.click(within(history).getByRole("button", { name: /older/i }));
    expect(within(history).getByText("1 + 0")).toBeInTheDocument();
    expect(within(history).getByText("2 / 2")).toBeInTheDocument();
  });

  it("validates a field on blur, before Calculate is pressed", async () => {
    const u = user();
    render(<Calculator />);

    await u.type(screen.getByLabelText(/value a/i), "abc");
    await u.tab(); // blur out of the field

    expect(screen.getByText("Not a valid number")).toBeInTheDocument();
    expect(calculateMock).not.toHaveBeenCalled();
  });

  it("submits on Enter from an operand field", async () => {
    const u = user();
    calculateMock.mockResolvedValue({ operation: "add", a: 4, b: 5, result: 9 });

    render(<Calculator />);

    await u.type(screen.getByLabelText(/value a/i), "4");
    await u.type(screen.getByLabelText(/value b/i), "5{Enter}");

    expect(calculateMock).toHaveBeenCalledWith("add", 4, 5);
    expect(await resultPanel().findByText("9")).toBeInTheDocument();
  });
});
