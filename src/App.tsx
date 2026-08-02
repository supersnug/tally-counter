import { lazy, Suspense, useLayoutEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { AppProviders } from "./app/AppProviders";

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
  const [theme, setTheme] = useState(() => localStorage.getItem("tally-theme") || "light");
  useLayoutEffect(() => {
    localStorage.setItem("tally-theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;
  const themeProps = { theme, onThemeChange: setTheme };

  return (
    <AppProviders>
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
    </AppProviders>
  );
}
