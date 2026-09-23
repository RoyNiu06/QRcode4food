import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ImagePlus, LoaderCircle, UploadCloud } from "lucide-react";
import type { ContributionQuota, Restaurant } from "../shared/types";
import { validateUrl } from "../shared/validation";
import { localizedRestaurant, useLocale } from "./locale";
import { api, ErrorNotice, Modal } from "./ui";

export function Contribute({ restaurants, onClose }: {
  restaurants: Restaurant[];
  onClose: () => void;
}) {
  const { locale, t } = useLocale();
  const [quota, setQuota] = useState<ContributionQuota | null>(null);
  const [restaurantId, setRestaurantId] = useState("");
  const [name, setName] = useState("");
  const [windowName, setWindowName] = useState("");
  const [url, setUrl] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void api<ContributionQuota>("/api/contribute/quota").then(setQuota)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNote(t("正在读取图片并识别二维码…"));
    try {
      const { prepareImage } = await import("./image-upload");
      const result = await prepareImage(file);
      setBlob(result.blob);
      setPreview(URL.createObjectURL(result.blob));
      if (result.url) {
        try {
          setUrl(validateUrl(result.url));
          setNote(t("网址已自动填入，可以直接发布。"));
        } catch {
          setUrl("");
          setNote(t("识别出的内容不是可用的网页网址，请提供通用网页点餐链接。"));
        }
      } else {
        setUrl("");
        setNote(t(result.decodeError));
      }
    } catch (e) {
      setError((e as Error).message);
      setNote("");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!blob) { setError(t("请先选择二维码图片")); return; }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("restaurant_id", restaurantId);
      form.set("restaurant_name", name.trim());
      form.set("window_name", windowName.trim());
      form.set("url", url.trim() ? validateUrl(url) : "");
      form.set("image", blob, "qrcode.jpg");
      const result = await api<{ quota: ContributionQuota }>("/api/contributions", {
        method: "POST", body: form,
      });
      setQuota(result.quota);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <Modal title={t("一起补充点餐码")} onClose={onClose}>
    <div className="contribute-panel">
      {sent ? <div className="contribute-success" role="status">
        <span><Check size={25} /></span>
        <h3>{t("已送交管理员审核")}</h3>
        <p>{t("审核通过后，会显示在餐厅目录中。谢谢你分享好味道！")}</p>
        <button className="primary-button" onClick={onClose}>{t("完成")}</button>
      </div> : <form onSubmit={(e) => void submit(e)}>
        <p className="contribute-intro">{t("分享一张点餐二维码，审核后让更多人一键开餐。")}</p>
        <div className="contribute-quota">
          <strong>{quota ? `${quota.limit - quota.used} / ${quota.limit}` : "…"}</strong>
          <span>{t("本浏览器 5 小时内剩余投稿次数")}</span>
          {quota?.resets_at ? <small>{t("重置时间")}：{new Date(quota.resets_at * 1000).toLocaleString(locale)}</small> : null}
        </div>
        <label className="field">{t("投稿到")}
          <select value={restaurantId} onChange={(e) => {
            const id = e.target.value;
            setRestaurantId(id);
            setName(restaurants.find((r) => r.id === id)?.name || "");
          }}>
            <option value="">{t("一家新餐厅")}</option>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{localizedRestaurant(r, "name", locale)}</option>)}
          </select>
        </label>
        <label className="field">{t("餐厅名称")} <span className="required-tag">{t("必填")}</span>
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("这家好味道叫什么？")} />
        </label>
        {restaurantId && <label className="field">{t("窗口名称")} <span className="optional">{t("选填")}</span>
          <input maxLength={80} value={windowName} onChange={(e) => setWindowName(e.target.value)} placeholder={t("例如：面食窗口")} />
        </label>}
        <input ref={fileRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("上传二维码照片")} onChange={(e) => void choose(e.target.files?.[0])} />
        <button className="contribute-upload" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          {preview ? <img src={preview} alt={t("上传的二维码预览")} /> : <ImagePlus size={27} />}
          <span>{preview ? t("更换二维码") : t("选择二维码图片")}</span>
        </button>
        {note && <p className="field-hint" role="status">{note}</p>}
        <label className="field">{t("点餐链接")} <span className="optional">{t("自动识别 / 选填")}</span>
          <textarea rows={2} maxLength={4096} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("上传二维码自动填入，也可直接粘贴网址")} />
        </label>
        <ErrorNotice message={error} />
        <button className="primary-button full" disabled={busy || quota?.used === quota?.limit || !blob}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <UploadCloud size={17} />}
          {t("提交审核")}
        </button>
      </form>}
    </div>
  </Modal>;
}
