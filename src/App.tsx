import { useLayoutEffect, useState } from "react";
import { AppProviders } from "./app/AppProviders";
import {
  CountersPage,
  EmbedPage,
  LandingPage,
  NotFoundPage,
} from "./pages";

const currentRoute = () => {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const relativePath =
    basePath && location.pathname.startsWith(basePath)
      ? location.pathname.slice(basePath.length)
      : location.pathname;
  return `/${relativePath}`.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
};

export default function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("tally-theme") || "light",
  );
  useLayoutEffect(() => {
    localStorage.setItem("tally-theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const path = currentRoute();
  const params = new URLSearchParams(location.search);
  let page;

  if (path === "/embed" || params.has("embedData"))
    page = <EmbedPage params={params} />;
  else if (path === "/") page = <LandingPage theme={theme} />;
  else if (path === "/counters")
    page = <CountersPage theme={theme} onThemeChange={setTheme} />;
  else page = <NotFoundPage />;

  return <AppProviders>{page}</AppProviders>;
}
