import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ImagePlus, LoaderCircle, Plus, Trash2, UploadCloud } from "lucide-react";
import type { ContributionQuota, Restaurant } from "../shared/types";
import { validateUrl } from "../shared/validation";
import { localizedRestaurant, useLocale } from "./locale";
import { api, categories, ErrorNotice, Modal } from "./ui";
import { OrderNotesFields } from "./order-notes-fields";

type DraftWindow = { key:string; name:string; url:string; blob:Blob|null; preview:string; note:string };
const emptyInfo = { restaurant_name:"", name_zh_hant:"", name_en:"", address:"", address_zh_hant:"",
  address_en:"", category:"中餐", description:"", description_zh_hant:"", description_en:"",
  opens_app:0,wechat_mini_program:0,other_note:"",other_note_zh_hant:"",other_note_en:"" };
type Info = typeof emptyInfo;

export function Contribute({ restaurants, onClose }: { restaurants: Restaurant[]; onClose: () => void }) {
  const { locale, t } = useLocale();
  const [quota,setQuota]=useState<ContributionQuota|null>(null);
  const [restaurantId,setRestaurantId]=useState("");
  const [info,setInfo]=useState<Info>(emptyInfo);
  const [includeMain,setIncludeMain]=useState(true);
  const [mainUrl,setMainUrl]=useState("");
  const [mainBlob,setMainBlob]=useState<Blob|null>(null);
  const [mainPreview,setMainPreview]=useState("");
  const [mainNote,setMainNote]=useState("");
  const [windows,setWindows]=useState<DraftWindow[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const mainFileRef=useRef<HTMLInputElement>(null);
  const objectUrls=useRef(new Set<string>());
  useEffect(()=>{void api<ContributionQuota>("/api/contribute/quota").then(setQuota).catch((e)=>setError(e.message));},[]);
  useEffect(()=>()=>{for(const url of objectUrls.current)URL.revokeObjectURL(url);},[]);
  function previewFor(blob:Blob,previous:string) {
    if(previous){URL.revokeObjectURL(previous);objectUrls.current.delete(previous);}
    const next=URL.createObjectURL(blob);objectUrls.current.add(next);return next;
  }
  function update<K extends keyof Info>(key:K,value:Info[K]) {setInfo(current=>({...current,[key]:value}));}
  function selectRestaurant(id:string) {
    setRestaurantId(id);
    const restaurant=restaurants.find(item=>item.id===id);
    setInfo(restaurant ? {
      restaurant_name:restaurant.name,name_zh_hant:restaurant.name_zh_hant,name_en:restaurant.name_en,
      address:restaurant.address,address_zh_hant:restaurant.address_zh_hant,address_en:restaurant.address_en,
      category:restaurant.category,description:restaurant.description,
      description_zh_hant:restaurant.description_zh_hant,description_en:restaurant.description_en,
      opens_app:restaurant.opens_app,wechat_mini_program:restaurant.wechat_mini_program,
      other_note:restaurant.other_note,other_note_zh_hant:restaurant.other_note_zh_hant,other_note_en:restaurant.other_note_en,
    }:emptyInfo);
    setIncludeMain(!restaurant);
    setMainUrl("");setMainBlob(null);setMainNote("");
    if(mainPreview){URL.revokeObjectURL(mainPreview);objectUrls.current.delete(mainPreview);setMainPreview("");}
    for(const window of windows)if(window.preview){URL.revokeObjectURL(window.preview);objectUrls.current.delete(window.preview);}
    setWindows([]);
  }
  async function prepare(file:File, windowKey?:string) {
    setBusy(true);setError("");
    try {
      const {prepareImage}=await import("./image-upload");
      const result=await prepareImage(file);
      let found="",note="";
      if(result.url){try{found=validateUrl(result.url);note=t("网址已自动填入，可以直接发布。");}
        catch{note=t("识别出的内容不是可用的网页网址，请提供通用网页点餐链接。");}}
      else note=t(result.decodeError);
      if(windowKey) setWindows(current=>current.map(window=>window.key===windowKey?{
        ...window,blob:result.blob,preview:previewFor(result.blob,window.preview),url:found,note,
      }:window));
      else {setMainPreview(previous=>previewFor(result.blob,previous));setMainBlob(result.blob);setMainUrl(found);setMainNote(note);}
    } catch(e){setError((e as Error).message);} finally {setBusy(false);if(mainFileRef.current)mainFileRef.current.value="";}
  }
  function addWindow() {if(windows.length<10)setWindows(current=>[...current,{key:crypto.randomUUID(),name:"",url:"",blob:null,preview:"",note:""}]);}
  function removeWindow(key:string) {setWindows(current=>{const found=current.find(item=>item.key===key);if(found?.preview){URL.revokeObjectURL(found.preview);objectUrls.current.delete(found.preview);}return current.filter(item=>item.key!==key);});}
  function updateWindow(key:string,field:"name"|"url",value:string) {setWindows(current=>current.map(item=>item.key===key?{...item,[field]:value}:item));}
  async function submit(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const form=new FormData();
      const details={...info,restaurant_id:restaurantId,mode:restaurantId?"update":"restaurant",include_main:includeMain,
        window_name:"",url:includeMain && mainUrl.trim()?validateUrl(mainUrl):"",
        windows:windows.map(item=>({name:item.name.trim(),url:item.url.trim()?validateUrl(item.url):""}))};
      if(windows.some(item=>!item.name.trim()))throw new Error(t("请填写窗口名称"));
      form.set("details",JSON.stringify(details));
      if(includeMain&&mainBlob)form.set("main_image",mainBlob,"main-qr.jpg");
      windows.forEach((item,index)=>{if(item.blob)form.set(`window_image_${index}`,item.blob,`counter-${index+1}.jpg`);});
      const result=await api<{quota:ContributionQuota}>("/api/contributions",{method:"POST",body:form});
      setQuota(result.quota);setSent(true);
    } catch(e){setError((e as Error).message);} finally {setBusy(false);}
  }
  return <Modal wide title={t("一起补充")} onClose={onClose}>
    <div className="contribute-panel">
      {sent?<div className="contribute-success" role="status"><span><Check size={25}/></span>
        <h3>{t("已送交管理员审核")}</h3><p>{t("审核通过后，会显示在餐厅目录中。谢谢你分享好味道！")}</p>
        <button className="primary-button" onClick={onClose}>{t("完成")}</button></div>:<form onSubmit={(e)=>void submit(e)}>
        <p className="contribute-intro">{t("餐厅资料、点餐入口和多个窗口，都可以在这里补充。审核通过后才会公开。")}</p>
        <div className="contribute-quota"><strong>{quota?`${quota.limit-quota.used} / ${quota.limit}`:"…"}</strong>
          <span>{t("本浏览器 5 小时内剩余投稿次数")}</span>
          {quota?.resets_at?<small>{t("重置时间")}：{new Date(quota.resets_at*1000).toLocaleString(locale)}</small>:null}</div>
        <label className="field">{t("投稿到")}
          <select value={restaurantId} onChange={(e)=>selectRestaurant(e.target.value)}>
            <option value="">{t("一家新餐厅")}</option>
            {restaurants.map(item=><option key={item.id} value={item.id}>{localizedRestaurant(item,"name",locale)}</option>)}
          </select>
        </label>
        <div className="contribute-section-heading"><span>01</span><strong>{t("餐厅资料")}</strong></div>
        <label className="field">{t("餐厅名称")} <span className="required-tag">{t("必填")}</span>
          <input required maxLength={80} value={info.restaurant_name} onChange={(e)=>update("restaurant_name",e.target.value)} placeholder={t("这家好味道叫什么？")}/>
        </label>
        <details className="contribute-details"><summary>{t("繁体中文与英文名称")}</summary><div className="contribute-detail-content field-columns">
          <label className="field">{t("繁体中文名称")}<input lang="zh-Hant" maxLength={80} value={info.name_zh_hant} onChange={(e)=>update("name_zh_hant",e.target.value)}/></label>
          <label className="field">{t("英文名称")}<input lang="en" maxLength={80} value={info.name_en} onChange={(e)=>update("name_en",e.target.value)}/></label>
        </div></details>
        <details className="contribute-details"><summary>{t("更多信息")} · {t("位置、分类、介绍等，均可不填")}</summary><div className="contribute-detail-content">
          <label className="field">{t("位置 / 分店")}<input maxLength={160} value={info.address} onChange={(e)=>update("address",e.target.value)} placeholder={t("例如：商场 2 楼")}/></label>
          <div className="field-columns"><label className="field">{t("繁体中文位置")}<input lang="zh-Hant" maxLength={160} value={info.address_zh_hant} onChange={(e)=>update("address_zh_hant",e.target.value)}/></label>
            <label className="field">{t("英文位置")}<input lang="en" maxLength={160} value={info.address_en} onChange={(e)=>update("address_en",e.target.value)}/></label></div>
          <label className="field">{t("分类")}<select value={info.category} onChange={(e)=>update("category",e.target.value)}>{categories.map(category=><option value={category} key={category}>{t(category)}</option>)}</select></label>
          <label className="field">{t("一句话介绍")}<textarea rows={2} maxLength={160} value={info.description} onChange={(e)=>update("description",e.target.value)}/></label>
          <div className="field-columns"><label className="field">{t("繁体中文介绍")}<textarea lang="zh-Hant" rows={2} maxLength={160} value={info.description_zh_hant} onChange={(e)=>update("description_zh_hant",e.target.value)}/></label>
            <label className="field">{t("英文介绍")}<textarea lang="en" rows={2} maxLength={160} value={info.description_en} onChange={(e)=>update("description_en",e.target.value)}/></label></div>
        </div></details>
        <div className="contribute-section-heading"><span>02</span><strong>{t("点餐方式备注")}</strong></div>
        <OrderNotesFields value={info} onChange={patch=>setInfo(current=>({...current,...patch}))}/>
        <div className="contribute-section-heading"><span>03</span><strong>{t("主点餐入口")}</strong></div>
        <label className="contribute-choice"><input type="checkbox" checked={!includeMain} onChange={(e)=>{setIncludeMain(!e.target.checked);if(e.target.checked){setMainBlob(null);setMainUrl("");setMainNote("");if(mainPreview){URL.revokeObjectURL(mainPreview);objectUrls.current.delete(mainPreview);setMainPreview("");}}}}/>
          <span>{restaurantId?t("不补充主入口"):t("先不传主二维码")}</span></label>
        {includeMain&&<div className="contribute-entry-fields">
          <input ref={mainFileRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("上传二维码照片")} onChange={(e)=>{const file=e.target.files?.[0];if(file)void prepare(file);}}/>
          <button className="contribute-upload" type="button" disabled={busy} onClick={()=>mainFileRef.current?.click()}>{mainPreview?<img src={mainPreview} alt={t("上传的二维码预览")}/>:<ImagePlus size={27}/>}<span>{mainPreview?t("更换二维码"):t("选择二维码图片")}</span></button>
          {mainNote&&<p className="field-hint" role="status">{mainNote}</p>}
          <label className="field">{t("点餐链接")} <span className="optional">{t("自动识别 / 选填")}</span><textarea rows={2} maxLength={4096} value={mainUrl} onChange={(e)=>setMainUrl(e.target.value)} placeholder={t("上传二维码自动填入，也可直接粘贴网址")}/></label>
        </div>}
        <div className="contribute-section-heading"><span>04</span><strong>{t("点餐窗口")}</strong><small>{t("可一次补充多个窗口")}</small></div>
        <div className="contribute-windows">{windows.map((item,index)=><div className="contribute-window" key={item.key}>
          <div className="contribute-window-head"><strong>{t("窗口")} {String(index+1).padStart(2,"0")}</strong><button type="button" className="icon-button" aria-label={`${t("删除窗口")} ${index+1}`} onClick={()=>removeWindow(item.key)}><Trash2 size={17}/></button></div>
          <label className="field">{t("窗口名称")} <span className="required-tag">{t("必填")}</span><input required maxLength={80} value={item.name} onChange={(e)=>updateWindow(item.key,"name",e.target.value)} placeholder={t("例如：面食窗口")}/></label>
          <input id={`contribution-image-${item.key}`} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${t("上传二维码照片")} ${index+1}`} onChange={(e)=>{const file=e.target.files?.[0];e.target.value="";if(file)void prepare(file,item.key);}}/>
          <button type="button" className="contribute-upload compact" disabled={busy} onClick={()=>document.getElementById(`contribution-image-${item.key}`)?.click()}>{item.preview?<img src={item.preview} alt={t("上传的二维码预览")}/>:<ImagePlus size={20}/>}<span>{item.preview?t("更换二维码"):t("选择二维码图片")}</span></button>
          {item.note&&<p className="field-hint" role="status">{item.note}</p>}
          <label className="field">{t("点餐链接")} <span className="optional">{t("自动识别 / 选填")}</span><textarea rows={2} maxLength={4096} value={item.url} onChange={(e)=>updateWindow(item.key,"url",e.target.value)} placeholder={t("上传二维码自动填入，也可直接粘贴网址")}/></label>
        </div>)}</div>
        <button type="button" className="secondary-button contribute-add-window" disabled={windows.length>=10 || busy} onClick={addWindow}><Plus size={16}/>{t("添加窗口")} {windows.length}/10</button>
        <ErrorNotice message={error}/>
        <button className="primary-button full" disabled={busy||quota?.used===quota?.limit}>
          {busy?<LoaderCircle className="spin" size={17}/>:<UploadCloud size={17}/>} {t("提交审核")}
        </button>
      </form>}
    </div>
  </Modal>;
}
