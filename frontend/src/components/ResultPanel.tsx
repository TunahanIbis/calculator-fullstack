import { formatNumber } from "../domain/format";
import { getOperation, formatExpression } from "../domain/operations";
import type { CalculationResult } from "../api/calculator";
import type { Status } from "../hooks/useCalculator";

interface Props {
  status: Status;
  result: CalculationResult | null;
  errorMessage: string | null;
}

/**
 * The primary output area. Shows a placeholder when idle, the formatted result
 * on success, and the friendly error message on failure.
 */
export function ResultPanel({ status, result, errorMessage }: Props) {
  if (status === "error" && errorMessage) {
    return (
      <output className="result result--error" aria-label="Result" aria-live="polite">
        <span className="result__label">Error</span>
        <span className="result__value">{errorMessage}</span>
      </output>
    );
  }

  if (status === "success" && result) {
    const op = getOperation(result.operation);
    return (
      <output className="result result--success" aria-label="Result" aria-live="polite">
        <span className="result__label">
          {formatExpression(op, result.a, result.b)} =
        </span>
        <span className="result__value">{formatNumber(result.result)}</span>
      </output>
    );
  }

  return (
    <output className="result result--idle" aria-label="Result" aria-live="polite">
      <span className="result__value">
        {status === "loading" ? "Calculating…" : "—"}
      </span>
    </output>
  );
}
