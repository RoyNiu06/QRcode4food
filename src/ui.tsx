import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  QrCode,
  X,
  MapPin,
  ArrowUpRight,
  Coffee,
  Utensils,
  Soup,
  Croissant,
  Store,
  IceCreamBowl,
} from "lucide-react";
export const categories = [
  "中餐",
  "西餐",
  "日韩料理",
  "快餐小吃",
  "咖啡茶饮",
  "甜品烘焙",
  "其他",
];
export function CategoryIcon({
  category,
  size = 24,
}: {
  category: string;
  size?: number;
}) {
  const Icon =
    category === "咖啡茶饮"
      ? Coffee
      : category === "甜品烘焙"
        ? Croissant
        : category === "日韩料理"
          ? Soup
          : category === "快餐小吃"
            ? IceCreamBowl
            : category === "其他"
              ? Store
              : Utensils;
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}
export function Brand() {
  return (
    <a href="/" className="brand" aria-label="QRCode 首页">
      <span className="brand-icon">
        <QrCode size={25} strokeWidth={2} />
      </span>
      <span>
        QR<span className="brand-light">Code</span>
        <small>BY ROYILAB</small>
      </span>
    </a>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span>附近好味，一点即达。</span>
      <span>
        Made for your next meal <span className="footer-mark">↗</span>
      </span>
    </footer>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function PlacePill({ name }: { name: string }) {
  return (
    <span className="place-pill">
      <MapPin size={15} />
      <span>{name || "地点待设置"}</span>
    </span>
  );
}
export function ExternalIcon() {
  return <ArrowUpRight size={19} aria-hidden="true" />;
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options?.body && typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...options?.headers,
    },
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "操作未完成，请稍后重试",
    );
  return data as T;
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div className="notice error" role="alert">
      {message}
    </div>
  ) : null;
}
