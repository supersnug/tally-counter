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

export function NotFoundPage() {
  const counters = `${import.meta.env.BASE_URL}counters`;
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
      <a href={counters}>Back to my counters</a>
    </main>
  );
}
