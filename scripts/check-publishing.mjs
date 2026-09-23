// Local regression checks for optional fields and six-character passwords.
import assert from "node:assert/strict";
const base = "http://127.0.0.1:8787";
let cookie = "";
async function request(path, method = "GET", data, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(result)}`,
  );
  if (response.headers.has("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  return result;
}
await request("/api/admin/login", "POST", {
  password: process.env.LOCAL_TEST_PASSWORD || "000000",
});
const catalog = await request("/api/admin/catalog");
const created = [];
try {
  await request("/api/admin/place", "PUT", { name: "回归测试地点" });
  const item = await request(
    "/api/admin/restaurants",
    "POST",
    { name: "仅名称回归测试", status: "published" },
    201,
  );
  created.push(item.id);
  let record = (await request("/api/catalog")).restaurants.find(
    (r) => r.id === item.id,
  );
  assert.equal(record.address, "");
  assert.equal(record.url, "");
  const url = "https://example.com/order?signature=a%2Fb#menu";
  await request(`/api/admin/restaurants/${item.id}`, "PUT", {
    name: "已补充链接",
    status: "published",
    url,
  });
  record = (await request("/api/catalog")).restaurants.find(
    (r) => r.id === item.id,
  );
  assert.equal(record.url, url);
  await request(`/api/admin/restaurants/${item.id}`, "PUT", {
    name: "清空链接仍可发布",
    status: "published",
    address: "",
  });
  await request(
    "/api/admin/restaurants",
    "POST",
    { name: "", status: "published" },
    400,
  );
  await request(
    "/api/admin/restaurants",
    "POST",
    { name: "非法网址", url: "javascript:alert(1)" },
    400,
  );
  await request("/api/admin/password", "POST", {
    oldPassword: process.env.LOCAL_TEST_PASSWORD || "000000",
    password: "000000",
  });
  const login = await request("/api/admin/login", "POST", {
    password: "000000",
  });
  assert.equal(login.mustChange, false);
  console.log(
    "PASS: name-only create/edit/publish, optional place address, URL preservation, invalid input rejection, 000000 password change and login",
  );
} finally {
  for (const id of created)
    await request(`/api/admin/restaurants/${id}`, "DELETE");
  await request("/api/admin/place", "PUT", catalog.place);
  await request("/api/admin/logout", "POST");
}
