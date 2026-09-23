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
  Dices,
} from "lucide-react";
import type { Catalog, Restaurant } from "../shared/types";
import {
  LanguageSwitch,
  localizedPlace,
  localizedRestaurant,
  useLocale,
} from "./locale";
import { Raffle } from "./raffle";
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
  const { locale, t } = useLocale();
  const [data, setData] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => saved("qr-search")),
    [category, setCategory] = useState(() => saved("qr-category") || "全部");
  const [selected, setSelected] = useState<Restaurant | null>(null),
    [raffleOpen, setRaffleOpen] = useState(false),
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
    document.title = `QRCode — ${t("附近好味，一点即达。")}`;
  }, [locale]);
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
          `${r.name} ${r.name_zh_hant} ${r.name_en} ${r.address} ${r.address_zh_hant} ${r.address_en} ${r.description} ${r.description_zh_hant} ${r.description_en} ${r.category} ${t(r.category)}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ) || [],
    [data, query, category, locale],
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
        {t("跳到餐厅列表")}
      </a>
      <header className="site-header">
        <Brand />
        <div className="header-right">
          <span className="header-nav">{t("附近餐厅")}</span>
          <span className="header-divider" />
          <PlacePill name={data?.place.name || ""} />
          <LanguageSwitch />
        </div>
      </header>
      <main>
        <section className="intro-section" aria-labelledby="page-title">
          <div className="intro-copy">
            <h1 id="page-title">
              {t("下一餐，")}
              <span>{t("吃什么？")}</span>
            </h1>
            <p>{t("是啊，吃什么？")}</p>
          </div>
        </section>
        <section
          id="restaurants"
          className="directory"
          aria-label={t("餐厅目录")}
        >
          <div className="directory-tools">
            <div className="section-heading">
              <h2>{t("附近好味")}</h2>
              <span className="count-label">
                {data?.restaurants.length ?? "—"} {t("家餐厅")}
              </span>
            </div>
            <div className="search-field">
              <Search size={19} aria-hidden="true" />
              <input
                aria-label={t("搜索餐厅")}
                placeholder={t("想吃什么？搜搜店名或美食")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="icon-button small"
                  aria-label={t("清空搜索")}
                  onClick={() => setQuery("")}
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>
          <div className="filter-row">
            <div className="filters" aria-label={t("餐厅分类")}>
              {available.map((item) => (
                <button
                  key={item}
                  className={`filter-chip ${category === item ? "active" : ""}`}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {t(item)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="raffle-entry"
              onClick={() => setRaffleOpen(true)}
            >
              <Dices size={17} />
              <span>{t("今天吃什么")}</span>
              <ArrowRight size={15} />
            </button>
          </div>
          {loading ? (
            <div
              className="restaurant-grid"
              aria-label={t("正在加载餐厅")}
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
              <h3>{t("这次没能加载出来")}</h3>
              <p>{t(error)}</p>
              <button className="primary-button" onClick={() => void load()}>
                {t("重新加载")} <RefreshCw size={16} />
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
                    <span className="category-label">{t(r.category)}</span>
                    <span className="card-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3>{localizedRestaurant(r, "name", locale)}</h3>
                  <p className="restaurant-address">
                    {(r.address || data?.place.name) && <MapPin size={14} />}
                    <span>
                      {localizedRestaurant(r, "address", locale) ||
                        localizedPlace(data?.place.name || "", locale)}
                    </span>
                  </p>
                  <p className="restaurant-description">
                    {localizedRestaurant(r, "description", locale) ||
                      t("把喜欢的味道，安排进今天。")}
                  </p>
                  <div className="card-actions">
                    {r.url ? (
                      <a
                        className="order-button"
                        href={r.url}
                        rel="noreferrer"
                        onClick={() =>
                          remember("qr-scroll", String(window.scrollY))
                        }
                      >
                        {t("开始点餐")} <ExternalIcon />
                      </a>
                    ) : (
                      <span className="order-unavailable">
                        {t("点餐入口待补充")}
                      </span>
                    )}
                    {r.image_id && (
                      <button
                        className="qr-button"
                        onClick={() => openQr(r)}
                        aria-label={`${t("查看二维码")}：${localizedRestaurant(r, "name", locale)}`}
                        title={t("查看二维码")}
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
              <h3>{t("还没找到这个味道")}</h3>
              <p>{t("换个关键词，或者看看全部餐厅。")}</p>
              <button
                className="secondary-button"
                onClick={() => {
                  setQuery("");
                  setCategory("全部");
                }}
              >
                {t("查看全部餐厅")} <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="empty-state opening-state">
              <div className="empty-icon">
                <Utensils size={30} strokeWidth={1.5} />
              </div>
              <span className="eyebrow">GOOD FOOD IS ON THE WAY</span>
              <h3>{t("这里的好味道，正在集合。")}</h3>
              <p>{t("餐厅上线后，你可以在这里一键打开点餐。")}</p>
              <span className="empty-bottom">
                {t("不用扫码，不用登录。")}
                <ArrowUpRightTiny />
              </span>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="end-note">
              <span />
              {t("好好吃饭，慢慢生活。")}
              <span />
            </div>
          )}
        </section>
      </main>
      <Footer />
      {raffleOpen && (
        <Raffle
          restaurants={data?.restaurants || []}
          onClose={() => setRaffleOpen(false)}
        />
      )}
      {selected && (
        <Modal
          title={localizedRestaurant(selected, "name", locale)}
          onClose={() => setSelected(null)}
        >
          <div className="qr-preview">
            <img
              src={`/media/${selected.image_id}`}
              alt={`${localizedRestaurant(selected, "name", locale)} ${t("查看二维码")}`}
            />
          </div>
          {selected.url ? (
            <>
              <p className="modal-description">
                {t("也可以直接点餐，无需再次扫码。")}
              </p>
              <a
                className="primary-button full"
                href={selected.url}
                rel="noreferrer"
              >
                {t("开始点餐")} <ExternalIcon />
              </a>
              <button
                className="secondary-button full"
                onClick={() => void copy()}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                {t(copied ? "链接已复制" : "复制点餐链接")}
              </button>
              <ErrorNotice message={copyError} />
              {copyError && <p className="break-url">{selected.url}</p>}
            </>
          ) : (
            <p className="modal-description">
              {t("点餐链接待补充，可先查看或保存二维码。")}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
function ArrowUpRightTiny() {
  return <span aria-hidden="true">↗</span>;
}
