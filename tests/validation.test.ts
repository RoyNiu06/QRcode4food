import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRestaurant, validateUrl } from "../shared/validation";
import {
  imageType,
  passwordHash,
  equal,
  randomToken,
} from "../worker/security";
import QRCode from "qrcode";

test("merchant URL signatures, query order and fragments survive unchanged", () => {
  const value = "https://example.com/order?b=2&a=%2f%2B#menu";
  assert.equal(validateUrl(value), value);
});
test("script, credential, local and literal IP URLs cannot be published", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///a",
    "https://u:p@example.com",
    "https://localhost/a",
    "https://127.0.0.1/a",
    "http://2130706433/",
    "http://[::1]/",
    "https://shop.local/",
    "abc",
  ])
    assert.throws(() => validateUrl(value), value);
});
test("publish requires explicit verification, fields and bounded ordering", () => {
  const data = {
    name: "示例餐厅",
    address: "",
    category: "中餐",
    description: "",
    url: "https://example.com",
    status: "published",
    verified: true,
    sort_order: 0,
  };
  assert.equal(validateRestaurant(data).name, "示例餐厅");
  assert.throws(() => validateRestaurant({ ...data, verified: false }));
  assert.throws(() => validateRestaurant({ ...data, name: "" }));
  assert.throws(() => validateRestaurant({ ...data, sort_order: -1 }));
  assert.throws(() => validateRestaurant({ ...data, status: "anything" }));
});
test("password hashing uses salt and secret pepper, and tokens have enough entropy", async () => {
  const a = await passwordHash("sample-password", "salt1", "pepper1");
  assert.equal(a.length, 64);
  assert.equal(
    equal(a, await passwordHash("sample-password", "salt1", "pepper1")),
    true,
  );
  assert.notEqual(a, await passwordHash("sample-password", "salt2", "pepper1"));
  assert.notEqual(a, await passwordHash("sample-password", "salt1", "pepper2"));
  assert.notEqual(randomToken(), randomToken());
});
test("upload validation recognizes a real QR PNG and rejects active files", async () => {
  const png = await QRCode.toBuffer("https://example.com/menu");
  assert.equal(imageType(png), "image/png");
  assert.equal(
    imageType(
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
    ),
    null,
  );
  const huge = Buffer.from(png);
  huge.writeUInt32BE(100000, 16);
  assert.equal(imageType(huge), null);
});
