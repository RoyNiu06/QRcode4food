import { useLocale } from "./locale";

export type OrderNotes = {
  opens_app:number;
  wechat_mini_program:number;
  other_note:string;
  other_note_zh_hant:string;
  other_note_en:string;
};

export function OrderNotesFields({value,onChange}:{value:OrderNotes;onChange:(patch:Partial<OrderNotes>)=>void}) {
  const {t}=useLocale();
  return <section className="order-notes-fields" aria-label={t("点餐方式备注")}>
    <div className="order-notes-choices">
      <label><input type="checkbox" checked={Boolean(value.opens_app)} onChange={event=>onChange({opens_app:event.target.checked?1:0})}/><span>{t("点击跳转 App")}</span></label>
      <label><input type="checkbox" checked={Boolean(value.wechat_mini_program)} onChange={event=>onChange({wechat_mini_program:event.target.checked?1:0})}/><span>{t("可用微信小程序")}</span></label>
    </div>
    <div className="field-columns">
      <label className="field">{t("其他说明")} <span className="optional">{t("选填")}</span>
        <input maxLength={160} value={value.other_note} onChange={event=>onChange({other_note:event.target.value})} placeholder={t("例如：堂食扫码后在小程序完成点餐")}/>
      </label>
      <label className="field">{t("繁体其他说明")}
        <input lang="zh-Hant" maxLength={160} value={value.other_note_zh_hant} onChange={event=>onChange({other_note_zh_hant:event.target.value})}/>
      </label>
      <label className="field">{t("英文其他说明")}
        <input lang="en" maxLength={160} value={value.other_note_en} onChange={event=>onChange({other_note_en:event.target.value})}/>
      </label>
    </div>
  </section>;
}
