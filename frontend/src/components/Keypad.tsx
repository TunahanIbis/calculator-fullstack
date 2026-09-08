import type { MachineAction } from "../domain/calculatorMachine";

interface KeyDef {
  label: string;
  /** Accessible name when the glyph isn't self-explanatory. */
  aria?: string;
  action: MachineAction;
  kind: "digit" | "op" | "fn" | "equals";
  wide?: boolean;
}

// Layout is a flat list rendered into a 4-column grid; `=` spans 3.
const KEYS: KeyDef[] = [
  { label: "C", aria: "Clear", action: { type: "clear" }, kind: "fn" },
  { label: "⌫", aria: "Backspace", action: { type: "backspace" }, kind: "fn" },
  { label: "√", aria: "Square root", action: { type: "unary", op: "sqrt" }, kind: "fn" },
  { label: "^", aria: "Power", action: { type: "operator", op: "power" }, kind: "op" },

  { label: "7", action: { type: "digit", value: "7" }, kind: "digit" },
  { label: "8", action: { type: "digit", value: "8" }, kind: "digit" },
  { label: "9", action: { type: "digit", value: "9" }, kind: "digit" },
  { label: "÷", aria: "Divide", action: { type: "operator", op: "divide" }, kind: "op" },

  { label: "4", action: { type: "digit", value: "4" }, kind: "digit" },
  { label: "5", action: { type: "digit", value: "5" }, kind: "digit" },
  { label: "6", action: { type: "digit", value: "6" }, kind: "digit" },
  { label: "×", aria: "Multiply", action: { type: "operator", op: "multiply" }, kind: "op" },

  { label: "1", action: { type: "digit", value: "1" }, kind: "digit" },
  { label: "2", action: { type: "digit", value: "2" }, kind: "digit" },
  { label: "3", action: { type: "digit", value: "3" }, kind: "digit" },
  { label: "−", aria: "Subtract", action: { type: "operator", op: "subtract" }, kind: "op" },

  { label: "±", aria: "Negate", action: { type: "negate" }, kind: "fn" },
  { label: "0", action: { type: "digit", value: "0" }, kind: "digit" },
  { label: ".", aria: "Decimal point", action: { type: "decimal" }, kind: "digit" },
  { label: "+", aria: "Add", action: { type: "operator", op: "add" }, kind: "op" },

  { label: "%", aria: "Percent", action: { type: "operator", op: "percentage" }, kind: "op" },
  { label: "=", aria: "Equals", action: { type: "equals" }, kind: "equals", wide: true },
];

interface Props {
  onAction: (action: MachineAction) => void;
}

export function Keypad({ onAction }: Props) {
  return (
    <div className="keypad">
      {KEYS.map((key) => (
        <button
          key={key.label}
          type="button"
          aria-label={key.aria ?? key.label}
          className={`key key--${key.kind}${key.wide ? " key--wide" : ""}`}
          onClick={() => onAction(key.action)}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
