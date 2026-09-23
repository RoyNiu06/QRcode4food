import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { PublicApp } from "./public-app";
import { LocaleProvider, useLocale } from "./locale";
import "./styles.css";
const AdminApp = lazy(() => import("./admin-app"));
function Loading() {
  const { t } = useLocale();
  return <div className="page-loading">{t("正在打开…")}</div>;
}
function Missing() {
  const { t } = useLocale();
  return (
    <main className="empty-state">
      <h1>{t("这里暂时没有内容")}</h1>
      <a className="primary-button" href="/">
        {t("返回餐厅目录")}
      </a>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocaleProvider>
      <Suspense fallback={<Loading />}>
        {location.pathname.startsWith("/admin") ? (
          <AdminApp />
        ) : location.pathname === "/" ? (
          <PublicApp />
        ) : (
          <Missing />
        )}
      </Suspense>
    </LocaleProvider>
  </React.StrictMode>,
);
