import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Dices, RotateCw, Sparkles } from "lucide-react";
import type { Restaurant } from "../shared/types";
import { localizedRestaurant, useLocale } from "./locale";
import { categories, Modal } from "./ui";

export function Raffle({
  restaurants,
  onClose,
}: {
  restaurants: Restaurant[];
  onClose: () => void;
}) {
  const { locale, t } = useLocale();
  const [category, setCategory] = useState("全部");
  const [selected, setSelected] = useState(
    () => new Set(restaurants.map((item) => item.id)),
  );
  const [spinning, setSpinning] = useState(false);
  const [rolling, setRolling] = useState<Restaurant | null>(null);
  const [winner, setWinner] = useState<Restaurant | null>(null);
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
  const visible = useMemo(
    () =>
      restaurants.filter(
        (item) => category === "全部" || item.category === category,
      ),
    [restaurants, category],
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
  function draw() {
    if (spinning || pool.length === 0) return;
    setWinner(null);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setWinner(pool[Math.floor(Math.random() * pool.length)]);
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
      setWinner(pool[Math.floor(Math.random() * pool.length)]);
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
          <div
            className={`raffle-orbit ${spinning ? "is-spinning" : ""} ${winner ? "has-winner" : ""}`}
          >
            <div className="raffle-orbit-inner">
              {winner || rolling ? (
                <>
                  <span className="raffle-reveal-label">
                    {winner ? t("今天就吃这家") : t("正在寻找好味道")}
                  </span>
                  <strong className={spinning ? "raffle-rolling-name" : ""}>
                    {localizedRestaurant((winner || rolling)!, "name", locale)}
                  </strong>
                  {winner && (
                    <span className="raffle-winner-category">
                      {t(winner.category)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Dices size={52} strokeWidth={1.4} />
                  <span>{t("交给运气决定")}</span>
                </>
              )}
            </div>
          </div>
          <div className="raffle-result" aria-live="polite">
            {winner ? (
              winner.url ? (
                <a
                  className="primary-button"
                  href={winner.url}
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
                    {localizedRestaurant(item, "name", locale)}
                  </span>
                  <small>{t(item.category)}</small>
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
    </Modal>
  );
}
