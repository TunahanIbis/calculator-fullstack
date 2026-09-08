import { Calculator } from "./components/Calculator";

export function App() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Calculator</h1>
        <p className="page__subtitle">
          Every result is computed by the Go API. The browser only collects
          input and renders the response.
        </p>
      </header>

      <main className="page__main">
        <Calculator />
      </main>

      <footer className="page__footer">
        <a
          href="https://github.com/tunahanibis/calculator-fullstack"
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      </footer>
    </div>
  );
}
