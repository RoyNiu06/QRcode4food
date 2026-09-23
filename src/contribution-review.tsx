import { useEffect, useState } from "react";
import { Check, Clock3, Image as ImageIcon, RefreshCw, Save, X } from "lucide-react";
import type { Contribution, QuotaActivity, Restaurant } from "../shared/types";
import { localizedRestaurant, useLocale } from "./locale";
import { api, ErrorNotice } from "./ui";

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
    restaurant_name: item.restaurant_name, window_name: item.window_name, url: item.url });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(true);
  async function save() {
    setBusy(true); setError("");
    try {
      await api(`/api/admin/contributions/${item.id}`, { method: "PUT", body: JSON.stringify(form) });
      setSaved(true);
      await onChanged(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function review(action: "approve" | "reject") {
    setBusy(true); setError("");
    try {
      if (!saved) await api(`/api/admin/contributions/${item.id}`, { method: "PUT", body: JSON.stringify(form) });
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
      <a href={`/media/${item.image_id}`} target="_blank" rel="noreferrer" className="review-image"><img src={`/media/${item.image_id}`} alt={t("投稿二维码")} /></a>
      <div className="review-fields">
        <label className="field">{t("发布到")}
          <select value={form.restaurant_id} onChange={(e) => { const id = e.target.value; setForm({ ...form, restaurant_id: id, restaurant_name: restaurants.find((r) => r.id === id)?.name || form.restaurant_name }); setSaved(false); }}>
            <option value="">{t("一家新餐厅")}</option>
            {restaurants.filter((r) => r.status === "published").map((r) => <option key={r.id} value={r.id}>{localizedRestaurant(r, "name", locale)}</option>)}
          </select>
        </label>
        <label className="field">{t("餐厅名称")}<input value={form.restaurant_name} maxLength={80} onChange={(e) => { setForm({ ...form, restaurant_name: e.target.value }); setSaved(false); }} /></label>
        {form.restaurant_id && <label className="field">{t("窗口名称")}<input value={form.window_name} maxLength={80} onChange={(e) => { setForm({ ...form, window_name: e.target.value }); setSaved(false); }} /></label>}
        <label className="field">{t("点餐链接")}<textarea rows={2} value={form.url} maxLength={4096} onChange={(e) => { setForm({ ...form, url: e.target.value }); setSaved(false); }} /></label>
      </div>
    </div>
    <ErrorNotice message={error} />
    <div className="review-actions">
      <button className="secondary-button" disabled={busy || saved} onClick={() => void save()}><Save size={16} />{t("保存修改")}</button>
      <button className="secondary-button" disabled={busy} onClick={() => void review("reject")}><X size={16} />{t("拒绝")}</button>
      <button className="primary-button" disabled={busy} onClick={() => void review("approve")}><Check size={16} />{t("审核通过并发布")}</button>
    </div>
  </article>;
}
