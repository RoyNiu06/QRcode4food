import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Dices, RotateCw, Sparkles } from "lucide-react";
import type { RaffleSettings, Restaurant } from "../shared/types";
import { localizedRestaurant, useLocale } from "./locale";
import { categories, Modal } from "./ui";

type Choice = { id: string; restaurant: Restaurant; windowName: string; url: string };
function choices(restaurants: Restaurant[], mode: "restaurant" | "window"): Choice[] {
  if (mode === "restaurant") return restaurants.map((restaurant) => ({
    id: restaurant.id, restaurant, windowName: "", url: restaurant.url,
  }));
  return restaurants.flatMap((restaurant) => [
    ...(restaurant.url ? [{
      id: `primary:${restaurant.id}`, restaurant, windowName: restaurant.windows.length ? "主点餐入口" : "", url: restaurant.url,
    }] : []),
    ...restaurant.windows.filter((window) => window.url).map((window) => ({
      id: window.id, restaurant, windowName: window.name, url: window.url,
    })),
  ]);
}

export function Raffle({
  restaurants,
  settings,
  onClose,
  onChooseRestaurant,
}: {
  restaurants: Restaurant[];
  settings?: RaffleSettings;
  onClose: () => void;
  onChooseRestaurant: (restaurant: Restaurant) => void;
}) {
  const { locale, t } = useLocale();
  const [mode, setMode] = useState<"restaurant" | "window">("restaurant");
  const [category, setCategory] = useState("全部");
  const [selected, setSelected] = useState(
    () => new Set(restaurants.map((item) => item.id)),
  );
  const [spinning, setSpinning] = useState(false);
  const [rolling, setRolling] = useState<Choice | null>(null);
  const [winner, setWinner] = useState<Choice | null>(null);
  const [easterLine,setEasterLine]=useState("");
  const drawCount=useRef(0);
  const interval = useRef<number | undefined>(undefined);
  const timeout = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearInterval(interval.current);
      window.clearTimeout(timeout.current);
    },
    [],
  );

  const availableCategories = useMemo(
    () => [
      "全部",
      ...categories.filter((value) =>
        restaurants.some((item) => item.category === value),
      ),
    ],
    [restaurants],
  );
  const candidates = useMemo(() => choices(restaurants, mode), [restaurants, mode]);
  const visible = useMemo(
    () =>
      candidates.filter(
        (item) => category === "全部" || item.restaurant.category === category,
      ),
    [candidates, category],
  );
  const pool = useMemo(
    () => visible.filter((item) => selected.has(item.id)),
    [visible, selected],
  );

  function updateSelection(next: Set<string>) {
    setSelected(next);
    setWinner(null);
  }
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateSelection(next);
  }
  function setAll(select: boolean) {
    const next = new Set(selected);
    for (const item of visible)
      select ? next.add(item.id) : next.delete(item.id);
    updateSelection(next);
  }
  function changeMode(next: "restaurant" | "window") {
    setMode(next);
    setSelected(new Set(choices(restaurants, next).map((item) => item.id)));
    setWinner(null);
    setRolling(null);
  }
  function finishDraw(choice:Choice) {
    setWinner(choice);
    drawCount.current+=1;
    if(drawCount.current===5&&settings?.enabled){
      const lines=locale==="zh-Hant"?settings.lines_zh_hant:locale==="en"?settings.lines_en:settings.lines_zh_hans;
      const available=lines.length?lines:settings.lines_zh_hans;
      if(available.length)setEasterLine(available[Math.floor(Math.random()*available.length)]);
    }
  }
  function draw() {
    if (spinning || pool.length === 0) return;
    setWinner(null);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishDraw(pool[Math.floor(Math.random() * pool.length)]);
      return;
    }
    setSpinning(true);
    let index = Math.floor(Math.random() * pool.length);
    setRolling(pool[index]);
    interval.current = window.setInterval(() => {
      index =
        (index + 1 + Math.floor(Math.random() * Math.max(1, pool.length - 1))) %
        pool.length;
      setRolling(pool[index]);
    }, 85);
    timeout.current = window.setTimeout(() => {
      window.clearInterval(interval.current);
      setSpinning(false);
      setRolling(null);
      finishDraw(pool[Math.floor(Math.random() * pool.length)]);
    }, 1900);
  }

  return (
    <Modal wide title={t("今天吃什么")} onClose={onClose}>
      <div className="raffle-layout">
        <section className="raffle-stage" aria-label={t("抽签结果")}>
          <span className="raffle-kicker">
            <Sparkles size={16} /> QRCode PICK
          </span>
          <h3>{t("是啊，吃什么？")}</h3>
          <button type="button" onClick={draw} disabled={spinning||pool.length===0}
            aria-label={t(winner?"再点圆圈抽一次":"点击圆圈开始抽签")}
            className={`raffle-orbit ${spinning ? "is-spinning" : ""} ${winner ? "has-winner" : ""}`}
          >
            <div className="raffle-orbit-inner">
              {winner || rolling ? (
                <>
                  <span className="raffle-reveal-label">
                    {winner ? t("今天就吃这家") : t("正在寻找好味道")}
                  </span>
                  <strong className={spinning ? "raffle-rolling-name" : ""}>
                    {localizedRestaurant((winner || rolling)!.restaurant, "name", locale)}
                  </strong>
                  {winner && (
                    <span className="raffle-winner-category">
                      {winner.windowName ? `${t(winner.windowName)} · ` : ""}{t(winner.restaurant.category)}
                    </span>
                  )}
                  {winner&&<small>{t("再点圆圈抽一次")}</small>}
                </>
              ) : (
                <>
                  <Dices size={52} strokeWidth={1.4} />
                  <span>{t("点击圆圈开始抽签")}</span>
                </>
              )}
            </div>
          </button>
          <div className="raffle-result" aria-live="polite">
            {winner ? (
              mode === "restaurant" && winner.restaurant.windows.length ? (
                <button className="primary-button" onClick={() => {
                  onClose();
                  onChooseRestaurant(winner.restaurant);
                }}>{t("选择点餐窗口")} <ArrowRight size={17} /></button>
              ) : winner.url ? (
                <a
                  className="primary-button"
                  href={winner.id.startsWith("primary:") || mode === "restaurant" ? `/go/restaurant/${winner.restaurant.id}` : `/go/window/${winner.id}`}
                  rel="noreferrer"
                >
                  {t("去这家点餐")} <ArrowRight size={17} />
                </a>
              ) : (
                <span>{t("点餐入口待补充")}</span>
              )
            ) : (
              <span>
                {spinning
                  ? t("正在抽签…")
                  : t("勾选想参与的餐厅，然后开始抽签")}
              </span>
            )}
          </div>
        </section>
        <section className="raffle-controls" aria-label={t("抽签范围")}>
          <div className="raffle-controls-heading">
            <div>
              <span className="eyebrow">MAKE A CHOICE</span>
              <h3>{t("选择范围")}</h3>
            </div>
            <span>
              {pool.length} {t("家候选")}
            </span>
          </div>
          <p>{t("默认包含全部餐厅，也可以按分类筛选或手动勾选。")}</p>
          <div className="raffle-mode" role="group" aria-label={t("抽签单位")}>
            <button type="button" className={mode === "restaurant" ? "active" : ""} aria-pressed={mode === "restaurant"} disabled={spinning} onClick={() => changeMode("restaurant")}>{t("按餐厅抽")}</button>
            <button type="button" className={mode === "window" ? "active" : ""} aria-pressed={mode === "window"} disabled={spinning} onClick={() => changeMode("window")}>{t("按窗口抽")}</button>
          </div>
          <div className="raffle-categories" aria-label={t("按分类筛选")}>
            {availableCategories.map((value) => (
              <button
                type="button"
                key={value}
                className={category === value ? "active" : ""}
                aria-pressed={category === value}
                disabled={spinning}
                onClick={() => {
                  setCategory(value);
                  setWinner(null);
                }}
              >
                {t(value)}
              </button>
            ))}
          </div>
          <div className="raffle-list-head">
            <strong>{t("参与抽签的餐厅")}</strong>
            <div>
              <button
                type="button"
                disabled={spinning || !visible.length}
                onClick={() => setAll(true)}
              >
                {t("全选")}
              </button>
              <button
                type="button"
                disabled={spinning || !visible.length}
                onClick={() => setAll(false)}
              >
                {t("清空")}
              </button>
            </div>
          </div>
          <div className="raffle-list">
            {visible.length ? (
              visible.map((item) => (
                <label
                  key={item.id}
                  className={`raffle-choice ${selected.has(item.id) ? "checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    disabled={spinning}
                    onChange={() => toggle(item.id)}
                  />
                  <span className="raffle-checkbox">
                    <Check size={13} />
                  </span>
                  <span className="raffle-choice-name">
                    {localizedRestaurant(item.restaurant, "name", locale)}{item.windowName ? ` · ${t(item.windowName)}` : ""}
                  </span>
                  <small>{t(item.restaurant.category)}</small>
                </label>
              ))
            ) : (
              <p className="raffle-no-options">{t("还没有可抽签的餐厅")}</p>
            )}
          </div>
          <button
            type="button"
            className="primary-button raffle-draw"
            disabled={spinning || pool.length === 0}
            onClick={draw}
          >
            {winner ? <RotateCw size={19} /> : <Dices size={19} />}
            {spinning ? t("正在抽签…") : winner ? t("再抽一次") : t("开始抽签")}
          </button>
        </section>
      </div>
      {easterLine&&<Modal title={t("还没决定吗")} onClose={()=>setEasterLine("")}>
        <p className="raffle-easter-line">{easterLine}</p>
        <button className="primary-button full" onClick={()=>setEasterLine("")}>{t("知道啦")}</button>
      </Modal>}
    </Modal>
  );
}
