import { expect, test } from "@playwright/test";

// The tune editor tests replace this route's answer for the browser. These call the route on the
// production server itself, with a name that needs no request to PHP.
test.describe("library download route", () => {
  test("answers 404 and a JSON error for a name that is not a library tune", async ({
    request,
  }) => {
    const response = await request.get("/api/library/not-a-tune.efu");

    expect(response.status()).toBe(404);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.json()).toEqual({ error: "No such tune in the PHP library." });
  });
});
