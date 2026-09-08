import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MachineAction } from "../domain/calculatorMachine";
import { Keypad } from "./Keypad";

const ALL_KEYS = [
  "Clear",
  "Backspace",
  "Square root",
  "Power",
  "7",
  "8",
  "9",
  "Divide",
  "4",
  "5",
  "6",
  "Multiply",
  "1",
  "2",
  "3",
  "Subtract",
  "Negate",
  "0",
  "Decimal point",
  "Add",
  "Percent",
  "Equals",
];

describe("<Keypad />", () => {
  it("renders every key", () => {
    render(<Keypad onAction={() => {}} />);
    for (const name of ALL_KEYS) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("emits the right action for each kind of key", async () => {
    const u = userEvent.setup();
    const onAction = vi.fn<(a: MachineAction) => void>();
    render(<Keypad onAction={onAction} />);

    const cases: Array<[string, MachineAction]> = [
      ["7", { type: "digit", value: "7" }],
      ["0", { type: "digit", value: "0" }],
      ["Decimal point", { type: "decimal" }],
      ["Add", { type: "operator", op: "add" }],
      ["Divide", { type: "operator", op: "divide" }],
      ["Power", { type: "operator", op: "power" }],
      ["Percent", { type: "operator", op: "percentage" }],
      ["Square root", { type: "unary", op: "sqrt" }],
      ["Negate", { type: "negate" }],
      ["Backspace", { type: "backspace" }],
      ["Clear", { type: "clear" }],
      ["Equals", { type: "equals" }],
    ];

    for (const [name, action] of cases) {
      onAction.mockClear();
      await u.click(screen.getByRole("button", { name }));
      expect(onAction).toHaveBeenCalledWith(action);
    }
  });
});
