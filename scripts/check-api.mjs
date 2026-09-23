import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import QRCode from "qrcode";

const base = "http://127.0.0.1:8787";
let cookie = "";
async function request(
  path,
  method = "GET",
  body,
  expected = 200,
  headers = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body && !(body instanceof Uint8Array)
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    body: body
      ? body instanceof Uint8Array
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  const text = await response.text();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${response.status} ${text}`,
  );
  if (response.headers.has("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
await request("/api/health");
await request("/api/admin/place", "PUT", { name: "forbidden" }, 401);
await request(
  "/api/admin/images",
  "POST",
  new TextEncoder().encode("bad"),
  401,
  { "Content-Type": "image/png" },
);
await request("/api/admin/login", "POST", { password: "000000" }, 403);
await request(
  "/api/admin/login",
  "POST",
  { password: "000000", setupToken: "local-setup-test" },
  403,
  { Origin: "https://evil.example" },
);
const login = await request("/api/admin/login", "POST", {
  password: "000000",
  setupToken: "local-setup-test",
});
assert.equal(login.mustChange, true);
await request("/api/admin/catalog", "GET", undefined, 403);
const initialCookie = cookie;
await request("/api/admin/password", "POST", {
  oldPassword: "000000",
  password: "Local-Test-Password-2026",
});
cookie = initialCookie;
assert.equal((await request("/api/admin/session")).authenticated, false);
cookie = "";
await request("/api/admin/login", "POST", {
  password: "Local-Test-Password-2026",
});
await request("/api/admin/place", "PUT", {
  name: "好味街区 · 测试数据",
  address: "此地点仅用于本地界面测试",
  description: "这里汇集让人好好吃饭的小店。",
});
const fixture = await QRCode.toBuffer(
  "https://example.com/order?signature=a%2Fb#menu",
  { width: 800, margin: 4 },
);
await mkdir("output/playwright", { recursive: true });
await writeFile("output/playwright/test-qr.png", fixture);
await request(
  "/api/admin/images",
  "POST",
  new TextEncoder().encode("<svg><script>bad</script></svg>"),
  400,
  { "Content-Type": "image/png" },
);
const image = await request("/api/admin/images", "POST", fixture, 201, {
  "Content-Type": "image/png",
});
const data = {
  name: "巷里食堂 · 示例",
  address: "街角 01 号",
  category: "中餐",
  description: "一碗热饭，几道家常。把平凡的一餐吃得认真。",
  url: "https://example.com/order?signature=a%2Fb#menu",
  image_id: image.id,
  status: "draft",
  sort_order: 0,
  verified: false,
};
await request(
  "/api/admin/restaurants",
  "POST",
  { ...data, url: "javascript:alert(1)" },
  400,
);
const item = await request("/api/admin/restaurants", "POST", data, 201);
assert.equal((await request("/api/catalog")).restaurants.length, 0);
const adminCookie = cookie;
cookie = "";
await request("/media/" + image.id, "GET", undefined, 401);
cookie = adminCookie;
await request(
  "/api/admin/restaurants/" + item.id,
  "PUT",
  { ...data, status: "published" },
  200,
);
await request("/api/admin/restaurants/" + item.id, "PUT", {
  ...data,
  status: "published",
  verified: true,
});
cookie = "";
const publicData = await request("/api/catalog");
assert.equal(publicData.restaurants[0].url, data.url);
assert.equal(publicData.restaurants.length, 1);
await request("/media/" + image.id);
cookie = adminCookie;
await request("/api/admin/restaurants/" + item.id, "PUT", {
  ...data,
  status: "disabled",
});
assert.equal((await request("/api/catalog")).restaurants.length, 0);
await request("/api/admin/restaurants/" + item.id, "PUT", {
  ...data,
  status: "published",
  verified: true,
});
for (const [name, category, description, address] of [
  [
    "山间咖啡 · 示例",
    "咖啡茶饮",
    "让一杯咖啡，把今天的节奏慢下来。",
    "生活广场 1F",
  ],
  [
    "麦田面包 · 示例",
    "甜品烘焙",
    "刚出炉的酥香，和一点甜甜的好心情。",
    "街角 06 号",
  ],
  ["一碗面 · 示例", "日韩料理", "浓汤、细面，简单又满足。", "街区东侧"],
  [
    "小满厨房 · 示例",
    "西餐",
    "新鲜食材与随心搭配，吃得轻松一点。",
    "生活广场 2F",
  ],
  [
    "转角小吃 · 示例",
    "快餐小吃",
    "想吃的那一口，就在熟悉的转角。",
    "街角 12 号",
  ],
]) {
  await request(
    "/api/admin/restaurants",
    "POST",
    {
      ...data,
      name,
      category,
      description,
      address,
      status: "published",
      verified: true,
      image_id: null,
    },
    201,
  );
}
const temp = await request(
  "/api/admin/restaurants",
  "POST",
  { ...data, name: "删除测试", image_id: null },
  201,
);
await request("/api/admin/restaurants/" + temp.id, "DELETE");
await request("/api/admin/restaurants/" + temp.id, "DELETE", undefined, 404);
await request("/api/admin/logout", "POST");
cookie = adminCookie;
assert.equal((await request("/api/admin/session")).authenticated, false);
await request("/api/not-found", "GET", undefined, 404);
console.log(
  "PASS: bootstrap, password rotation, session revocation, CSRF, upload validation, private drafts, publish/unpublish, URL preservation and CRUD. Local demo data retained for visual QA only.",
);
