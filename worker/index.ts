import {
  InputError,
  textField,
  validateRestaurant,
} from "../shared/validation";
import type { Place, Restaurant } from "../shared/types";
import {
  cookieToken,
  digest,
  equal,
  imageType,
  passwordHash,
  randomToken,
  sessionCookie,
} from "./security";

type AppEnv = Env;
type Admin = {
  password_hash: string;
  salt: string;
  must_change: number;
  version: number;
};
class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const json = (
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });

async function readBody(request: Request, limit: number): Promise<Uint8Array> {
  if (Number(request.headers.get("Content-Length") || 0) > limit)
    throw new HttpError("文件或内容过大", 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError("文件或内容过大", 413);
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("Content-Type")?.includes("application/json"))
    throw new HttpError("请使用 JSON 请求", 415);
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(await readBody(request, 16384)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InputError("请求内容格式不正确");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new InputError("请求内容格式不正确");
  return data as Record<string, unknown>;
}
function checkOrigin(request: Request) {
  const url = new URL(request.url),
    origin = request.headers.get("Origin");
  const local = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (
    origin !== url.origin &&
    !(
      local &&
      ["http://127.0.0.1:5173", "http://localhost:5173"].includes(origin || "")
    )
  )
    throw new HttpError("请求来源不受信任，请刷新页面重试", 403);
}
async function rateLimit(env: AppEnv, key: string, limit: number) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits(key, attempts, expires) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires < ? THEN 1 ELSE attempts+1 END,
    expires=CASE WHEN expires < ? THEN ? ELSE expires END RETURNING attempts`,
  )
    .bind(key, now + 900, now, now, now + 900)
    .first<{ attempts: number }>();
  if (!row || row.attempts > limit)
    throw new HttpError("尝试次数较多，请 15 分钟后再试", 429);
}
async function adminRow(env: AppEnv): Promise<Admin | null> {
  return env.DB.prepare(
    "SELECT password_hash,salt,must_change,version FROM admin WHERE id=1",
  ).first<Admin>();
}
async function session(request: Request, env: AppEnv): Promise<Admin | null> {
  const token = cookieToken(request);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await env.DB.prepare(
    `SELECT a.password_hash,a.salt,a.must_change,a.version FROM admin a JOIN sessions s ON s.version=a.version
    WHERE a.id=1 AND s.token_hash=? AND s.expires>?`,
  )
    .bind(await digest(token), Math.floor(Date.now() / 1000))
    .first<Admin>();
  return row;
}
async function needAdmin(
  request: Request,
  env: AppEnv,
  allowInitial = false,
): Promise<Admin> {
  const admin = await session(request, env);
  if (!admin) throw new HttpError("登录已过期，请重新登录", 401);
  if (admin.must_change && !allowInitial)
    throw new HttpError("请先设置新的管理员密码", 403);
  return admin;
}
async function createSession(request: Request, env: AppEnv, admin: Admin) {
  const token = randomToken();
  await env.DB.prepare(
    "INSERT INTO sessions(token_hash,expires,version) VALUES(?,?,?)",
  )
    .bind(
      await digest(token),
      Math.floor(Date.now() / 1000) + 28800,
      admin.version,
    )
    .run();
  return json(
    { authenticated: true, mustChange: Boolean(admin.must_change) },
    200,
    { "Set-Cookie": sessionCookie(request, token) },
  );
}
async function removeUnusedImage(env: AppEnv, id: string | null) {
  if (!id) return;
  const deleted = await env.DB.prepare(
    "DELETE FROM images WHERE id=? AND NOT EXISTS (SELECT 1 FROM restaurants WHERE image_id=?) RETURNING id",
  )
    .bind(id, id)
    .first();
  if (deleted) await env.IMAGES.delete(id);
}

async function route(
  request: Request,
  env: AppEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  if (!["GET", "HEAD"].includes(method)) checkOrigin(request);

  if (path === "/api/health" && method === "GET") {
    await env.DB.prepare("SELECT id FROM settings WHERE id=1").first();
    return json({ ok: true, version: "1.0.0" });
  }
  if (path === "/api/catalog" && method === "GET") {
    const [place, restaurants] = await Promise.all([
      env.DB.prepare(
        "SELECT name,address,description FROM settings WHERE id=1",
      ).first<Place>(),
      env.DB.prepare(
        "SELECT * FROM restaurants WHERE status='published' ORDER BY sort_order, created_at DESC",
      ).all<Restaurant>(),
    ]);
    return json({ place, restaurants: restaurants.results });
  }
  if (path.startsWith("/media/") && (method === "GET" || method === "HEAD")) {
    const id = path.slice(7);
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError("图片不存在", 404);
    const published = await env.DB.prepare(
      "SELECT id FROM restaurants WHERE image_id=? AND status='published' LIMIT 1",
    )
      .bind(id)
      .first();
    if (!published) await needAdmin(request, env);
    const object = await env.IMAGES.get(id);
    if (!object) throw new HttpError("图片不存在", 404);
    return new Response(method === "HEAD" ? null : object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  }
  if (path === "/api/admin/session" && method === "GET") {
    const admin = await session(request, env);
    return json({
      authenticated: Boolean(admin),
      mustChange: Boolean(admin?.must_change),
    });
  }
  if (path === "/api/admin/login" && method === "POST") {
    if (!env.AUTH_SECRET || !env.SETUP_TOKEN)
      throw new HttpError("管理员服务尚未初始化", 503);
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    await rateLimit(env, `login:${await digest(ip + env.AUTH_SECRET)}`, 10);
    const input = await body(request);
    const password = textField(input.password, "密码", 128, true);
    let admin = await adminRow(env);
    if (!admin || admin.must_change) {
      if (
        typeof input.setupToken !== "string" ||
        !equal(input.setupToken, env.SETUP_TOKEN)
      )
        throw new HttpError("首次登录请使用专属初始化链接", 403);
    }
    if (!admin) {
      const salt = randomToken();
      await env.DB.prepare(
        "INSERT OR IGNORE INTO admin(id,password_hash,salt) VALUES(1,?,?)",
      )
        .bind(await passwordHash("000000", salt, env.AUTH_SECRET), salt)
        .run();
      admin = await adminRow(env);
    }
    if (
      !admin ||
      !equal(
        await passwordHash(password, admin.salt, env.AUTH_SECRET),
        admin.password_hash,
      )
    )
      throw new HttpError("密码不正确，请重试", 401);
    return createSession(request, env, admin);
  }
  if (path === "/api/admin/logout" && method === "POST") {
    const token = cookieToken(request);
    if (token)
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
        .bind(await digest(token))
        .run();
    return json({ ok: true }, 200, {
      "Set-Cookie": sessionCookie(request, "", true),
    });
  }
  if (path === "/api/admin/password" && method === "POST") {
    const admin = await needAdmin(request, env, true),
      input = await body(request);
    const oldPassword = textField(input.oldPassword, "当前密码", 128, true),
      password = textField(input.password, "新密码", 128, true);
    await rateLimit(env, "password-change", 10);
    if (
      !equal(
        await passwordHash(oldPassword, admin.salt, env.AUTH_SECRET),
        admin.password_hash,
      )
    )
      throw new HttpError("当前密码不正确", 400);
    if (
      password.length < 10 ||
      password === oldPassword ||
      /^([\s\S])\1+$/.test(password)
    )
      throw new InputError(
        "新密码至少 10 位，且不能与原密码相同或由重复字符组成",
      );
    const salt = randomToken(),
      hash = await passwordHash(password, salt, env.AUTH_SECRET);
    const result = await env.DB.prepare(
      "UPDATE admin SET password_hash=?,salt=?,must_change=0,version=version+1 WHERE id=1 AND version=?",
    )
      .bind(hash, salt, admin.version)
      .run();
    if (!result.meta.changes)
      throw new HttpError("密码已被修改，请重新登录", 409);
    await env.DB.prepare("DELETE FROM sessions").run();
    return json({ ok: true }, 200, {
      "Set-Cookie": sessionCookie(request, "", true),
    });
  }
  if (path.startsWith("/api/admin/")) {
    await needAdmin(request, env);
    if (path === "/api/admin/catalog" && method === "GET") {
      const [place, restaurants] = await Promise.all([
        env.DB.prepare(
          "SELECT name,address,description FROM settings WHERE id=1",
        ).first<Place>(),
        env.DB.prepare(
          "SELECT * FROM restaurants ORDER BY sort_order,created_at DESC",
        ).all<Restaurant>(),
      ]);
      return json({ place, restaurants: restaurants.results });
    }
    if (path === "/api/admin/place" && method === "PUT") {
      const input = await body(request);
      const place = {
        name: textField(input.name, "地点名称", 80, true),
        address: textField(input.address, "地点地址", 160, true),
        description: textField(input.description, "地点说明", 160),
      };
      await env.DB.prepare(
        "UPDATE settings SET name=?,address=?,description=? WHERE id=1",
      )
        .bind(place.name, place.address, place.description)
        .run();
      return json({ ok: true });
    }
    if (path === "/api/admin/images" && method === "POST") {
      await rateLimit(env, "image-upload", 40);
      const bytes = await readBody(request, 5 * 1024 * 1024),
        type = imageType(bytes);
      if (!type)
        throw new InputError("图片格式无效或尺寸过大，请上传 JPEG / PNG 图片");
      const id = crypto.randomUUID();
      await env.IMAGES.put(id, bytes, { httpMetadata: { contentType: type } });
      try {
        await env.DB.prepare("INSERT INTO images(id,content_type) VALUES(?,?)")
          .bind(id, type)
          .run();
      } catch (error) {
        await env.IMAGES.delete(id);
        throw error;
      }
      return json({ id }, 201);
    }
    if (path === "/api/admin/restaurants" && method === "POST") {
      const data = validateRestaurant(await body(request));
      if (data.status === "published") {
        const place = await env.DB.prepare(
          "SELECT name,address FROM settings WHERE id=1",
        ).first<Place>();
        if (!place?.name || !place.address)
          throw new InputError("请先在地点设置中填写名称和地址");
      }
      if (
        data.image_id &&
        !(await env.DB.prepare("SELECT id FROM images WHERE id=?")
          .bind(data.image_id)
          .first())
      )
        throw new InputError("图片不存在，请重新上传");
      const id = crypto.randomUUID(),
        now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO restaurants(id,name,address,category,description,url,image_id,status,sort_order,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          id,
          data.name,
          data.address,
          data.category,
          data.description,
          data.url,
          data.image_id,
          data.status,
          data.sort_order,
          data.status === "published" ? now : null,
          now,
          now,
        )
        .run();
      return json({ id }, 201);
    }
    const match = path.match(/^\/api\/admin\/restaurants\/([a-f0-9-]{36})$/);
    if (match && (method === "PUT" || method === "DELETE")) {
      const existing = await env.DB.prepare(
        "SELECT * FROM restaurants WHERE id=?",
      )
        .bind(match[1])
        .first<Restaurant>();
      if (!existing) throw new HttpError("餐厅不存在，可能已被删除", 404);
      if (method === "DELETE") {
        await env.DB.prepare("DELETE FROM restaurants WHERE id=?")
          .bind(existing.id)
          .run();
        ctx.waitUntil(removeUnusedImage(env, existing.image_id));
        return json({ ok: true });
      }
      const data = validateRestaurant(await body(request));
      if (
        data.image_id &&
        !(await env.DB.prepare("SELECT id FROM images WHERE id=?")
          .bind(data.image_id)
          .first())
      )
        throw new InputError("图片不存在，请重新上传");
      if (data.status === "published") {
        const place = await env.DB.prepare(
          "SELECT name,address FROM settings WHERE id=1",
        ).first<Place>();
        if (!place?.name || !place.address)
          throw new InputError("请先设置地点名称和地址");
      }
      const now = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE restaurants SET name=?,address=?,category=?,description=?,url=?,image_id=?,status=?,sort_order=?,verified_at=?,updated_at=? WHERE id=?",
      )
        .bind(
          data.name,
          data.address,
          data.category,
          data.description,
          data.url,
          data.image_id,
          data.status,
          data.sort_order,
          data.status === "published" ? now : existing.verified_at,
          now,
          existing.id,
        )
        .run();
      if (existing.image_id !== data.image_id)
        ctx.waitUntil(removeUnusedImage(env, existing.image_id));
      return json({ ok: true });
    }
  }
  throw new HttpError("页面或接口不存在", 404);
}

export default {
  async fetch(
    request: Request,
    env: AppEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      const response = await route(request, env, ctx);
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Frame-Options", "DENY");
      return response;
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      if (error instanceof InputError)
        return json({ error: error.message }, 400);
      const id = crypto.randomUUID();
      console.error(
        JSON.stringify({
          event: "request_failed",
          id,
          path: new URL(request.url).pathname,
          type: error instanceof Error ? error.name : "unknown",
        }),
      );
      return json(
        { error: "暂时无法完成操作，请稍后重试", requestId: id },
        500,
      );
    }
  },
  async scheduled(_event: ScheduledController, env: AppEnv) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires<?").bind(now),
      env.DB.prepare("DELETE FROM rate_limits WHERE expires<?").bind(now),
    ]);
    const stale = await env.DB.prepare(
      "SELECT id FROM images WHERE created_at < datetime('now','-1 day') AND id NOT IN (SELECT image_id FROM restaurants WHERE image_id IS NOT NULL) LIMIT 100",
    ).all<{ id: string }>();
    for (const row of stale.results) await removeUnusedImage(env, row.id);
  },
} satisfies ExportedHandler<AppEnv>;
