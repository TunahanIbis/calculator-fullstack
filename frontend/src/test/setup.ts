import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library does not auto-clean up with Vitest's globals; do it here.
afterEach(() => {
  cleanup();
});
