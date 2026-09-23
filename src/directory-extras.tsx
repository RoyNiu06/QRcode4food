import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, GripVertical, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import type { Restaurant } from "../shared/types";
import { localizedRestaurant, useLocale } from "./locale";
import { Modal } from "./ui";

export function storedIds(key:string):string[] {
  try { const value=JSON.parse(localStorage.getItem(key)||"[]"); return Array.isArray(value)?value.filter((id):id is string=>typeof id==="string"):[]; }
  catch { return []; }
}
export function storeIds(key:string, ids:string[]) { try { localStorage.setItem(key,JSON.stringify(ids)); } catch { /* Private browsing can disable storage. */ } }

export function SortDialog({restaurants,order,onChange,onClose}:{restaurants:Restaurant[];order:string[];onChange:(ids:string[])=>void;onClose:()=>void}) {
  const {locale,t}=useLocale();
  const ids=useMemo(()=>[...order.filter(id=>restaurants.some(r=>r.id===id)),...restaurants.map(r=>r.id).filter(id=>!order.includes(id))],[order,restaurants]);
  const dragging=useRef<string|null>(null);
  const [dragId,setDragId]=useState<string|null>(null);
  function move(from:string,to:string) {
    if(from===to)return;
    const toIndex=ids.indexOf(to);
    const next=ids.filter(id=>id!==from);
    next.splice(toIndex,0,from);
    onChange(next);
  }
  function pointerMove(event:React.PointerEvent<HTMLButtonElement>) {
    if(!dragging.current)return;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-sort-id]")?.dataset.sortId;
    if(target)move(dragging.current,target);
  }
  return <Modal title={t("自定义排序")} onClose={onClose}>
    <p className="directory-dialog-hint">{t("按住手柄拖动排序，也可用上下箭头调整。只在当前浏览器保存。")}</p>
    <div className="sort-list">
      {ids.map((id,index)=>{const restaurant=restaurants.find(r=>r.id===id)!;return <div className={`sort-item ${dragId===id?"is-dragging":""}`} data-sort-id={id} key={id}>
        <button className="sort-handle" aria-label={`${t("拖动排序")}：${localizedRestaurant(restaurant,"name",locale)}`} onPointerDown={event=>{dragging.current=id;setDragId(id);event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={pointerMove} onPointerUp={()=>{dragging.current=null;setDragId(null);}} onPointerCancel={()=>{dragging.current=null;setDragId(null);}}><GripVertical size={20}/></button>
        <span className="sort-position">{String(index+1).padStart(2,"0")}</span>
        <strong>{localizedRestaurant(restaurant,"name",locale)}</strong>
        <div className="sort-arrows"><button aria-label={`${t("上移")} ${localizedRestaurant(restaurant,"name",locale)}`} disabled={index===0} onClick={()=>move(id,ids[index-1])}><ArrowUp size={16}/></button><button aria-label={`${t("下移")} ${localizedRestaurant(restaurant,"name",locale)}`} disabled={index===ids.length-1} onClick={()=>move(id,ids[index+1])}><ArrowDown size={16}/></button></div>
      </div>})}
    </div>
    <div className="sort-footer"><button className="secondary-button" onClick={()=>onChange([])}><RotateCcw size={15}/>{t("恢复默认顺序")}</button><button className="primary-button" onClick={onClose}>{t("完成")}</button></div>
  </Modal>;
}

type RankItem={id:string;restaurant_id:string;window_id:string|null;count:number;previous_count:number;rank:number;previous_rank:number|null};
type RankResponse={period:string;unit:string;as_of:number;items:RankItem[]};
export function RankingsDialog({restaurants,onClose}:{restaurants:Restaurant[];onClose:()=>void}) {
  const {locale,t}=useLocale();
  const [period,setPeriod]=useState<"today"|"24h"|"week">("today");
  const [unit,setUnit]=useState<"restaurant"|"window">("restaurant");
  const [data,setData]=useState<RankResponse|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{const controller=new AbortController();setData(null);setError("");
    fetch(`/api/rankings?period=${period}&unit=${unit}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error(t("排行暂时无法加载"));return response.json() as Promise<RankResponse>}).then(setData).catch(error=>{if(error.name!=="AbortError")setError(error.message)});
    return ()=>controller.abort();
  },[period,unit]);
  function name(item:RankItem) {
    const restaurant=restaurants.find(r=>r.id===item.restaurant_id);
    if(!restaurant)return "";
    const base=localizedRestaurant(restaurant,"name",locale);
    if(unit==="restaurant")return base;
    if(!item.window_id)return restaurant.windows.length?`${base} · ${t("主点餐入口")}`:base;
    const window=restaurant.windows.find(w=>w.id===item.window_id);
    return `${base} · ${window?.name||""}`;
  }
  function change(item:RankItem) {
    if(!item.count&&!item.previous_count)return <span className="rank-change same">—</span>;
    if(!item.count&&item.previous_count)return <span className="rank-change down"><TrendingDown size={15}/></span>;
    if(item.count&&!item.previous_count)return <span className="rank-change new">{t("新增")}</span>;
    if(item.previous_rank===null||item.rank===item.previous_rank)return <span className="rank-change same">—</span>;
    return item.rank<item.previous_rank?<span className="rank-change up"><TrendingUp size={15}/>{item.previous_rank-item.rank}</span>:<span className="rank-change down"><TrendingDown size={15}/>{item.rank-item.previous_rank}</span>;
  }
  return <Modal wide title={t("跳转排行")} onClose={onClose}>
    <p className="directory-dialog-hint">{t("统计本站点餐按钮的跳转次数，与上一相同时段的排名比较。今天按香港时间计算。")}</p>
    <div className="ranking-controls">
      <div className="segmented-control" role="group" aria-label={t("统计时段")}>
        {(["today","24h","week"] as const).map(value=><button key={value} className={period===value?"active":""} aria-pressed={period===value} onClick={()=>setPeriod(value)}>{t(value==="today"?"今天":value==="24h"?"近24小时":"近一周")}</button>)}
      </div>
      <div className="segmented-control" role="group" aria-label={t("排行单位")}>
        <button className={unit==="restaurant"?"active":""} aria-pressed={unit==="restaurant"} onClick={()=>setUnit("restaurant")}>{t("按餐厅")}</button>
        <button className={unit==="window"?"active":""} aria-pressed={unit==="window"} onClick={()=>setUnit("window")}>{t("按窗口")}</button>
      </div>
    </div>
    {error?<p className="ranking-message">{error}</p>:!data?<p className="ranking-message">{t("正在加载排行")}</p>:<div className="ranking-list">
      {data.items.length?data.items.map(item=><div className="ranking-item" key={item.id}>
        <span className="ranking-position">{item.rank ? String(item.rank).padStart(2,"0") : "—"}</span>
        <strong>{name(item)}</strong>
        <span className="ranking-count">{item.count} <small>{t("次跳转")}</small></span>
        {change(item)}
      </div>):<p className="ranking-message">{t("还没有可点餐的入口")}</p>}
    </div>}
    <p className="ranking-legend"><ArrowDownUp size={14}/>{t("绿色上升 · 红色下降 · 灰色持平 · 蓝色新增。点击才会计数。")}</p>
  </Modal>;
}
