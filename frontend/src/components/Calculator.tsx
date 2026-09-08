import { type FormEvent } from "react";

import { getOperation } from "../domain/operations";
import { useCalculator } from "../hooks/useCalculator";
import { HistoryList } from "./HistoryList";
import { OperandInput } from "./OperandInput";
import { OperationPicker } from "./OperationPicker";
import { ResultPanel } from "./ResultPanel";

export function Calculator() {
  const calc = useCalculator();
  const operation = getOperation(calc.operationId);
  const isBinary = operation.arity === 2;
  const busy = calc.status === "loading";

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void calc.submit();
  }

  return (
    <div className="calculator">
      <form className="calculator__form" onSubmit={onSubmit} noValidate>
        <OperationPicker
          value={calc.operationId}
          onChange={calc.setOperation}
          disabled={busy}
        />

        <div className={isBinary ? "operands operands--binary" : "operands"}>
          <OperandInput
            label="Value a"
            value={calc.rawA}
            onChange={calc.setA}
            error={calc.fieldErrors.a}
            disabled={busy}
            autoFocus
          />
          {isBinary ? (
            <OperandInput
              label={operation.id === "percentage" ? "Value b (of)" : "Value b"}
              value={calc.rawB}
              onChange={calc.setB}
              error={calc.fieldErrors.b}
              disabled={busy}
            />
          ) : null}
        </div>

        <div className="calculator__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Calculating…" : "Calculate"}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={calc.reset}
            disabled={busy}
          >
            Reset
          </button>
        </div>

        {calc.errorKind === "validation" && calc.errorMessage ? (
          <p className="calculator__form-error" role="alert">
            {calc.errorMessage}
          </p>
        ) : null}
      </form>

      <ResultPanel
        status={calc.status}
        result={calc.result}
        errorMessage={calc.errorKind === "api" ? calc.errorMessage : null}
      />

      <HistoryList entries={calc.history} onClear={calc.clearHistory} />
    </div>
  );
}
