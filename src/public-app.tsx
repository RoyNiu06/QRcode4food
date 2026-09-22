import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Search,
  X,
  QrCode,
  Copy,
  Check,
  MapPin,
  Utensils,
  RefreshCw,
} from "lucide-react";
import type { Catalog, Restaurant } from "../shared/types";
import {
  api,
  Brand,
  CategoryIcon,
  ErrorNotice,
  ExternalIcon,
  Footer,
  Modal,
  PlacePill,
} from "./ui";

function saved(key: string) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
function remember(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* Browsing still works with storage disabled. */
  }
}

export function PublicApp() {
  const [data, setData] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => saved("qr-search")),
    [category, setCategory] = useState(() => saved("qr-category") || "全部");
  const [selected, setSelected] = useState<Restaurant | null>(null),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api<Catalog>("/api/catalog"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    remember("qr-search", query);
    remember("qr-category", category);
  }, [query, category]);
  useEffect(() => {
    if (!data) return;
    const y = Number(saved("qr-scroll")) || 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
    const handle = () => remember("qr-scroll", String(window.scrollY));
    window.addEventListener("pagehide", handle);
    return () => window.removeEventListener("pagehide", handle);
  }, [data]);
  const available = useMemo(
    () => ["全部", ...new Set(data?.restaurants.map((r) => r.category) || [])],
    [data],
  );
  useEffect(() => {
    if (data && !available.includes(category)) setCategory("全部");
  }, [available, category, data]);
  const filtered = useMemo(
    () =>
      data?.restaurants.filter(
        (r) =>
          (category === "全部" || r.category === category) &&
          `${r.name} ${r.address} ${r.description} ${r.category}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ) || [],
    [data, query, category],
  );
  function openQr(restaurant: Restaurant) {
    setSelected(restaurant);
    setCopied(false);
    setCopyError("");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(selected!.url);
      setCopied(true);
    } catch {
      setCopyError("复制未成功，请长按下方网址复制");
    }
  }
  return (
    <div className="site-shell">
      <a className="skip-link" href="#restaurants">
        跳到餐厅列表
      </a>
      <header className="site-header">
        <Brand />
        <div className="header-right">
          <span className="header-nav">附近餐厅</span>
          <span className="header-divider" />
          <PlacePill name={data?.place.name || ""} />
        </div>
      </header>
      <main>
        <section className="intro-section" aria-labelledby="page-title">
          <div className="intro-copy">
            <h1 id="page-title">
              下一餐，<span>吃什么？</span>
            </h1>
            <p>是啊，吃什么？</p>
          </div>
        </section>
        <section id="restaurants" className="directory" aria-label="餐厅目录">
          <div className="directory-tools">
            <div className="section-heading">
              <h2>附近好味</h2>
              <span className="count-label">
                {data?.restaurants.length ?? "—"} 家餐厅
              </span>
            </div>
            <div className="search-field">
              <Search size={19} aria-hidden="true" />
              <input
                aria-label="搜索餐厅"
                placeholder="想吃什么？搜搜店名或美食"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="icon-button small"
                  aria-label="清空搜索"
                  onClick={() => setQuery("")}
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>
          <div className="filter-row">
            <div className="filters" aria-label="餐厅分类">
              {available.map((item) => (
                <button
                  key={item}
                  className={`filter-chip ${category === item ? "active" : ""}`}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <span className="directory-note">
              选一家，直接点餐 <ArrowRight size={15} />
            </span>
          </div>
          {loading ? (
            <div
              className="restaurant-grid"
              aria-label="正在加载餐厅"
              aria-busy="true"
            >
              {[0, 1, 2].map((i) => (
                <div className="restaurant-card skeleton" key={i}>
                  <div />
                  <div />
                  <div />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="empty-state">
              <RefreshCw size={32} />
              <h3>这次没能加载出来</h3>
              <p>{error}</p>
              <button className="primary-button" onClick={() => void load()}>
                重新加载 <RefreshCw size={16} />
              </button>
            </div>
          ) : filtered.length ? (
            <div className="restaurant-grid">
              {filtered.map((r, i) => (
                <article className="restaurant-card" key={r.id}>
                  <div className="card-top">
                    <span
                      className={`category-tile tone-${(r.category.charCodeAt(0) || 0) % 4}`}
                    >
                      <CategoryIcon category={r.category} />
                    </span>
                    <span className="category-label">{r.category}</span>
                    <span className="card-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3>{r.name}</h3>
                  <p className="restaurant-address">
                    <MapPin size={14} />
                    <span>{r.address || data?.place.name}</span>
                  </p>
                  <p className="restaurant-description">
                    {r.description || "把喜欢的味道，安排进今天。"}
                  </p>
                  <div className="card-actions">
                    <a
                      className="order-button"
                      href={r.url}
                      rel="noreferrer"
                      onClick={() =>
                        remember("qr-scroll", String(window.scrollY))
                      }
                    >
                      开始点餐 <ExternalIcon />
                    </a>
                    {r.image_id && (
                      <button
                        className="qr-button"
                        onClick={() => openQr(r)}
                        aria-label={`查看${r.name}的二维码`}
                        title="查看二维码"
                      >
                        <QrCode size={21} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : data?.restaurants.length ? (
            <div className="empty-state">
              <Search size={32} />
              <h3>还没找到这个味道</h3>
              <p>换个关键词，或者看看全部餐厅。</p>
              <button
                className="secondary-button"
                onClick={() => {
                  setQuery("");
                  setCategory("全部");
                }}
              >
                查看全部餐厅 <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="empty-state opening-state">
              <div className="empty-icon">
                <Utensils size={30} strokeWidth={1.5} />
              </div>
              <span className="eyebrow">GOOD FOOD IS ON THE WAY</span>
              <h3>这里的好味道，正在集合。</h3>
              <p>餐厅上线后，你可以在这里一键打开点餐。</p>
              <span className="empty-bottom">
                不用扫码，不用登录。
                <ArrowUpRightTiny />
              </span>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="end-note">
              <span />
              好好吃饭，慢慢生活。
              <span />
            </div>
          )}
        </section>
      </main>
      <Footer />
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <div className="qr-preview">
            <img
              src={`/media/${selected.image_id}`}
              alt={`${selected.name}的点餐二维码`}
            />
          </div>
          <p className="modal-description">也可以直接点餐，无需再次扫码。</p>
          <a
            className="primary-button full"
            href={selected.url}
            rel="noreferrer"
          >
            开始点餐 <ExternalIcon />
          </a>
          <button className="secondary-button full" onClick={() => void copy()}>
            {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
            {copied ? "链接已复制" : "复制点餐链接"}
          </button>
          <ErrorNotice message={copyError} />
          {copyError && <p className="break-url">{selected.url}</p>}
        </Modal>
      )}
    </div>
  );
}
function ArrowUpRightTiny() {
  return <span aria-hidden="true">↗</span>;
}
