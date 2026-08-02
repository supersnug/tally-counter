import { Hash } from "lucide-react";
import { EmbeddedCounter } from "../features/embed/EmbedComponents";
import { decodeCounter } from "../features/counters/model";

export function EmbedPage({ params }: { params: URLSearchParams }) {
  const embeddedCounter = decodeCounter(
    params.get("data") || params.get("embedData"),
  );
  return embeddedCounter ? (
    <EmbeddedCounter initial={embeddedCounter} params={params} />
  ) : (
    <div className="embed-error">
      <Hash />
      <h1>Counter not found</h1>
      <p>This embed link is missing its counter data.</p>
    </div>
  );
}
