import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { HistoryEntry } from "../hooks/useCalculator";
import { HistoryList } from "./HistoryList";

const make = (n: number): HistoryEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: n - i,
    expression: `${n - i} + 0`,
    result: n - i,
  }));

describe("<HistoryList />", () => {
  it("renders an empty state with no entries and no Clear button", () => {
    render(<HistoryList entries={[]} onClear={() => {}} />);
    expect(screen.getByText(/will show up here/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
  });

  it("pages the list, newest first", async () => {
    const u = userEvent.setup();
    render(<HistoryList entries={make(6)} onClear={() => {}} />);
    const region = screen.getByRole("region", { name: /history/i });

    // Page 1: the newest entries; the oldest are on page 2.
    expect(within(region).getByText("6 + 0")).toBeInTheDocument();
    expect(within(region).queryByText("2 + 0")).not.toBeInTheDocument();
    expect(within(region).getByText("1 / 2")).toBeInTheDocument();

    await u.click(within(region).getByRole("button", { name: /older/i }));
    expect(within(region).getByText("2 + 0")).toBeInTheDocument();
    expect(within(region).getByText("1 + 0")).toBeInTheDocument();
    expect(within(region).getByText("2 / 2")).toBeInTheDocument();

    await u.click(within(region).getByRole("button", { name: /newer/i }));
    expect(within(region).getByText("1 / 2")).toBeInTheDocument();
  });

  it("shows no pager when everything fits on one page", () => {
    render(<HistoryList entries={make(3)} onClear={() => {}} />);
    expect(screen.queryByText(/\/ \d/)).not.toBeInTheDocument();
  });

  it("calls onClear from the Clear button", async () => {
    const u = userEvent.setup();
    const onClear = vi.fn();
    render(<HistoryList entries={make(2)} onClear={onClear} />);
    await u.click(screen.getByRole("button", { name: /clear/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
