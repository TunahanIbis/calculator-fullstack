import { useEffect } from "react";

import type { MachineAction } from "../domain/calculatorMachine";
import { useCalculator } from "../hooks/useCalculator";
import { Display } from "./Display";
import { HistoryList } from "./HistoryList";
import { Keypad } from "./Keypad";

/** Maps a physical keyboard event to a machine action, or null if unhandled. */
function keyToAction(event: KeyboardEvent): MachineAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const k = event.key;

  if (k >= "0" && k <= "9") return { type: "digit", value: k };

  switch (k) {
    case ".":
    case ",":
      return { type: "decimal" };
    case "+":
      return { type: "operator", op: "add" };
    case "-":
      return { type: "operator", op: "subtract" };
    case "*":
    case "x":
    case "X":
      return { type: "operator", op: "multiply" };
    case "/":
      return { type: "operator", op: "divide" };
    case "^":
      return { type: "operator", op: "power" };
    case "%":
      return { type: "operator", op: "percentage" };
    case "=":
    case "Enter":
      return { type: "equals" };
    case "Backspace":
      return { type: "backspace" };
    case "Escape":
    case "Delete":
      return { type: "clear" };
    default:
      return null;
  }
}

export function Calculator() {
  const calc = useCalculator();
  const { dispatch } = calc;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = keyToAction(event);
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  return (
    <div className="calculator">
      <Display
        value={calc.value}
        expression={calc.expression}
        error={calc.error}
        busy={calc.busy}
      />
      <Keypad onAction={dispatch} />
      <p className="calculator__hint">
        Keyboard: <kbd>0-9</kbd> <kbd>+ - * /</kbd> <kbd>Enter</kbd>{" "}
        <kbd>Bksp</kbd> <kbd>Esc</kbd>
      </p>
      <HistoryList entries={calc.history} onClear={calc.clearHistory} />
    </div>
  );
}
