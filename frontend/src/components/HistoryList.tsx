import { formatNumber } from "../domain/format";
import type { HistoryEntry } from "../hooks/useCalculator";

interface Props {
  entries: HistoryEntry[];
  onClear: () => void;
}

/** A short, most-recent-first log of successful calculations. */
export function HistoryList({ entries, onClear }: Props) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="history" aria-label="Calculation history">
      <div className="history__head">
        <h2 className="history__title">History</h2>
        <button type="button" className="history__clear" onClick={onClear}>
          Clear
        </button>
      </div>
      <ul className="history__list">
        {entries.map((entry) => (
          <li key={entry.id} className="history__item">
            <span className="history__expr">{entry.expression}</span>
            <span className="history__eq" aria-hidden="true">
              =
            </span>
            <span className="history__result">{formatNumber(entry.result)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
