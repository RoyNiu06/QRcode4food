import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  ExternalLink,
  ImagePlus,
  LayoutGrid,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  AdminSession,
  Catalog,
  Place,
  Restaurant,
  RestaurantStatus,
} from "../shared/types";
import { validateUrl } from "../shared/validation";
import { api, Brand, CategoryIcon, categories, ErrorNotice, Modal } from "./ui";

const emptyCatalog: Catalog = {
  place: { name: "", address: "", description: "" },
  restaurants: [],
};
const statusLabel = { published: "已发布", draft: "草稿", disabled: "已停用" };

export default function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog),
    [tab, setTab] = useState<"restaurants" | "place" | "security">(
      "restaurants",
    );
  const [editing, setEditing] = useState<Restaurant | "new" | null>(null),
    [deleting, setDeleting] = useState<Restaurant | null>(null),
    [busy, setBusy] = useState(false);
  async function reload() {
    setCatalog(await api<Catalog>("/api/admin/catalog"));
  }
  async function loadSession() {
    try {
      setSession(await api<AdminSession>("/api/admin/session"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    document.title = "管理空间 — QRCode";
    void loadSession();
  }, []);
  useEffect(() => {
    if (session?.authenticated && !session.mustChange)
      void reload().catch((e) => setError(e.message));
  }, [session]);
  async function logout() {
    try {
      await api("/api/admin/logout", { method: "POST" });
      setSession({ authenticated: false });
      setCatalog(emptyCatalog);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/restaurants/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      await reload();
      setNotice("餐厅已删除");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!session)
    return (
      <div className="auth-page">
        <Brand />
        <div className="auth-card">
          <LoaderCircle className="spin" />
          <p>正在打开管理空间…</p>
          <ErrorNotice message={error} />
          {error && (
            <button
              className="secondary-button"
              onClick={() => void loadSession()}
            >
              重试
            </button>
          )}
        </div>
      </div>
    );
  if (!session.authenticated)
    return <Login onLogin={setSession} notice={notice} />;
  if (session.mustChange)
    return (
      <div className="auth-page">
        <Brand />
        <div className="auth-card">
          <span className="auth-symbol">
            <ShieldCheck size={26} />
          </span>
          <div className="eyebrow">WELCOME TO YOUR SPACE</div>
          <h1>先设置一个新密码</h1>
          <p>完成设置后，就可以开始收集附近的好味道。</p>
          <PasswordForm
            initial
            onDone={() => {
              setNotice("密码已更新，请使用新密码登录");
              setSession({ authenticated: false });
            }}
          />
        </div>
      </div>
    );
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Brand />
        <span className="admin-badge">管理空间</span>
        <div className="admin-header-actions">
          <a href="/" className="text-button">
            查看网站 <ExternalLink size={15} />
          </a>
          <button
            onClick={() => void logout()}
            className="icon-button"
            aria-label="退出登录"
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="sidebar-label">WORKSPACE</div>
          <nav aria-label="管理导航">
            <button
              className={tab === "restaurants" ? "selected" : ""}
              onClick={() => setTab("restaurants")}
            >
              <LayoutGrid size={19} />
              餐厅目录<span>{catalog.restaurants.length}</span>
            </button>
            <button
              className={tab === "place" ? "selected" : ""}
              onClick={() => setTab("place")}
            >
              <MapPin size={19} />
              地点设置
            </button>
            <button
              className={tab === "security" ? "selected" : ""}
              onClick={() => setTab("security")}
            >
              <LockKeyhole size={19} />
              账户安全
            </button>
          </nav>
          <div className="sidebar-note">
            <span className="sidebar-note-icon">
              <Settings2 size={20} />
            </span>
            <strong>小小目录，大大满足。</strong>
            <p>把点餐入口整理好，让每一餐都简单一点。</p>
          </div>
        </aside>
        <main className="admin-main">
          <ErrorNotice message={error} />
          {notice && (
            <div className="notice success" role="status">
              <CircleCheck size={17} />
              {notice}
              <button
                className="icon-button small"
                onClick={() => setNotice("")}
                aria-label="关闭提示"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "restaurants" && (
            <>
              <div className="admin-title-row">
                <div>
                  <div className="eyebrow">THE NEIGHBORHOOD COLLECTION</div>
                  <h1>
                    餐厅目录<span className="title-dot">.</span>
                  </h1>
                  <p>整理好味道，让大家一点就开餐。</p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setEditing("new")}
                >
                  <Plus size={19} />
                  添加餐厅
                </button>
              </div>
              <div className="stats-row">
                <div>
                  <span>全部餐厅</span>
                  <strong>
                    {String(catalog.restaurants.length).padStart(2, "0")}
                  </strong>
                </div>
                <div>
                  <span>正在展示</span>
                  <strong>
                    {String(
                      catalog.restaurants.filter(
                        (r) => r.status === "published",
                      ).length,
                    ).padStart(2, "0")}
                    <small>已发布</small>
                  </strong>
                </div>
                <div>
                  <span>当前地点</span>
                  <strong className="stat-place">
                    {catalog.place.name || "还未设置"}
                    <MapPin size={18} />
                  </strong>
                </div>
              </div>
              {!catalog.place.name && (
                <div className="setup-callout">
                  <div>
                    <strong>为目录添加一个地点</strong>
                    <p>选填，不影响添加和发布餐厅。</p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => setTab("place")}
                  >
                    设置地点 <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {catalog.restaurants.length ? (
                <div className="admin-list">
                  <div className="admin-list-heading">
                    <span>餐厅 / 点餐入口</span>
                    <span>状态与操作</span>
                  </div>
                  {catalog.restaurants.map((r) => (
                    <div className="admin-list-row" key={r.id}>
                      <span
                        className={`category-tile tone-${r.category.charCodeAt(0) % 4}`}
                      >
                        <CategoryIcon category={r.category} />
                      </span>
                      <div className="admin-restaurant-info">
                        <h3>{r.name}</h3>
                        <p>
                          {r.category} <span>·</span>{" "}
                          {r.address || catalog.place.name}
                        </p>
                      </div>
                      <span className={`status-pill ${r.status}`}>
                        {statusLabel[r.status]}
                      </span>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`编辑${r.name}`}
                          onClick={() => setEditing(r)}
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          className="icon-button danger-icon"
                          aria-label={`删除${r.name}`}
                          onClick={() => setDeleting(r)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-empty">
                  <span className="empty-icon">
                    <ImagePlus size={30} />
                  </span>
                  <h2>从第一张二维码开始</h2>
                  <p>上传餐厅的点餐码，自动识别成可以点击的网址。</p>
                  <button
                    className="text-button"
                    onClick={() => setEditing("new")}
                  >
                    添加第一家餐厅 <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </>
          )}
          {tab === "place" && (
            <>
              <div className="admin-title-row">
                <div>
                  <div className="eyebrow">A PLACE TO START</div>
                  <h1>
                    地点设置<span className="title-dot">.</span>
                  </h1>
                  <p>所有餐厅都会展示在这个地点的目录下。</p>
                </div>
              </div>
              <PlaceForm
                place={catalog.place}
                onSaved={async () => {
                  await reload();
                  setNotice("地点设置已保存，首页已更新");
                }}
              />
            </>
          )}
          {tab === "security" && (
            <>
              <div className="admin-title-row">
                <div>
                  <div className="eyebrow">KEEP IT YOURS</div>
                  <h1>
                    账户安全<span className="title-dot">.</span>
                  </h1>
                  <p>修改密码后，所有已登录的设备都会退出。</p>
                </div>
              </div>
              <div className="settings-card">
                <h2>修改管理员密码</h2>
                <PasswordForm
                  onDone={() => {
                    setNotice("密码已更新，请重新登录");
                    setSession({ authenticated: false });
                  }}
                />
              </div>
            </>
          )}
        </main>
      </div>
      {editing && (
        <RestaurantEditor
          restaurant={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
            setNotice("餐厅已保存，已发布内容会显示在首页");
          }}
        />
      )}
      {deleting && (
        <Modal
          title="删除这家餐厅？"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p className="modal-description">
            “{deleting.name}
            ”将从目录中移除，此操作不能撤销。暂时不展示可以在编辑中改为“已停用”。
          </p>
          <ErrorNotice message={error} />
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              取消
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "正在删除…" : "确认删除"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Login({
  onLogin,
  notice,
}: {
  onLogin: (session: AdminSession) => void;
  notice: string;
}) {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function readSetupToken() {
    const token =
      new URLSearchParams(location.hash.slice(1)).get("setup") || "";
    if (token) {
      try {
        sessionStorage.setItem("qr-setup", token);
      } catch {
        /* The link still works when storage is disabled. */
      }
      history.replaceState(null, "", location.pathname);
    }
    if (token) return token;
    try {
      return sessionStorage.getItem("qr-setup") || "";
    } catch {
      return "";
    }
  }
  const [setupToken, setSetupToken] = useState(readSetupToken);
  useEffect(() => {
    const update = () => setSetupToken(readSetupToken());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        await api<AdminSession>("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({ password, setupToken }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <header>
        <Brand />
        <a className="text-button" href="/">
          <ArrowLeft size={16} />
          返回目录
        </a>
      </header>
      <div className="auth-card">
        <span className="auth-symbol">
          <LockKeyhole size={26} />
        </span>
        <div className="eyebrow">A LITTLE SPACE FOR GOOD FOOD</div>
        <h1>欢迎回来。</h1>
        <p>登录管理空间，收集附近的好味道。</p>
        {notice && <div className="notice success">{notice}</div>}
        <form onSubmit={(e) => void submit(e)}>
          <label className="field">
            管理员密码
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="输入你的密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <ErrorNotice message={error} />
          <button className="primary-button full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                进入管理空间 <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        <p className="auth-footnote">
          <ShieldCheck size={14} />
          仅管理员可以上传与发布餐厅
        </p>
      </div>
      <span className="auth-bottom">QRCode / RoyiLab</span>
    </div>
  );
}

function PasswordForm({
  initial = false,
  onDone,
}: {
  initial?: boolean;
  onDone: () => void;
}) {
  const [oldPassword, setOld] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("两次新密码不一致");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/password", {
        method: "POST",
        body: JSON.stringify({ oldPassword, password }),
      });
      sessionStorage.removeItem("qr-setup");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)}>
      <label className="field">
        {initial ? "初始密码" : "当前密码"}
        <input
          type="password"
          autoComplete="current-password"
          required
          value={oldPassword}
          onChange={(e) => setOld(e.target.value)}
        />
      </label>
      <label className="field">
        新密码
        <input
          type="password"
          minLength={6}
          maxLength={128}
          autoComplete="new-password"
          required
          placeholder="至少 6 位，支持纯数字"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className="field">
        再次输入新密码
        <input
          type="password"
          minLength={6}
          maxLength={128}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <ErrorNotice message={error} />
      <button className="primary-button" disabled={busy}>
        {busy ? "正在更新…" : "保存新密码"}
        <Check size={17} />
      </button>
    </form>
  );
}

function PlaceForm({
  place,
  onSaved,
}: {
  place: Place;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(place),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/place", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-card">
      <h2>
        <MapPin size={21} />
        目录所在地点
      </h2>
      <form onSubmit={(e) => void submit(e)}>
        <label className="field">
          地点名称
          <input
            required
            maxLength={80}
            placeholder="例如：校园生活区 / 某某商场"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="field">
          详细地址 <span className="optional">选填</span>
          <input
            maxLength={160}
            placeholder="填写城市、街道与具体位置"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>
        <label className="field">
          地点说明 <span className="optional">选填</span>
          <textarea
            rows={3}
            maxLength={160}
            placeholder="例如：集合附近可以直接在线点餐的餐厅"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <ErrorNotice message={error} />
        <button className="primary-button" disabled={busy}>
          {busy ? "正在保存…" : "保存地点"}
          <Check size={17} />
        </button>
      </form>
    </div>
  );
}

function RestaurantEditor({
  restaurant,
  onClose,
  onSaved,
}: {
  restaurant: Restaurant | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: restaurant?.name || "",
    address: restaurant?.address || "",
    category: restaurant?.category || "中餐",
    description: restaurant?.description || "",
    url: restaurant?.url || "",
    image_id: restaurant?.image_id || null,
    status: (restaurant?.status === "disabled"
      ? "disabled"
      : "published") as RestaurantStatus,
    sort_order: restaurant?.sort_order || 0,
  });
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [uploadNote, setUploadNote] = useState("");
  const [preview, setPreview] = useState(
      restaurant?.image_id ? `/media/${restaurant.image_id}` : "",
    ),
    [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null),
    objectRef = useRef("");
  const disabled = busy || uploading;
  useEffect(
    () => () => {
      if (objectRef.current) URL.revokeObjectURL(objectRef.current);
    },
    [],
  );
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    setUploadNote("正在读取图片并识别二维码…");
    try {
      const { prepareImage } = await import("./image-upload");
      const result = await prepareImage(file);
      if (objectRef.current) URL.revokeObjectURL(objectRef.current);
      objectRef.current = URL.createObjectURL(result.blob);
      setPreview(objectRef.current);
      setFileBlob(result.blob);
      if (result.url) {
        try {
          validateUrl(result.url);
          setForm((f) => ({ ...f, url: result.url }));
          setUploadNote("网址已自动填入，可以直接发布。");
        } catch {
          setForm((f) => ({ ...f, url: "" }));
          setUploadNote(
            "识别出的内容不是可用的网页网址，请提供通用网页点餐链接。",
          );
        }
      } else {
        setForm((f) => ({ ...f, url: "" }));
        setUploadNote(result.decodeError);
      }
    } catch (e) {
      setError((e as Error).message);
      setUploadNote("");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function tryOpen() {
    try {
      const url = validateUrl(form.url);
      window.open(url, "_blank", "noopener,noreferrer");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
      "value",
    );
    const status = (action || form.status) as RestaurantStatus;
    setBusy(true);
    try {
      const url = form.url.trim() ? validateUrl(form.url) : "";
      let imageId = form.image_id;
      if (fileBlob) {
        const result = await api<{ id: string }>("/api/admin/images", {
          method: "POST",
          headers: { "Content-Type": fileBlob.type },
          body: fileBlob,
        });
        imageId = result.id;
        setForm((f) => ({ ...f, image_id: imageId }));
        setFileBlob(null);
      }
      await api(
        `/api/admin/restaurants${restaurant ? "/" + restaurant.id : ""}`,
        {
          method: restaurant ? "PUT" : "POST",
          body: JSON.stringify({ ...form, url, status, image_id: imageId }),
        },
      );
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={restaurant ? "编辑餐厅" : "添加餐厅"}
      onClose={() => {
        if (!disabled) onClose();
      }}
    >
      <form className="quick-editor" onSubmit={(e) => void save(e)}>
        <p className="editor-intro">只需填写店名。上传点餐码，网址自动填好。</p>
        <label className="field restaurant-name-field">
          餐厅名称 <span className="required-tag">必填</span>
          <input
            required
            maxLength={80}
            placeholder="这家好味道叫什么？"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <div className="quick-entry-grid">
          <section className="quick-upload">
            <input
              ref={fileRef}
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="上传二维码照片"
              disabled={disabled}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            <button
              type="button"
              className={`upload-zone ${preview ? "has-preview" : ""}`}
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <>
                  <img src={preview} alt="上传的二维码预览" />
                  <span className="replace-image">
                    <Upload size={15} />
                    更换二维码
                  </span>
                </>
              ) : (
                <>
                  <span className="upload-icon">
                    <ImagePlus size={27} />
                  </span>
                  <strong>上传点餐二维码</strong>
                  <span>从相册选择，自动识别网址</span>
                  <small>选填 · JPG / PNG / WebP · 10 MB 内</small>
                </>
              )}
            </button>
          </section>
          <section className="quick-link">
            <label className="field">
              点餐链接 <span className="optional">自动识别 / 选填</span>
              <textarea
                rows={3}
                maxLength={4096}
                placeholder="上传二维码自动填入，也可直接粘贴网址"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </label>
            {uploadNote && (
              <p
                className={`upload-note ${uploading ? "processing" : form.url ? "" : "decode-warning"}`}
                role="status"
              >
                {uploading ? (
                  <LoaderCircle className="spin" size={15} />
                ) : form.url ? (
                  <CircleCheck size={15} />
                ) : (
                  <ImagePlus size={15} />
                )}
                <span>{uploadNote}</span>
              </p>
            )}
            {form.url ? (
              <button
                type="button"
                className="text-button preview-link"
                disabled={disabled}
                onClick={tryOpen}
              >
                试打开链接 <ExternalLink size={15} />
              </button>
            ) : (
              <p className="field-hint">没有链接也能发布，之后随时补充。</p>
            )}
            {form.url.startsWith("http:") && (
              <p className="notice warning">
                该链接使用 HTTP，请留意商家页面。
              </p>
            )}
          </section>
        </div>
        <details className="optional-details">
          <summary>
            <Settings2 size={17} />
            <span>
              更多信息 <small>位置、分类、介绍等，均可不填</small>
            </span>
            <Plus size={16} />
          </summary>
          <div className="optional-fields">
            <label className="field">
              位置 / 分店 <span className="optional">选填</span>
              <input
                maxLength={160}
                placeholder="例如：商场 2 楼"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <div className="field-columns">
              <label className="field">
                分类{" "}
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                排序{" "}
                <input
                  type="number"
                  min={0}
                  max={9999}
                  step={1}
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm({ ...form, sort_order: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label className="field">
              一句话介绍 <span className="optional">选填</span>
              <textarea
                rows={2}
                maxLength={160}
                placeholder="招牌菜、口味，或者一句推荐"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            {restaurant && (
              <label className="field">
                展示状态
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as RestaurantStatus,
                    })
                  }
                >
                  <option value="published">发布到首页</option>
                  <option value="draft">草稿</option>
                  <option value="disabled">暂时停用</option>
                </select>
              </label>
            )}
          </div>
        </details>
        <div className="quick-editor-footer">
          <ErrorNotice message={error} />
          <div className="form-actions">
            <button
              type="submit"
              value="draft"
              className="secondary-button"
              disabled={disabled}
            >
              存为草稿
            </button>
            <button
              type="submit"
              value={form.status}
              className="primary-button"
              disabled={disabled}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Check size={17} />
              )}
              {busy
                ? "正在保存…"
                : form.status === "published"
                  ? "保存并发布"
                  : "保存修改"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
