import { describe, expect, it } from "vitest";

import * as crypto from "./index";

describe("crypto public API", () => {
  it("exports the Blowfish class and nothing else", () => {
    expect(Object.keys(crypto)).toEqual(["Blowfish"]);
    expect(typeof crypto.Blowfish).toBe("function");
  });
});
