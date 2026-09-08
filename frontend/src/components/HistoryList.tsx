import { useEffect, useState } from "react";

import { formatNumber } from "../domain/format";
import type { HistoryEntry } from "../hooks/useCalculator";

interface Props {
  entries: HistoryEntry[];
  onClear: () => void;
}

const PAGE_SIZE = 4;

/** A most-recent-first log of successful calculations, paginated. */
export function HistoryList({ entries, onClear }: Props) {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const newestId = entries[0]?.id;

  // Jump back to the first page whenever a new calculation lands, so the newest
  // entry is always visible.
  useEffect(() => {
    setPage(0);
  }, [newestId]);

  // Keep the page in range if entries shrink (e.g. after Clear).
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = entries.slice(start, start + PAGE_SIZE);

  return (
    <section className="history" aria-label="Calculation history">
      <div className="history__head">
        <h2 className="history__title">History</h2>
        {entries.length > 0 ? (
          <button type="button" className="history__clear" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <p className="history__empty">Your calculations will show up here.</p>
      ) : (
        <>
          <ul className="history__list">
            {visible.map((entry) => (
              <li key={entry.id} className="history__item">
                <span className="history__expr">{entry.expression}</span>
                <span className="history__eq" aria-hidden="true">
                  =
                </span>
                <span className="history__result">
                  {formatNumber(entry.result)}
                </span>
              </li>
            ))}
          </ul>

          {pageCount > 1 ? (
            <div className="history__pager">
              <button
                type="button"
                className="history__page-btn"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Newer calculations"
              >
                ‹
              </button>
              <span className="history__page-info">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                className="history__page-btn"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                aria-label="Older calculations"
              >
                ›
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
