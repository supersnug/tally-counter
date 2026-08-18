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
import { Hash } from "lucide-react";
import { EmbeddedCounter } from "../features/embed/EmbedComponents";
import { decodeCounterResult } from "../features/counters/model";

export function EmbedPage({ params }: { params: URLSearchParams }) {
  const result = decodeCounterResult(
    params.get("data") || params.get("embedData"),
  );
  const failureReason = "reason" in result ? ({ missing: "This embed link has no counter snapshot.", malformed: "This embed link is not valid.", truncated: "This embed link is incomplete.", version: "This embed link uses an unsupported snapshot version.", schema: "This embed link has unsupported snapshot fields.", numeric: "This embed link has invalid counter values." }[result.reason]) : null;
  return result.ok ? (
    <EmbeddedCounter initial={result.value} params={params} />
  ) : (
    <div className="embed-error" role="alert" aria-live="polite">
      <Hash />
      <h1>Counter not found</h1>
      <p>This embed link could not be loaded ({failureReason}). Copy a fresh embed code and try again.</p>
    </div>
  );
}
