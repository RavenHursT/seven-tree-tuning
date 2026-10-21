// @vitest-environment node
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

async function headersForEveryPage(): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const everyPage = rules.find((rule) => rule.source === "/:path*");
  return Object.fromEntries((everyPage?.headers ?? []).map(({ key, value }) => [key, value]));
}

describe("security headers", () => {
  it("lets the page connect only to its own server, so the chip serial cannot leave the browser", async () => {
    const policy = (await headersForEveryPage())["Content-Security-Policy"] ?? "";
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });

  it("stops content sniffing and sends no referrer to other sites", async () => {
    const headers = await headersForEveryPage();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("same-origin");
  });
});
