import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom does not implement these browser APIs. Radix primitives (Select, Tooltip,
// ScrollArea) and next-themes call them, so tests need no-op versions.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView(): void {};
Element.prototype.hasPointerCapture ??= function hasPointerCapture(): boolean {
  return false;
};
Element.prototype.setPointerCapture ??= function setPointerCapture(): void {};
Element.prototype.releasePointerCapture ??= function releasePointerCapture(): void {};
window.matchMedia ??= (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
