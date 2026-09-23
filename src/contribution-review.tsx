import { useEffect, useState } from "react";
import { Check, Clock3, Image as ImageIcon, RefreshCw, Save, X } from "lucide-react";
import type { Contribution, QuotaActivity, Restaurant } from "../shared/types";
import { localizedRestaurant, useLocale } from "./locale";
import { api, ErrorNotice } from "./ui";
import { OrderNotesFields } from "./order-notes-fields";

type ReviewData = { submissions: Contribution[]; quotas: QuotaActivity[]; limit: number; window_seconds: number };
export function ContributionReview({ restaurants, onPublished }: {
  restaurants: Restaurant[];
  onPublished: () => Promise<unknown>;
}) {
  const { locale, t } = useLocale();
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  async function refresh() {
    try { setData(await api<ReviewData>("/api/admin/contributions")); setError(""); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void refresh(); }, []);
  const pending = data?.submissions.filter((s) => s.status === "pending") || [];
  const history = data?.submissions.filter((s) => s.status !== "pending") || [];
  return <div className="review-page">
    <div className="admin-title-row"><div><div className="eyebrow">MADE TOGETHER</div>
      <h1>{t("共创审核")}<span className="title-dot">.</span></h1>
      <p>{t("访客的二维码先在这里审核，确认后才会公开。")}</p></div>
      <button className="secondary-button" onClick={() => void refresh()}><RefreshCw size={16} />{t("刷新")}</button>
    </div>
    <div className="review-summary">
      <div><span>{t("待审核")}</span><strong>{pending.length}</strong></div>
      <div><span>{t("投稿限制")}</span><strong>{data?.limit ?? 10} <small>/ 5 {t("小时")}</small></strong></div>
      <div><span>{t("活跃浏览器")}</span><strong>{data?.quotas.length ?? 0}</strong></div>
    </div>
    <ErrorNotice message={error} />
    <div className="review-section-head"><h2>{t("待审核投稿")}</h2><span>{pending.length}</span></div>
    {pending.length ? pending.map((item) => <ReviewCard key={item.id} item={item} restaurants={restaurants} onChanged={async (published) => { await refresh(); if (published) await onPublished(); }} />)
      : <div className="review-empty"><Check size={22} /><p>{t("目前没有待审核投稿")}</p></div>}
    <section className="review-history">
      <button className="text-button" onClick={() => setShowHistory((value) => !value)}>{t("审核记录")} ({history.length})</button>
      {showHistory && history.map((item) => <div key={item.id} className="review-history-row">
        <span>{item.restaurant_name}{item.window_name ? ` · ${item.window_name}` : ""}</span>
        <span>{t(item.status === "approved" ? "已通过" : "已拒绝")}</span>
        <time>{new Date(item.reviewed_at || item.created_at).toLocaleString(locale)}</time>
      </div>)}
    </section>
    <section className="quota-activity">
      <div className="review-section-head"><h2>{t("投稿频率与重置时间")}</h2></div>
      <p>{t("按浏览器匿名编号展示当前 5 小时窗口；清除浏览器数据后可能获得新编号。")}</p>
      {data?.quotas.length ? data.quotas.map((item) => <div className="quota-row" key={item.browser_hash}>
        <span><ImageIcon size={15} /> {item.browser_hash.slice(0, 8)}</span>
        <strong>{item.attempts} / {data.limit}</strong>
        <time><Clock3 size={14} /> {new Date(item.expires_at * 1000).toLocaleString(locale)}</time>
      </div>) : <p>{t("暂无活跃投稿记录")}</p>}
    </section>
  </div>;
}

function ReviewCard({ item, restaurants, onChanged }: {
  item: Contribution; restaurants: Restaurant[];
  onChanged: (published: boolean) => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const [form, setForm] = useState({ restaurant_id: item.restaurant_id || "",
    restaurant_name: item.restaurant_name, window_name: item.window_name, url: item.url,
    include_main:item.include_main, name_zh_hant:item.name_zh_hant,name_en:item.name_en,
    address:item.address,address_zh_hant:item.address_zh_hant,address_en:item.address_en,
    category:item.category,description:item.description,description_zh_hant:item.description_zh_hant,
    description_en:item.description_en,opens_app:item.opens_app,wechat_mini_program:item.wechat_mini_program,
    other_note:item.other_note,other_note_zh_hant:item.other_note_zh_hant,other_note_en:item.other_note_en });
  const [windows,setWindows]=useState(item.windows.map(window=>({...window})));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(true);
  const legacy=item.mode==="legacy";
  const payload=()=>({...form,windows:windows.map(window=>({id:window.id,name:window.name,url:window.url,included:Boolean(window.included)}))});
  function change<K extends keyof typeof form>(key:K,value:(typeof form)[K]) {setForm(current=>({...current,[key]:value}));setSaved(false);}
  function changeWindow(id:string,patch:Partial<(typeof windows)[number]>) {setWindows(current=>current.map(window=>window.id===id?{...window,...patch}:window));setSaved(false);}
  async function save() {
    setBusy(true); setError("");
    try {
      await api(`/api/admin/contributions/${item.id}`, { method: "PUT", body: JSON.stringify(payload()) });
      setSaved(true);
      await onChanged(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function review(action: "approve" | "reject") {
    setBusy(true); setError("");
    try {
      if (!saved) await api(`/api/admin/contributions/${item.id}`, { method: "PUT", body: JSON.stringify(payload()) });
      await api(`/api/admin/contributions/${item.id}/${action}`, { method: "POST" });
      await onChanged(action === "approve");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <article className="review-card">
    <div className="review-card-top"><span>{t("访客投稿")}</span>
      <time>{new Date(item.created_at).toLocaleString(locale)}</time>
      <small>#{item.browser_hash.slice(0, 8)}</small></div>
    <div className="review-card-body">
      {item.image_id?<a href={`/media/${item.image_id}`} target="_blank" rel="noreferrer" className="review-image"><img src={`/media/${item.image_id}`} alt={t("投稿二维码")} /></a>
        :<div className="review-image empty">{t("没有主二维码")}</div>}
      <div className="review-fields">
        <label className="field">{t("发布到")}
          <select value={form.restaurant_id} disabled={!legacy} onChange={(e) => { const id = e.target.value; setForm({ ...form, restaurant_id: id, restaurant_name: restaurants.find((r) => r.id === id)?.name || form.restaurant_name }); setSaved(false); }}>
            <option value="">{t("一家新餐厅")}</option>
            {restaurants.filter((r) => r.status === "published").map((r) => <option key={r.id} value={r.id}>{localizedRestaurant(r, "name", locale)}</option>)}
          </select>
        </label>
        <label className="field">{t("餐厅名称")}<input value={form.restaurant_name} maxLength={80} onChange={(e) => change("restaurant_name",e.target.value)} /></label>
        {legacy&&form.restaurant_id&&<label className="field">{t("窗口名称")}<input value={form.window_name} maxLength={80} onChange={(e) => change("window_name",e.target.value)} /></label>}
        {!legacy&&<>
          <div className="field-columns"><label className="field">{t("繁体中文名称")}<input lang="zh-Hant" maxLength={80} value={form.name_zh_hant} onChange={e=>change("name_zh_hant",e.target.value)}/></label>
            <label className="field">{t("英文名称")}<input lang="en" maxLength={80} value={form.name_en} onChange={e=>change("name_en",e.target.value)}/></label></div>
          <details className="contribute-details"><summary>{t("更多信息")}</summary><div className="contribute-detail-content">
            <label className="field">{t("位置 / 分店")}<input maxLength={160} value={form.address} onChange={e=>change("address",e.target.value)}/></label>
            <div className="field-columns"><label className="field">{t("繁体中文位置")}<input lang="zh-Hant" maxLength={160} value={form.address_zh_hant} onChange={e=>change("address_zh_hant",e.target.value)}/></label>
              <label className="field">{t("英文位置")}<input lang="en" maxLength={160} value={form.address_en} onChange={e=>change("address_en",e.target.value)}/></label></div>
            <label className="field">{t("分类")}<input maxLength={20} value={form.category} onChange={e=>change("category",e.target.value)}/></label>
            <label className="field">{t("一句话介绍")}<textarea rows={2} maxLength={160} value={form.description} onChange={e=>change("description",e.target.value)}/></label>
            <div className="field-columns"><label className="field">{t("繁体中文介绍")}<textarea rows={2} maxLength={160} value={form.description_zh_hant} onChange={e=>change("description_zh_hant",e.target.value)}/></label>
              <label className="field">{t("英文介绍")}<textarea rows={2} maxLength={160} value={form.description_en} onChange={e=>change("description_en",e.target.value)}/></label></div>
          </div></details>
          <OrderNotesFields value={form} onChange={patch=>{setForm(current=>({...current,...patch}));setSaved(false);}}/>
          <label className="contribute-choice"><input type="checkbox" checked={!form.include_main} onChange={e=>change("include_main",e.target.checked?0:1)}/><span>{t("没有主二维码")}</span></label>
        </>}
        {(legacy||Boolean(form.include_main))&&<label className="field">{t("点餐链接")}<textarea rows={2} value={form.url} maxLength={4096} onChange={(e) => change("url",e.target.value)} /></label>}
      </div>
    </div>
    {!legacy&&Boolean(windows.length)&&<div className="review-windows"><h3>{t("点餐窗口")} · {windows.length}</h3>{windows.map((window,index)=><div className="review-window" key={window.id}>
      {window.image_id?<a href={`/media/${window.image_id}`} target="_blank" rel="noreferrer"><img src={`/media/${window.image_id}`} alt={`${t("投稿二维码")} ${index+1}`}/></a>:<span className="review-window-empty">{t("无图片")}</span>}
      <div className="review-window-fields"><label className="field">{t("窗口名称")}<input maxLength={80} value={window.name} onChange={e=>changeWindow(window.id,{name:e.target.value})}/></label>
        <label className="field">{t("点餐链接")}<input maxLength={4096} value={window.url} onChange={e=>changeWindow(window.id,{url:e.target.value})}/></label>
        <label className="contribute-choice"><input type="checkbox" checked={Boolean(window.included)} onChange={e=>changeWindow(window.id,{included:e.target.checked?1:0})}/><span>{t("审核通过时发布此窗口")}</span></label>
      </div>
    </div>)}</div>}
    <ErrorNotice message={error} />
    <div className="review-actions">
      <button className="secondary-button" disabled={busy || saved} onClick={() => void save()}><Save size={16} />{t("保存修改")}</button>
      <button className="secondary-button" disabled={busy} onClick={() => void review("reject")}><X size={16} />{t("拒绝")}</button>
      <button className="primary-button" disabled={busy} onClick={() => void review("approve")}><Check size={16} />{t("审核通过并发布")}</button>
    </div>
  </article>;
}
