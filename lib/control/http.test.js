import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});
const { withControl } = await import("./http.js");
const { OperationsError } = await import("../operations/errors.js");

const request = (headers = {}) => new Request("https://geiger.example/api/control/me", { headers });

test("no Bearer token is a 401 before any lookup", async () => {
  let resolved = false;
  const res = await withControl(request({ cookie: "sb=1" }), async () => ({}), {
    resolve: async () => {
      resolved = true;
    },
  });
  assert.equal(res.status, 401);
  assert.equal(resolved, false);
});

test("the handler gets the principal and the raw token", async () => {
  const res = await withControl(
    request({ authorization: "Bearer abc.def" }),
    async ({ principal, token }) => ({ who: principal.id, token }),
    { resolve: async () => ({ kind: "staff", id: "u1" }) },
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { who: "u1", token: "abc.def" });
});

test("operations errors keep their status and message", async () => {
  const res = await withControl(
    request({ authorization: "Bearer x" }),
    async () => {
      throw new OperationsError("forbidden", 403, "You cannot perform this action.");
    },
    { resolve: async () => ({ kind: "staff", id: "u1" }) },
  );
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "You cannot perform this action.", code: "forbidden" });
});

test("unexpected errors become a generic 500", async () => {
  const res = await withControl(
    request({ authorization: "Bearer x" }),
    async () => {
      throw new Error("db exploded with secrets");
    },
    { resolve: async () => ({ kind: "staff", id: "u1" }) },
  );
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: "Something went wrong." });
});
