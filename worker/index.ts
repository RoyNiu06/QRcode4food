import {
  InputError,
  textField,
  validateContribution,
  validateContributionWindows,
  validateRaffleSettings,
  validateRestaurant,
  validateWindow,
} from "../shared/validation";
import type { Contribution, Place, Restaurant, RestaurantWindow } from "../shared/types";
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
    `DELETE FROM images WHERE id=?
    AND NOT EXISTS (SELECT 1 FROM restaurants WHERE image_id=?)
    AND NOT EXISTS (SELECT 1 FROM windows WHERE image_id=?)
    AND NOT EXISTS (SELECT 1 FROM contributions WHERE image_id=?)
    AND NOT EXISTS (SELECT 1 FROM contribution_windows WHERE image_id=?) RETURNING id`,
  )
    .bind(id, id, id, id, id)
    .first();
  if (deleted) await env.IMAGES.delete(id);
}

async function getCatalog(env: AppEnv, admin = false) {
  const [place, restaurants, windows, raffleRow] = await Promise.all([
    env.DB.prepare("SELECT name,address,description FROM settings WHERE id=1").first<Place>(),
    env.DB.prepare(admin
      ? "SELECT * FROM restaurants ORDER BY sort_order,created_at DESC"
      : "SELECT * FROM restaurants WHERE status='published' ORDER BY sort_order,created_at DESC").all<Restaurant>(),
    env.DB.prepare("SELECT * FROM windows ORDER BY sort_order,created_at").all<RestaurantWindow>(),
    env.DB.prepare("SELECT enabled,lines_zh_hans,lines_zh_hant,lines_en FROM raffle_settings WHERE id=1")
      .first<{enabled:number;lines_zh_hans:string;lines_zh_hant:string;lines_en:string}>(),
  ]);
  const byRestaurant = new Map<string, RestaurantWindow[]>();
  for (const window of windows.results) {
    const group = byRestaurant.get(window.restaurant_id) || [];
    group.push(window);
    byRestaurant.set(window.restaurant_id, group);
  }
  const parseLines = (raw:string|undefined):string[] => {
    try {const value=JSON.parse(raw||"[]");return Array.isArray(value)?value.filter(item=>typeof item==="string"):[];}
    catch{return [];}
  };
  return { place, raffle: {enabled:Boolean(raffleRow?.enabled),
    lines_zh_hans:parseLines(raffleRow?.lines_zh_hans),lines_zh_hant:parseLines(raffleRow?.lines_zh_hant),
    lines_en:parseLines(raffleRow?.lines_en)}, restaurants: restaurants.results.map((restaurant) => ({
    ...restaurant, windows: byRestaurant.get(restaurant.id) || [],
  })) };
}

const CONTRIBUTION_LIMIT = 10;
const CONTRIBUTION_WINDOW = 5 * 60 * 60;
async function contributor(request: Request, env: AppEnv) {
  const raw = request.headers.get("Cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("qr_contributor="))?.slice(15) || "";
  const [token, signature] = raw.split(".");
  if (/^[a-f0-9]{64}$/.test(token || "") && /^[a-f0-9]{64}$/.test(signature || "") &&
    equal(signature, await digest(token + env.AUTH_SECRET)))
    return { key: await digest(token + env.AUTH_SECRET), cookie: "" };
  const fresh = randomToken();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    key: await digest(fresh + env.AUTH_SECRET),
    cookie: `qr_contributor=${fresh}.${await digest(fresh + env.AUTH_SECRET)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`,
  };
}
async function quota(env: AppEnv, key: string) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT attempts,expires_at FROM contribution_quotas WHERE browser_hash=?")
    .bind(key).first<{ attempts: number; expires_at: number }>();
  return {
    used: row && row.expires_at > now ? row.attempts : 0,
    limit: CONTRIBUTION_LIMIT,
    resets_at: row && row.expires_at > now ? row.expires_at : 0,
  };
}
async function consumeQuota(env: AppEnv, key: string) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `INSERT INTO contribution_quotas(browser_hash,attempts,started_at,expires_at) VALUES(?,1,?,?)
    ON CONFLICT(browser_hash) DO UPDATE SET
      attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,
      started_at=CASE WHEN expires_at<=? THEN ? ELSE started_at END,
      expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END
    WHERE expires_at<=? OR attempts<? RETURNING attempts,expires_at`,
  ).bind(key, now, now + CONTRIBUTION_WINDOW, now, now, now,
    now, now + CONTRIBUTION_WINDOW, now, CONTRIBUTION_LIMIT)
    .first<{ attempts: number; expires_at: number }>();
  if (!row) throw new HttpError("本浏览器 5 小时内已提交 10 条，请稍后再试", 429);
  return row;
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
    return json(await getCatalog(env));
  }
  if (path.startsWith("/go/") && method === "GET") {
    const match = /^\/go\/(restaurant|window)\/([a-f0-9-]{36})$/.exec(path);
    if (!match) throw new HttpError("点餐入口不存在", 404);
    const row = match[1] === "restaurant"
      ? await env.DB.prepare("SELECT id AS restaurant_id, NULL AS window_id, url FROM restaurants WHERE id=? AND status='published' AND url<>''").bind(match[2]).first<{restaurant_id:string;window_id:string|null;url:string}>()
      : await env.DB.prepare("SELECT r.id AS restaurant_id,w.id AS window_id,w.url FROM windows w JOIN restaurants r ON r.id=w.restaurant_id WHERE w.id=? AND r.status='published' AND w.url<>''").bind(match[2]).first<{restaurant_id:string;window_id:string|null;url:string}>();
    if (!row) throw new HttpError("点餐入口不存在", 404);
    await env.DB.prepare("INSERT INTO outbound_clicks(id,restaurant_id,window_id,clicked_at) VALUES(?,?,?,?)")
      .bind(crypto.randomUUID(), row.restaurant_id, row.window_id, Math.floor(Date.now()/1000)).run();
    return new Response(null, {status: 302, headers: {Location: row.url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex"}});
  }
  if (path === "/api/rankings" && method === "GET") {
    const period = url.searchParams.get("period") || "today";
    const unit = url.searchParams.get("unit") || "restaurant";
    if (!["today","24h","week"].includes(period) || !["restaurant","window"].includes(unit))
      throw new InputError("排行参数不正确");
    const now = Math.floor(Date.now()/1000);
    const start = period === "today" ? Math.floor((now+28800)/86400)*86400-28800 : now-(period === "24h" ? 86400 : 604800);
    const duration = period === "today" ? 86400 : now-start;
    const previousStart = start-duration;
    const previousEnd = period === "today" ? now-86400 : start;
    const catalog = await getCatalog(env);
    const rows = await env.DB.prepare(`SELECT restaurant_id,window_id,
      SUM(CASE WHEN clicked_at>=? THEN 1 ELSE 0 END) AS current_count,
      SUM(CASE WHEN clicked_at>=? AND clicked_at<? THEN 1 ELSE 0 END) AS previous_count
      FROM outbound_clicks WHERE clicked_at>=? AND clicked_at<?
      GROUP BY restaurant_id,window_id`).bind(start,previousStart,previousEnd,previousStart,now).all<{restaurant_id:string;window_id:string|null;current_count:number;previous_count:number}>();
    const counts = new Map(rows.results.map(row => [`${row.restaurant_id}:${row.window_id || "primary"}`, row]));
    const entries = unit === "restaurant"
      ? catalog.restaurants.map(r => ({id:r.id,restaurant_id:r.id,window_id:null as string|null}))
      : catalog.restaurants.flatMap(r => [
          ...(r.url ? [{id:`primary:${r.id}`,restaurant_id:r.id,window_id:null as string|null}] : []),
          ...r.windows.filter(w=>w.url).map(w=>({id:w.id,restaurant_id:r.id,window_id:w.id as string|null})),
        ]);
    const items = entries.map(entry => {
      const relevant = unit === "restaurant" ? rows.results.filter(row=>row.restaurant_id===entry.restaurant_id) : [counts.get(`${entry.restaurant_id}:${entry.window_id || "primary"}`)];
      return {...entry, count:relevant.reduce((sum,row)=>sum+(row?.current_count || 0),0), previous_count:relevant.reduce((sum,row)=>sum+(row?.previous_count || 0),0)};
    });
    const rank = (count:number, key:"count"|"previous_count") => 1+items.filter(item=>item[key]>count).length;
    return json({period,unit,as_of:now,items:items.map(item=>({...item,rank:item.count ? rank(item.count,"count") : 0,previous_rank:item.previous_count ? rank(item.previous_count,"previous_count") : null})).sort((a,b)=>b.count-a.count || a.id.localeCompare(b.id))});
  }
  if (path.startsWith("/media/") && (method === "GET" || method === "HEAD")) {
    const id = path.slice(7);
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError("图片不存在", 404);
    const published = await env.DB.prepare(
      `SELECT id FROM restaurants WHERE image_id=? AND status='published'
       UNION SELECT r.id FROM windows w JOIN restaurants r ON r.id=w.restaurant_id
       WHERE w.image_id=? AND r.status='published' LIMIT 1`,
    )
      .bind(id, id)
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
  if (path === "/api/contribute/quota" && method === "GET") {
    const visitor = await contributor(request, env);
    return json(await quota(env, visitor.key), 200,
      visitor.cookie ? { "Set-Cookie": visitor.cookie } : {});
  }
  if (path === "/api/contributions" && method === "POST") {
    if (!request.headers.get("Content-Type")?.startsWith("multipart/form-data;"))
      throw new HttpError("请使用表单提交", 415);
    const bytes = await readBody(request, 20 * 1024 * 1024);
    let form: FormData;
    try {
      form = await new Response(new Uint8Array(bytes), {
        headers: { "Content-Type": request.headers.get("Content-Type")! },
      }).formData();
    } catch {
      throw new InputError("上传内容格式不正确");
    }
    const details = form.get("details");
    let fields: Record<string, unknown>;
    if (typeof details === "string") {
      if (details.length > 16000) throw new InputError("投稿内容过长");
      try { fields = JSON.parse(details); } catch { throw new InputError("投稿内容格式不正确"); }
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) throw new InputError("投稿内容格式不正确");
    } else {
      fields = { restaurant_id: form.get("restaurant_id"), restaurant_name: form.get("restaurant_name"),
        window_name: form.get("window_name"), url: form.get("url") };
    }
    const data = validateContribution(fields);
    const windowData = data.mode === "legacy" ? [] : validateContributionWindows(fields.windows || []);
    async function uploadedImage(key: string) {
      const file = form.get(key);
      if (file == null) return null;
      if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024)
        throw new InputError("请上传不超过 5 MB 的二维码图片");
      const imageBytes = new Uint8Array(await file.arrayBuffer());
      const type = imageType(imageBytes);
      if (!type) throw new InputError("请上传有效的 JPEG 或 PNG 二维码图片");
      return { id: crypto.randomUUID(), bytes: imageBytes, type };
    }
    if (!data.include_main && (form.has("main_image") || form.has("image")))
      throw new InputError("未选择主入口时请勿上传主二维码");
    const mainImage = await uploadedImage(data.mode === "legacy" ? "image" : "main_image");
    if (data.mode === "legacy" && !mainImage) throw new InputError("请上传二维码图片");
    const windowImages: Awaited<ReturnType<typeof uploadedImage>>[] = [];
    for (let index = 0; index < windowData.length; index++)
      windowImages.push(await uploadedImage(`window_image_${index}`));
    if (data.restaurant_id && !(await env.DB.prepare(
      "SELECT id FROM restaurants WHERE id=? AND status='published'",
    ).bind(data.restaurant_id).first()))
      throw new InputError("所选餐厅不存在，请重新选择");
    const visitor = await contributor(request, env);
    if ((await quota(env, visitor.key)).used >= CONTRIBUTION_LIMIT)
      throw new HttpError("本浏览器 5 小时内已提交 10 条，请稍后再试", 429);
    const id = crypto.randomUUID();
    const images = [mainImage, ...windowImages].filter((item): item is NonNullable<typeof item> => item !== null);
    const stored: string[] = [];
    try {
      for (const image of images) {
        await env.IMAGES.put(image.id, image.bytes, { httpMetadata: { contentType: image.type } });
        stored.push(image.id);
      }
      await consumeQuota(env, visitor.key);
      await env.DB.batch([
        ...images.map(image => env.DB.prepare("INSERT INTO images(id,content_type) VALUES(?,?)").bind(image.id,image.type)),
        env.DB.prepare(
          `INSERT INTO contributions(id,browser_hash,restaurant_id,restaurant_name,window_name,url,image_id,mode,include_main,
           name_zh_hant,name_en,address,address_zh_hant,address_en,category,description,description_zh_hant,description_en,
           opens_app,wechat_mini_program,other_note,other_note_zh_hant,other_note_en)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).bind(id, visitor.key, data.restaurant_id, data.restaurant_name,
          data.window_name, data.url, mainImage?.id || null, data.mode, data.include_main ? 1 : 0,
          data.name_zh_hant, data.name_en, data.address, data.address_zh_hant, data.address_en,
          data.category, data.description, data.description_zh_hant, data.description_en,
          data.opens_app,data.wechat_mini_program,data.other_note,data.other_note_zh_hant,data.other_note_en),
        ...windowData.map((window,index) => env.DB.prepare(
          "INSERT INTO contribution_windows(id,contribution_id,name,url,image_id,sort_order) VALUES(?,?,?,?,?,?)",
        ).bind(crypto.randomUUID(),id,window.name,window.url,windowImages[index]?.id || null,index)),
      ]);
    } catch (error) {
      await Promise.all(stored.map(imageId => env.IMAGES.delete(imageId)));
      throw error;
    }
    return json({ id, status: "pending", quota: await quota(env, visitor.key) }, 201,
      visitor.cookie ? { "Set-Cookie": visitor.cookie } : {});
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
    if (password.length < 6) throw new InputError("密码至少 6 位");
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
      return json(await getCatalog(env, true));
    }
    if (path === "/api/admin/place" && method === "PUT") {
      const input = await body(request);
      const place = {
        name: textField(input.name, "地点名称", 80, true),
        address: textField(input.address, "地点地址", 160),
        description: textField(input.description, "地点说明", 160),
      };
      await env.DB.prepare(
        "UPDATE settings SET name=?,address=?,description=? WHERE id=1",
      )
        .bind(place.name, place.address, place.description)
        .run();
      return json({ ok: true });
    }
    if (path === "/api/admin/raffle-settings" && method === "PUT") {
      const data=validateRaffleSettings(await body(request));
      await env.DB.prepare(`UPDATE raffle_settings SET enabled=?,lines_zh_hans=?,lines_zh_hant=?,lines_en=? WHERE id=1`)
        .bind(data.enabled?1:0,JSON.stringify(data.lines_zh_hans),JSON.stringify(data.lines_zh_hant),JSON.stringify(data.lines_en)).run();
      return json({ok:true});
    }
    if (path === "/api/admin/images" && method === "POST") {
      await rateLimit(env, "image-upload", 100);
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
    if (path === "/api/admin/contributions" && method === "GET") {
      const [submissions, quotas, windows] = await Promise.all([
        env.DB.prepare("SELECT * FROM contributions ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100")
          .all<Contribution>(),
        env.DB.prepare("SELECT browser_hash,attempts,started_at,expires_at FROM contribution_quotas WHERE expires_at>? ORDER BY started_at DESC LIMIT 50")
          .bind(Math.floor(Date.now() / 1000)).all(),
        env.DB.prepare("SELECT * FROM contribution_windows ORDER BY sort_order").all(),
      ]);
      return json({ submissions: submissions.results.map(item => ({...item,
        windows: windows.results.filter(window => window.contribution_id === item.id)})), quotas: quotas.results,
        limit: CONTRIBUTION_LIMIT, window_seconds: CONTRIBUTION_WINDOW });
    }
    const contributionMatch = path.match(/^\/api\/admin\/contributions\/([a-f0-9-]{36})$/);
    if (contributionMatch && method === "PUT") {
      const existing = await env.DB.prepare("SELECT * FROM contributions WHERE id=? AND status='pending'")
        .bind(contributionMatch[1]).first<Contribution>();
      if (!existing) throw new HttpError("投稿已处理或不存在", 409);
      const input = await body(request);
      const data = validateContribution({...input,mode:existing.mode,
        include_main: existing.mode === "legacy" ? true : input.include_main});
      if (data.restaurant_id && !(await env.DB.prepare("SELECT id FROM restaurants WHERE id=? AND status='published'")
        .bind(data.restaurant_id).first()))
        throw new InputError("所选餐厅未发布或不存在");
      const existingWindows = await env.DB.prepare("SELECT id FROM contribution_windows WHERE contribution_id=? ORDER BY sort_order")
        .bind(existing.id).all<{id:string}>();
      const windowData = existing.mode === "legacy" ? [] : validateContributionWindows(input.windows || []);
      if (windowData.length !== existingWindows.results.length ||
        windowData.some((window,index) => window.id !== existingWindows.results[index].id))
        throw new InputError("窗口列表已变化，请刷新后重试");
      const result = await env.DB.batch([
        env.DB.prepare(`UPDATE contributions SET restaurant_id=?,restaurant_name=?,window_name=?,url=?,include_main=?,
          name_zh_hant=?,name_en=?,address=?,address_zh_hant=?,address_en=?,category=?,description=?,description_zh_hant=?,description_en=?,
          opens_app=?,wechat_mini_program=?,other_note=?,other_note_zh_hant=?,other_note_en=?
          WHERE id=? AND status='pending'`).bind(data.restaurant_id,data.restaurant_name,data.window_name,data.url,data.include_main ? 1 : 0,
            data.name_zh_hant,data.name_en,data.address,data.address_zh_hant,data.address_en,data.category,
            data.description,data.description_zh_hant,data.description_en,data.opens_app,data.wechat_mini_program,
            data.other_note,data.other_note_zh_hant,data.other_note_en,existing.id),
        ...windowData.map(window => env.DB.prepare(`UPDATE contribution_windows SET name=?,url=?,included=?
          WHERE id=? AND contribution_id=? AND EXISTS(SELECT 1 FROM contributions WHERE id=? AND status='pending')`)
          .bind(window.name,window.url,window.included ? 1 : 0,window.id,existing.id,existing.id)),
      ]);
      if (!result[0].meta.changes) throw new HttpError("投稿已处理或不存在", 409);
      return json({ ok: true });
    }
    const reviewMatch = path.match(/^\/api\/admin\/contributions\/([a-f0-9-]{36})\/(approve|reject)$/);
    if (reviewMatch && method === "POST") {
      const submission = await env.DB.prepare("SELECT * FROM contributions WHERE id=?")
        .bind(reviewMatch[1]).first<Contribution>();
      if (!submission || submission.status !== "pending")
        throw new HttpError("投稿已处理或不存在", 409);
      if (reviewMatch[2] === "reject") {
        const changed = await env.DB.prepare(
          "UPDATE contributions SET status='rejected',reviewed_at=? WHERE id=? AND status='pending' RETURNING id",
        ).bind(new Date().toISOString(), submission.id).first();
        if (!changed) throw new HttpError("投稿已被处理", 409);
        return json({ ok: true });
      }
      if (submission.restaurant_id && !(await env.DB.prepare(
        "SELECT id FROM restaurants WHERE id=? AND status='published'",
      ).bind(submission.restaurant_id).first()))
        throw new InputError("目标餐厅未发布或不存在，请修改投稿");
      if (submission.mode === "update" && !submission.restaurant_id)
        throw new InputError("目标餐厅已删除，请拒绝此投稿");
      const publishedId = crypto.randomUUID();
      const mark = env.DB.prepare(
        "UPDATE contributions SET status='approved',reviewed_at=?,published_id=? WHERE id=? AND status='pending'",
      ).bind(new Date().toISOString(), publishedId, submission.id);
      const publish = submission.mode === "update" && submission.restaurant_id
        ? env.DB.prepare(`UPDATE restaurants SET name=?,name_zh_hant=?,name_en=?,address=?,address_zh_hant=?,address_en=?,
            category=?,description=?,description_zh_hant=?,description_en=?,opens_app=?,wechat_mini_program=?,
            other_note=?,other_note_zh_hant=?,other_note_en=?,
            url=CASE WHEN ?=1 THEN ? ELSE url END,
            image_id=CASE WHEN ?=1 THEN ? ELSE image_id END,updated_at=?
            WHERE id=? AND status='published' AND EXISTS(SELECT 1 FROM contributions WHERE id=? AND status='approved' AND published_id=?)`)
          .bind(submission.restaurant_name,submission.name_zh_hant,submission.name_en,
            submission.address,submission.address_zh_hant,submission.address_en,submission.category,
            submission.description,submission.description_zh_hant,submission.description_en,
            submission.opens_app,submission.wechat_mini_program,submission.other_note,
            submission.other_note_zh_hant,submission.other_note_en,
            submission.include_main,submission.url,submission.include_main,submission.image_id,
            new Date().toISOString(),submission.restaurant_id,submission.id,publishedId)
        : submission.restaurant_id
        ? env.DB.prepare(
          `INSERT INTO windows(id,restaurant_id,name,url,image_id)
           SELECT ?,restaurant_id,CASE WHEN window_name='' THEN restaurant_name ELSE window_name END,url,image_id
           FROM contributions WHERE id=? AND status='approved' AND published_id=?`,
        ).bind(publishedId, submission.id, publishedId)
        : env.DB.prepare(
          `INSERT INTO restaurants(id,name,name_zh_hant,name_en,address,address_zh_hant,address_en,category,
            description,description_zh_hant,description_en,opens_app,wechat_mini_program,other_note,other_note_zh_hant,other_note_en,url,image_id,status)
           SELECT ?,restaurant_name,name_zh_hant,name_en,address,address_zh_hant,address_en,category,
            description,description_zh_hant,description_en,opens_app,wechat_mini_program,other_note,other_note_zh_hant,other_note_en,
            CASE WHEN include_main=1 THEN url ELSE '' END,
            CASE WHEN include_main=1 THEN image_id ELSE NULL END,'published'
           FROM contributions WHERE id=? AND status='approved' AND published_id=?`,
        ).bind(publishedId, submission.id, publishedId);
      const statements = [mark,publish];
      if (submission.mode !== "legacy") statements.push(env.DB.prepare(
        `INSERT INTO windows(id,restaurant_id,name,url,image_id,sort_order)
         SELECT cw.id,?,cw.name,cw.url,cw.image_id,cw.sort_order FROM contribution_windows cw
         JOIN contributions c ON c.id=cw.contribution_id
         WHERE c.id=? AND c.status='approved' AND c.published_id=? AND cw.included=1`,
      ).bind(submission.restaurant_id || publishedId,submission.id,publishedId));
      const result = await env.DB.batch(statements);
      if (!result[0].meta.changes) throw new HttpError("投稿已被处理", 409);
      if (!result[1].meta.changes) {
        await env.DB.prepare("UPDATE contributions SET status='pending',reviewed_at=NULL,published_id=NULL WHERE id=? AND published_id=?")
          .bind(submission.id, publishedId).run();
        throw new HttpError("发布失败，请重试", 409);
      }
      return json({ ok: true, published_id: publishedId });
    }
    if (path === "/api/admin/restaurants" && method === "POST") {
      const data = validateRestaurant(await body(request));
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
        `INSERT INTO restaurants(id,name,name_zh_hant,name_en,address,address_zh_hant,address_en,category,
          description,description_zh_hant,description_en,opens_app,wechat_mini_program,other_note,other_note_zh_hant,other_note_en,
          url,image_id,status,sort_order,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
        .bind(
          id,
          data.name,
          data.name_zh_hant,
          data.name_en,
          data.address,
          data.address_zh_hant,
          data.address_en,
          data.category,
          data.description,
          data.description_zh_hant,
          data.description_en,
          data.opens_app,
          data.wechat_mini_program,
          data.other_note,
          data.other_note_zh_hant,
          data.other_note_en,
          data.url,
          data.image_id,
          data.status,
          data.sort_order,
          null,
          now,
          now,
        )
        .run();
      return json({ id }, 201);
    }
    const windowCollection = path.match(/^\/api\/admin\/restaurants\/([a-f0-9-]{36})\/windows$/);
    if (windowCollection && method === "POST") {
      if (!(await env.DB.prepare("SELECT id FROM restaurants WHERE id=?")
        .bind(windowCollection[1]).first()))
        throw new HttpError("餐厅不存在", 404);
      const data = validateWindow(await body(request));
      if (data.image_id && !(await env.DB.prepare("SELECT id FROM images WHERE id=?")
        .bind(data.image_id).first()))
        throw new InputError("图片不存在，请重新上传");
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO windows(id,restaurant_id,name,url,image_id,sort_order) VALUES(?,?,?,?,?,?)",
      ).bind(id, windowCollection[1], data.name, data.url, data.image_id,
        data.sort_order).run();
      return json({ id }, 201);
    }
    const windowMatch = path.match(/^\/api\/admin\/windows\/([a-f0-9-]{36})$/);
    if (windowMatch && (method === "PUT" || method === "DELETE")) {
      const existing = await env.DB.prepare("SELECT * FROM windows WHERE id=?")
        .bind(windowMatch[1]).first<RestaurantWindow>();
      if (!existing) throw new HttpError("窗口不存在", 404);
      if (method === "DELETE") {
        await env.DB.prepare("DELETE FROM windows WHERE id=?").bind(existing.id).run();
        ctx.waitUntil(removeUnusedImage(env, existing.image_id));
        return json({ ok: true });
      }
      const data = validateWindow(await body(request));
      if (data.image_id && !(await env.DB.prepare("SELECT id FROM images WHERE id=?")
        .bind(data.image_id).first()))
        throw new InputError("图片不存在，请重新上传");
      await env.DB.prepare(
        "UPDATE windows SET name=?,url=?,image_id=?,sort_order=?,updated_at=? WHERE id=?",
      ).bind(data.name, data.url, data.image_id, data.sort_order,
        new Date().toISOString(), existing.id).run();
      if (existing.image_id !== data.image_id)
        ctx.waitUntil(removeUnusedImage(env, existing.image_id));
      return json({ ok: true });
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
        const oldWindows = await env.DB.prepare("SELECT image_id FROM windows WHERE restaurant_id=?")
          .bind(existing.id).all<{ image_id: string | null }>();
        await env.DB.prepare("DELETE FROM restaurants WHERE id=?")
          .bind(existing.id)
          .run();
        ctx.waitUntil(Promise.all([existing.image_id, ...oldWindows.results.map((w) => w.image_id)]
          .map((id) => removeUnusedImage(env, id))).then(() => {}));
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
      const now = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE restaurants SET name=?,name_zh_hant=?,name_en=?,address=?,address_zh_hant=?,address_en=?,category=?,
          description=?,description_zh_hant=?,description_en=?,opens_app=?,wechat_mini_program=?,other_note=?,other_note_zh_hant=?,other_note_en=?,
          url=?,image_id=?,status=?,sort_order=?,verified_at=?,updated_at=? WHERE id=?`,
      )
        .bind(
          data.name,
          data.name_zh_hant,
          data.name_en,
          data.address,
          data.address_zh_hant,
          data.address_en,
          data.category,
          data.description,
          data.description_zh_hant,
          data.description_en,
          data.opens_app,
          data.wechat_mini_program,
          data.other_note,
          data.other_note_zh_hant,
          data.other_note_en,
          data.url,
          data.image_id,
          data.status,
          data.sort_order,
          data.url === existing.url ? existing.verified_at : null,
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
      env.DB.prepare("DELETE FROM contribution_quotas WHERE expires_at<?").bind(now - 86400),
      env.DB.prepare("DELETE FROM outbound_clicks WHERE clicked_at<?").bind(now - 30*86400),
    ]);
    const stale = await env.DB.prepare(
      `SELECT id FROM images WHERE created_at < datetime('now','-1 day')
       AND id NOT IN (SELECT image_id FROM restaurants WHERE image_id IS NOT NULL)
       AND id NOT IN (SELECT image_id FROM windows WHERE image_id IS NOT NULL)
       AND id NOT IN (SELECT image_id FROM contributions WHERE image_id IS NOT NULL)
       AND id NOT IN (SELECT image_id FROM contribution_windows WHERE image_id IS NOT NULL) LIMIT 100`,
    ).all<{ id: string }>();
    for (const row of stale.results) await removeUnusedImage(env, row.id);
  },
} satisfies ExportedHandler<AppEnv>;
