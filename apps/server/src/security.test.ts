import assert from "node:assert/strict";
import { test } from "node:test";
import { isRequestAllowed } from "./security.js";

test("accepte localhost et 127.0.0.1 sur le bon port", () => {
  assert.equal(isRequestAllowed({ host: "127.0.0.1:3737" }, 3737), true);
  assert.equal(isRequestAllowed({ host: "localhost:3737", origin: "http://localhost:3737" }, 3737), true);
});

test("refuse un autre hôte (DNS rebinding) ou un autre port", () => {
  assert.equal(isRequestAllowed({ host: "evil.example:3737" }, 3737), false);
  assert.equal(isRequestAllowed({ host: "127.0.0.1:9999" }, 3737), false);
  assert.equal(isRequestAllowed({}, 3737), false);
});

test("refuse une requête venant d'un autre site", () => {
  assert.equal(isRequestAllowed({ host: "127.0.0.1:3737", origin: "https://evil.example" }, 3737), false);
});
