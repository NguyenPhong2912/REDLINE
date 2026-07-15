import { webcrypto } from "node:crypto";
import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: webcrypto,
  });
}

beforeEach(() => {
  localStorage.clear();
});
