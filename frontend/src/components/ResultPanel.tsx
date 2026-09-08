import { formatNumber } from "../domain/format";
import { getOperation, formatExpression } from "../domain/operations";
import type { CalculationResult } from "../api/calculator";
import type { Status } from "../hooks/useCalculator";

interface Props {
  status: Status;
  result: CalculationResult | null;
  errorMessage: string | null;
}

type View = {
  variant: "idle" | "success" | "error" | "loading";
  label: string | null;
  value: string;
};

/**
 * Decides what the panel shows. While a request is in flight we keep the
 * previous result on screen (dimmed via CSS) instead of swapping to a
 * placeholder, which is what made the panel flicker on fast responses.
 */
function resolveView(props: Props): View {
  const { status, result, errorMessage } = props;

  if (status === "error" && errorMessage) {
    return { variant: "error", label: "Error", value: errorMessage };
  }

  if (result && (status === "success" || status === "loading")) {
    const op = getOperation(result.operation);
    return {
      variant: status === "loading" ? "loading" : "success",
      label: `${formatExpression(op, result.a, result.b)} =`,
      value: formatNumber(result.result),
    };
  }

  if (status === "loading") {
    return { variant: "loading", label: null, value: "Calculating…" };
  }

  return { variant: "idle", label: null, value: "Ready" };
}

/** The primary output area: placeholder, the formatted result, or an error. */
export function ResultPanel(props: Props) {
  const { variant, label, value } = resolveView(props);

  return (
    <output
      className={`result result--${variant}`}
      aria-label="Result"
      aria-live="polite"
    >
      {label ? <span className="result__label">{label}</span> : null}
      {/* Keyed on the text so a changing value re-triggers the enter animation. */}
      <span className="result__value" key={value}>
        {value}
      </span>
    </output>
  );
}
