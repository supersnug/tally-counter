/*
 * This file is part of Tally.
 *
 * Copyright (C) 2026 Tally contributors
 *
 * Tally is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, version 3 of the
 * License.
 *
 * Tally is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Tally. If not, see <https://www.gnu.org/licenses/>.
 */
import { lazy, Suspense, useLayoutEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { AppProviders } from "./app/AppProviders";
import { guardedRawWrite, guardedRawRead } from "./shared/persistence/guardedStorage";
import { ModalA11yManager } from "./shared/components/ModalA11yManager";

const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const CountersPage = lazy(() => import("./pages/CountersPage").then((module) => ({ default: module.CountersPage })));
const EmbedPage = lazy(() => import("./pages/EmbedPage").then((module) => ({ default: module.EmbedPage })));
const GuidePage = lazy(() => import("./pages/GuidePage").then((module) => ({ default: module.GuidePage })));
const DeveloperGuidePage = lazy(() => import("./pages/DeveloperGuidePage").then((module) => ({ default: module.DeveloperGuidePage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));

type ThemePageProps = {
  theme: string;
  onThemeChange: (theme: string) => void;
};

function RootPage({ theme }: Pick<ThemePageProps, "theme">) {
  const [params] = useSearchParams();
  return params.has("embedData") ? <EmbedPage params={params} /> : <LandingPage theme={theme} />;
}

function EmbedRoute() {
  const [params] = useSearchParams();
  return <EmbedPage params={params} />;
}

function GuideRoute(props: ThemePageProps) {
  return <GuidePage path={useLocation().pathname} {...props} />;
}

function DeveloperGuideRoute(props: ThemePageProps) {
  return <DeveloperGuidePage path={useLocation().pathname} {...props} />;
}

export default function App() {
  const embedOnly = window.location.pathname === "/embed" || (window.location.pathname === "/" && new URLSearchParams(window.location.search).has("embedData"));
  const [theme, setTheme] = useState(() => embedOnly ? "light" : guardedRawRead(localStorage, "tally-theme").value === "dark" ? "dark" : "light");
  useLayoutEffect(() => {
    if (embedOnly) return;
    guardedRawWrite(localStorage, "tally-theme", theme, guardedRawRead(localStorage, "tally-theme").value);
    document.documentElement.dataset.theme = theme;
  }, [embedOnly, theme]);

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;
  const themeProps = { theme, onThemeChange: setTheme };

  const content = (
      <BrowserRouter basename={basePath}>
        <Suspense fallback={<div className="route-loading" role="status">Loading Tally…</div>}>
          <Routes>
            <Route path="/" element={<RootPage theme={theme} />} />
            <Route path="/embed" element={<EmbedRoute />} />
            <Route path="/counters" element={<CountersPage {...themeProps} />} />
            <Route path="/guide/*" element={<GuideRoute {...themeProps} />} />
            <Route path="/developers/*" element={<DeveloperGuideRoute {...themeProps} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
  );
  return embedOnly ? <><ModalA11yManager />{content}</> : <AppProviders><ModalA11yManager />{content}</AppProviders>;
}
