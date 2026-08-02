import { Hash } from "lucide-react";

export function NotFoundPage() {
  const home = import.meta.env.BASE_URL;
  return (
    <main className="not-found">
      <div className="not-found-code">404</div>
      <div className="eyebrow">
        <Hash /> Lost count
      </div>
      <h1>
        This page doesn't
        <br />
        <em>add up.</em>
      </h1>
      <p>The address may be incorrect, or the page may have moved.</p>
      <a href={home}>Back to my counters</a>
    </main>
  );
}
