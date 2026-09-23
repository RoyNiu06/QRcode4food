import assert from "node:assert/strict";
import QRCode from "qrcode";

const base = "http://127.0.0.1:8787";
const qr = await QRCode.toBuffer("https://example.com/community-order", { width: 440 });
let adminCookie = "", visitorCookie = "";
async function call(path, { method = "GET", data, body, admin = false, visitor = false, status = 200 } = {}) {
  const headers = { Origin: base };
  if (admin && adminCookie) headers.Cookie = adminCookie;
  if (visitor && visitorCookie) headers.Cookie = visitorCookie;
  if (data) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method, headers, body: data ? JSON.stringify(data) : body,
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${response.status} ${text.slice(0, 400)}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (cookie && admin) adminCookie = cookie;
  if (cookie && visitor) visitorCookie = cookie;
  try { return JSON.parse(text); } catch { return text; }
}
const login = await call("/api/admin/login", { method: "POST", data: { password: "000000" }, admin: true });
assert.equal(login.authenticated, true);
const catalog = await call("/api/catalog");
const restaurant = catalog.restaurants[0];
assert.ok(restaurant, "local database needs a published restaurant");
await call(`/api/admin/restaurants/${restaurant.id}/windows`, { method: "POST",
  data: { name: "不可写入" }, status: 401 });

const upload = await call("/api/admin/images", { method: "POST", body: qr,
  admin: true, status: 201 });
assert.ok(upload.id);
const created = await call(`/api/admin/restaurants/${restaurant.id}/windows`, {
  method: "POST", data: { name: "窗口验证", url: "https://example.com/counter", image_id: upload.id }, admin: true, status: 201,
});
assert.ok((await call("/api/catalog")).restaurants.find((r) => r.id === restaurant.id).windows.some((w) => w.id === created.id));
await call(`/media/${upload.id}`);
await call(`/api/admin/windows/${created.id}`, { method: "PUT", data: { name: "窗口已修改", url: "https://example.com/new-counter", image_id: upload.id }, admin: true });
assert.equal((await call("/api/catalog")).restaurants.find((r) => r.id === restaurant.id).windows.find((w) => w.id === created.id).name, "窗口已修改");
await call(`/api/admin/windows/${created.id}`, { method: "DELETE", admin: true });
assert.ok(!(await call("/api/catalog")).restaurants.find((r) => r.id === restaurant.id).windows.some((w) => w.id === created.id));

const quota = await call("/api/contribute/quota", { visitor: true });
assert.equal(quota.limit, 10);
const submitted = [];
for (let i = 0; i < 10; i++) {
  const form = new FormData();
  form.set("restaurant_id", restaurant.id);
  form.set("restaurant_name", restaurant.name);
  form.set("window_name", `共创窗口 ${i + 1}`);
  form.set("url", "https://example.com/community-order");
  form.set("image", new Blob([qr], { type: "image/png" }), "qr.png");
  submitted.push(await call("/api/contributions", { method: "POST", body: form, visitor: true, status: 201 }));
}
assert.equal(submitted.at(-1).quota.used, 10);
const excess = new FormData();
excess.set("restaurant_name", "超额投稿");
excess.set("image", new Blob([qr], { type: "image/png" }), "qr.png");
await call("/api/contributions", { method: "POST", body: excess, visitor: true, status: 429 });
const submissions = await call("/api/admin/contributions", { admin: true });
assert.ok(submissions.submissions.filter((s) => s.status === "pending").length >= 10);
const first = submissions.submissions.find((s) => s.id === submitted[0].id);
assert.ok(first);
await call(`/media/${first.image_id}`, { status: 401 });
await call(`/api/admin/contributions/${first.id}`, { method: "PUT", admin: true,
  data: { restaurant_id: restaurant.id, restaurant_name: restaurant.name,
    window_name: "审核后窗口", url: "https://example.com/approved" } });
await call(`/api/admin/contributions/${first.id}/approve`, { method: "POST", admin: true });
const publicAfter = await call("/api/catalog");
assert.ok(publicAfter.restaurants.find((r) => r.id === restaurant.id).windows.some((w) => w.name === "审核后窗口"));
await call(`/media/${first.image_id}`);
await call(`/api/admin/contributions/${submitted[1].id}/reject`, { method: "POST", admin: true });
assert.equal((await call("/api/admin/contributions", { admin: true })).submissions.find((s) => s.id === submitted[1].id).status, "rejected");
await call(`/api/admin/contributions/${submitted[2].id}`, { method: "PUT", admin: true,
  data: { restaurant_id: "", restaurant_name: "共创新餐厅验证", window_name: "",
    url: "https://example.com/new-restaurant" } });
await call(`/api/admin/contributions/${submitted[2].id}/approve`, { method: "POST", admin: true });
assert.ok((await call("/api/catalog")).restaurants.some((r) => r.name === "共创新餐厅验证"));
visitorCookie = "";
await call("/api/contribute/quota", { visitor: true });
const concurrent = await Promise.all(Array.from({ length: 12 }, (_, i) => {
  const form = new FormData();
  form.set("restaurant_name", `并发投稿 ${i}`);
  form.set("image", new Blob([qr], { type: "image/png" }), "qr.png");
  return fetch(base + "/api/contributions", { method: "POST",
    headers: { Origin: base, Cookie: visitorCookie }, body: form }).then((response) => response.status);
}));
assert.equal(concurrent.filter((status) => status === 201).length, 10, JSON.stringify(concurrent));
assert.equal(concurrent.filter((status) => status === 429).length, 2, JSON.stringify(concurrent));
console.log("Community API: windows CRUD, private moderation, new/existing approval, rejection and sequential/concurrent quotas passed.");
