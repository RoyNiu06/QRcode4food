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
  UsersRound,
  Heart, List, LayoutGrid, ArrowDownUp, Trophy,
} from "lucide-react";
import type { Catalog, Restaurant } from "../shared/types";
import {
  LanguageSwitch,
  localizedPlace,
  localizedRestaurant,
  useLocale,
} from "./locale";
import { Raffle } from "./raffle";
import { Contribute } from "./contribute";
import { SortDialog, RankingsDialog, storedIds, storeIds } from "./directory-extras";
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
    [category, setCategory] = useState(() => saved("qr-category") || "全部"),
    [view, setView] = useState<"cards"|"list">(() => {try{return localStorage.getItem("qr-view-v1") === "list" ? "list" : "cards";}catch{return "cards";}}),
    [favorites, setFavorites] = useState<string[]>(() => storedIds("qr-favorites-v1")),
    [order, setOrder] = useState<string[]>(() => storedIds("qr-order-v1")),
    [onlyFavorites, setOnlyFavorites] = useState(false),
    [sortOpen, setSortOpen] = useState(false),
    [rankingsOpen, setRankingsOpen] = useState(false);
  const [selected, setSelected] = useState<Restaurant | null>(null),
    [raffleOpen, setRaffleOpen] = useState(false),
    [contributeOpen, setContributeOpen] = useState(false),
    [menuRestaurant, setMenuRestaurant] = useState<Restaurant | null>(null),
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
  useEffect(() => { storeIds("qr-favorites-v1",favorites); },[favorites]);
  useEffect(() => { storeIds("qr-order-v1",order); },[order]);
  useEffect(() => { try{localStorage.setItem("qr-view-v1",view);}catch{/* Storage may be unavailable. */} },[view]);
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
      (data?.restaurants.filter(
        (r) =>
          (!onlyFavorites || favorites.includes(r.id)) &&
          (category === "全部" || r.category === category) &&
          `${r.name} ${r.name_zh_hant} ${r.name_en} ${r.address} ${r.address_zh_hant} ${r.address_en} ${r.description} ${r.description_zh_hant} ${r.description_en} ${r.category} ${t(r.category)} ${r.windows.map((w) => w.name).join(" ")}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ) || []).sort((a,b) => {
        const aIndex=order.indexOf(a.id), bIndex=order.indexOf(b.id);
        return (aIndex<0 ? Number.MAX_SAFE_INTEGER : aIndex)-(bIndex<0 ? Number.MAX_SAFE_INTEGER : bIndex);
      }),
    [data, query, category, locale, onlyFavorites, favorites, order],
  );
  function toggleFavorite(id:string) {setFavorites(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);}
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
          <button type="button" className="intro-raffle" onClick={()=>setRaffleOpen(true)} aria-label={t("今天吃什么")}>
            <Dices size={16} aria-hidden="true"/>
            <span>{t("今天吃什么")}</span>
          </button>
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
                {data?.restaurants.length ?? "—"} {t(locale === "en" && data?.restaurants.length === 1 ? "家餐厅单数" : "家餐厅")}
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
          <div className="home-actions">
            <button type="button" className="contribute-entry" onClick={() => setContributeOpen(true)}><UsersRound size={16}/>{t("一起补充")}</button>
            <button type="button" className="ranking-entry" onClick={() => setRankingsOpen(true)}><Trophy size={16}/>{t("跳转排行")}</button>
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
              <button className={`filter-chip favorite-filter ${onlyFavorites ? "active" : ""}`} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(value=>!value)}><Heart size={15} fill={onlyFavorites?"currentColor":"none"}/>{t("收藏")}</button>
            </div>
            <div className="directory-view-tools">
              <button className="view-tool" onClick={()=>setSortOpen(true)} aria-label={t("自定义排序")} title={t("自定义排序")}><ArrowDownUp size={17}/><span>{t("排序")}</span></button>
              <div className="view-toggle" role="group" aria-label={t("显示方式")}>
                <button className={view==="cards"?"active":""} aria-label={t("卡片视图")} aria-pressed={view==="cards"} onClick={()=>setView("cards")}><LayoutGrid size={17}/></button>
                <button className={view==="list"?"active":""} aria-label={t("列表视图")} aria-pressed={view==="list"} onClick={()=>setView("list")}><List size={17}/></button>
              </div>
            </div>
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
            <div className={`restaurant-grid ${view === "list" ? "list-view" : ""}`}>
              {filtered.map((r, i) => (
                <article className={`restaurant-card ${r.opens_app || r.wechat_mini_program || r.other_note ? "has-order-notes" : ""}`} key={r.id}>
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
                  <button className={`favorite-button ${favorites.includes(r.id)?"is-favorite":""}`} onClick={()=>toggleFavorite(r.id)} aria-label={`${favorites.includes(r.id)?t("取消收藏"):t("收藏")}：${localizedRestaurant(r,"name",locale)}`} aria-pressed={favorites.includes(r.id)} title={favorites.includes(r.id)?t("取消收藏"):t("收藏")}><Heart size={19} fill={favorites.includes(r.id)?"currentColor":"none"}/></button>
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
                  {(r.opens_app || r.wechat_mini_program || r.other_note) && <div className="restaurant-order-notes" aria-label={t("点餐方式备注")}>
                    {Boolean(r.opens_app)&&<span>{t("点击跳转 App")}</span>}
                    {Boolean(r.wechat_mini_program)&&<span>{t("可用微信小程序")}</span>}
                    {Boolean(r.other_note)&&<span className="other-note">{localizedRestaurant(r,"other_note",locale)}</span>}
                  </div>}
                  <div className="card-actions">
                    {r.windows.length ? (
                      <button className="order-button" onClick={() => setMenuRestaurant(r)}>
                        {t("选择点餐窗口")} <ArrowRight size={18} />
                      </button>
                    ) : r.url ? (
                      <a
                        className="order-button"
                        href={`/go/restaurant/${r.id}`}
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
          settings={data?.raffle}
          onClose={() => setRaffleOpen(false)}
          onChooseRestaurant={setMenuRestaurant}
        />
      )}
      {contributeOpen && <Contribute restaurants={data?.restaurants || []} onClose={() => setContributeOpen(false)} />}
      {menuRestaurant && <WindowMenu restaurant={menuRestaurant} onClose={() => setMenuRestaurant(null)} />}
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
                href={`/go/restaurant/${selected.id}`}
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
      {sortOpen && <SortDialog restaurants={data?.restaurants || []} order={order} onChange={setOrder} onClose={()=>setSortOpen(false)}/>}
      {rankingsOpen && <RankingsDialog restaurants={data?.restaurants || []} onClose={()=>setRankingsOpen(false)}/>}
    </div>
  );
}
function WindowMenu({ restaurant, onClose }: { restaurant: Restaurant; onClose: () => void }) {
  const { locale, t } = useLocale();
  const [image, setImage] = useState<string | null>(null);
  const entries = [
    ...(restaurant.url || restaurant.image_id ? [{
      id: restaurant.id, name: t("主点餐入口"), url: restaurant.url,
      image_id: restaurant.image_id,
    }] : []),
    ...restaurant.windows,
  ];
  return <Modal title={localizedRestaurant(restaurant, "name", locale)} onClose={onClose}>
    <div className="window-menu">
      <p>{t("选择窗口，直接打开对应的点餐页面。")}</p>
      {entries.map((entry, index) => <div className="window-choice" key={entry.id}>
        <span className="window-index">{String(index + 1).padStart(2, "0")}</span>
        <strong>{entry.name}</strong>
        {entry.url ? <a className="primary-button" href={entry.id===restaurant.id?`/go/restaurant/${restaurant.id}`:`/go/window/${entry.id}`} rel="noreferrer">
          {t("开始点餐")} <ExternalIcon />
        </a> : <span className="order-unavailable">{t("点餐入口待补充")}</span>}
        {entry.image_id && <button type="button" className="icon-button" aria-label={`${t("查看二维码")} ${entry.name}`} onClick={() => setImage(image === entry.image_id ? null : entry.image_id)}><QrCode size={19} /></button>}
      </div>)}
      {image && <div className="qr-preview"><img src={`/media/${image}`} alt={t("查看二维码")} /></div>}
    </div>
  </Modal>;
}
function ArrowUpRightTiny() {
  return <span aria-hidden="true">↗</span>;
}
