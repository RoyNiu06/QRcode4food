import { useRef, useState } from "react";
import { Check, ImagePlus, LoaderCircle, Plus, Trash2, Upload } from "lucide-react";
import type { Restaurant, RestaurantWindow } from "../shared/types";
import { localizedRestaurant, useLocale } from "./locale";
import { api, ErrorNotice, Modal } from "./ui";

type Draft = { key: string; name: string; url: string; blob: Blob; preview: string; note: string };
export function WindowManager({ restaurant, onClose, onChanged }: {
  restaurant: Restaurant;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const [windows, setWindows] = useState(restaurant.windows);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  async function refresh() {
    const catalog = await api<{ restaurants: Restaurant[] }>("/api/admin/catalog");
    setWindows(catalog.restaurants.find((r) => r.id === restaurant.id)?.windows || []);
    await onChanged();
  }
  async function pick(files: FileList | null) {
    if (!files?.length) return;
    if (files.length > 20 || drafts.length + files.length > 20) {
      setError(t("每次最多批量上传 20 张图片")); return;
    }
    setBusy(true); setError("");
    try {
      const { prepareImage } = await import("./image-upload");
      const added: Draft[] = [];
      for (const [index, file] of Array.from(files).entries()) {
        const result = await prepareImage(file);
        added.push({ key: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || `${t("窗口")} ${index + 1}`,
          url: /^https?:\/\//i.test(result.url) ? result.url : "",
          blob: result.blob, preview: URL.createObjectURL(result.blob), note: result.url ? t("网址已自动填入，可以直接发布。") : t(result.decodeError) });
      }
      setDrafts((current) => [...current, ...added]);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  function removeDraft(key: string) {
    setDrafts((current) => {
      const item = current.find((d) => d.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return current.filter((d) => d.key !== key);
    });
  }
  async function uploadAll() {
    if (!drafts.length) return;
    setBusy(true); setError(""); setNotice("");
    let completed = 0;
    try {
      for (const draft of drafts) {
        if (!draft.name.trim()) throw new Error(t("请填写窗口名称"));
        const image = await api<{ id: string }>("/api/admin/images", {
          method: "POST", headers: { "Content-Type": draft.blob.type }, body: draft.blob,
        });
        await api(`/api/admin/restaurants/${restaurant.id}/windows`, {
          method: "POST", body: JSON.stringify({ name: draft.name, url: draft.url,
            image_id: image.id, sort_order: windows.length + completed }),
        });
        completed++;
        URL.revokeObjectURL(draft.preview);
      }
      setDrafts([]);
      setNotice(t("窗口二维码已发布"));
    } catch (e) {
      setDrafts((current) => current.slice(completed));
      setError((e as Error).message);
    } finally {
      if (completed) await refresh();
      setBusy(false);
    }
  }
  async function addManual() {
    setBusy(true); setError("");
    try {
      await api(`/api/admin/restaurants/${restaurant.id}/windows`, {
        method: "POST", body: JSON.stringify({ name: manualName, url: manualUrl }),
      });
      setManualName(""); setManualUrl("");
      await refresh();
      setNotice(t("窗口已添加"));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function saveWindow(window: RestaurantWindow) {
    setBusy(true); setError("");
    try {
      await api(`/api/admin/windows/${window.id}`, { method: "PUT",
        body: JSON.stringify(window) });
      await refresh();
      setNotice(t("窗口已保存"));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function deleteWindow(window: RestaurantWindow) {
    if (!globalThis.confirm(t("确定删除这个窗口吗？"))) return;
    setBusy(true); setError("");
    try {
      await api(`/api/admin/windows/${window.id}`, { method: "DELETE" });
      await refresh();
      setNotice(t("窗口已删除"));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal wide title={`${localizedRestaurant(restaurant, "name", locale)} · ${t("点餐窗口")}`} onClose={() => { if (!busy) { drafts.forEach((draft) => URL.revokeObjectURL(draft.preview)); onClose(); } }}>
    <div className="window-manager">
      <p className="editor-intro">{t("为不同窗口分别上传二维码，访客点开餐厅后选择窗口。")}</p>
      {restaurant.url || restaurant.image_id ? <div className="window-existing primary-entry">
        <strong>{t("主点餐入口")}</strong><span>{t("在餐厅编辑中修改")}</span>
      </div> : null}
      {windows.map((window) => <div className="window-existing" key={window.id}>
        {window.image_id && <img src={`/media/${window.image_id}`} alt={window.name} />}
        <div className="window-fields">
          <input aria-label={t("窗口名称")} maxLength={80} value={window.name} onChange={(e) => setWindows((items) => items.map((item) => item.id === window.id ? { ...item, name: e.target.value } : item))} />
          <textarea aria-label={t("点餐链接")} rows={2} maxLength={4096} value={window.url} onChange={(e) => setWindows((items) => items.map((item) => item.id === window.id ? { ...item, url: e.target.value } : item))} />
        </div>
        <div className="window-actions">
          <button className="icon-button" title={t("保存修改")} aria-label={`${t("保存修改")} ${window.name}`} disabled={busy} onClick={() => void saveWindow(window)}><Check size={18} /></button>
          <button className="icon-button danger-icon" title={t("删除")} aria-label={`${t("删除")} ${window.name}`} disabled={busy} onClick={() => void deleteWindow(window)}><Trash2 size={18} /></button>
        </div>
      </div>)}
      <input ref={fileRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label={t("批量上传二维码")} onChange={(e) => void pick(e.target.files)} />
      <button className="batch-upload-button" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
        <ImagePlus size={22} /><strong>{t("批量上传二维码")}</strong><span>{t("一次选择多张，逐张确认窗口名称和点餐链接")}</span>
      </button>
      {drafts.map((draft, index) => <div className="window-draft" key={draft.key}>
        <img src={draft.preview} alt={t("上传的二维码预览")} />
        <div className="window-fields">
          <label className="field">{t("窗口名称")}<input maxLength={80} value={draft.name} onChange={(e) => setDrafts((items) => items.map((item) => item.key === draft.key ? { ...item, name: e.target.value } : item))} /></label>
          <label className="field">{t("点餐链接")}<textarea rows={2} maxLength={4096} value={draft.url} onChange={(e) => setDrafts((items) => items.map((item) => item.key === draft.key ? { ...item, url: e.target.value } : item))} /></label>
          <small>{index + 1}. {draft.note}</small>
        </div>
        <button className="icon-button danger-icon" type="button" aria-label={`${t("删除")} ${draft.name}`} onClick={() => removeDraft(draft.key)}><Trash2 size={17} /></button>
      </div>)}
      {drafts.length > 0 && <button className="primary-button full" disabled={busy} onClick={() => void uploadAll()}>{busy ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}{t("上传并发布全部窗口")} ({drafts.length})</button>}
      <div className="window-manual">
        <strong>{t("手动添加窗口")}</strong>
        <div className="field-columns"><label className="field">{t("窗口名称")}<input maxLength={80} value={manualName} onChange={(e) => setManualName(e.target.value)} /></label>
          <label className="field">{t("点餐链接")} <span className="optional">{t("选填")}</span><input maxLength={4096} value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} /></label></div>
        <button className="secondary-button" disabled={busy || !manualName.trim()} onClick={() => void addManual()}><Plus size={16} />{t("添加窗口")}</button>
      </div>
      {notice && <p className="notice success" role="status">{notice}</p>}
      <ErrorNotice message={error} />
    </div>
  </Modal>;
}
