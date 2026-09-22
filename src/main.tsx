import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { PublicApp } from "./public-app";
import "./styles.css";
const AdminApp = lazy(() => import("./admin-app"));
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="page-loading">正在打开…</div>}>
      {location.pathname.startsWith("/admin") ? (
        <AdminApp />
      ) : location.pathname === "/" ? (
        <PublicApp />
      ) : (
        <main className="empty-state">
          <h1>这里暂时没有内容</h1>
          <a className="primary-button" href="/">
            返回餐厅目录
          </a>
        </main>
      )}
    </Suspense>
  </React.StrictMode>,
);
