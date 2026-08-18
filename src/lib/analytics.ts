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
export const ANALYTICS_EVENTS = ["route_view", "embed_view", "guide_view"] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
const PRIVATE_KEYS = /email|user|token|password|session|counter|content|url|data/i;
export function allowlistedAnalyticsPayload(event: AnalyticsEvent, route: string) {
  if (!ANALYTICS_EVENTS.includes(event) || event === "embed_view") return { event, route: event === "embed_view" ? "/embed" : route.split("?")[0] };
  return { event, route: route.split("?")[0] };
}
export function isPrivateAnalyticsKey(key: string) { return PRIVATE_KEYS.test(key); }
