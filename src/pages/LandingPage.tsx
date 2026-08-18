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
import { useState } from "react";
import {
  Check,
  Cloud,
  Code2,
  DatabaseBackup,
  Hash,
  LayoutDashboard,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { CounterCard } from "../features/counters/CounterCard";
import { EmbedBuilder } from "../features/embed/EmbedComponents";
import { Editor } from "../features/counters/CounterEditor";
import {
  getGoals,
  sanitize,
  starter,
  type AnyRecord,
} from "../features/counters/model";

const COMPARISON_APPS = [
  { name: "Tally", platform: "Web" },
  { name: "Online Tally Counter", platform: "Web" },
  { name: "Thing Count", platform: "Android" },
  { name: "Tally: Counter & Score", platform: "Apple" },
] as const;

const COMPARISON_FEATURES = [
  [
    "Multiple counters",
    "Included",
    "Several on the free plan",
    "Included",
    "3 free; unlimited with Premium",
  ],
  [
    "Custom step sizes",
    "Separate + and − steps",
    "Steps 1–10 free; larger with Pro",
    "Included",
    "Not listed",
  ],
  [
    "Goals",
    "Multiple, counting up or down",
    "Target up to 50 free; larger with Pro",
    "Not listed",
    "Goal available",
  ],
  [
    "Hard minimum and maximum limits",
    "Included",
    "Capped on the free plan",
    "Not listed",
    "Not listed",
  ],
  [
    "Activity stats and history",
    "Included",
    "Full history and stats with Pro",
    "Included",
    "Included",
  ],
  [
    "Cross-device sync",
    "Optional account",
    "Pro cloud sync",
    "Drive backup only",
    "Premium iCloud sync",
  ],
  [
    "Live collaborative counters",
    "Groups with member permissions",
    "Shared-counter tool; advanced sharing with Pro",
    "Not listed",
    "Not listed",
  ],
  [
    "Programmable automation",
    "TallyScript and JavaScript",
    "Not listed",
    "Not listed",
    "Not listed",
  ],
  [
    "Embeddable web counters",
    "Included",
    "Counter widgets available",
    "Not listed",
    "Not listed",
  ],
  [
    "Portable backup or export",
    "JSON export and import",
    "CSV/JSON with Pro",
    "Data restore and spreadsheets",
    "Premium CSV/Excel export",
  ],
  [
    "Recoverable Trash",
    "Five-day recovery",
    "Not listed",
    "Not listed",
    "Not listed",
  ],
  [
    "Visual customization",
    "Colors plus move, resize, rotate, and restyle",
    "Names, colors, and density views",
    "Colors, sizes, and categories",
    "Counter colors",
  ],
  [
    "No subscription",
    "Yes — no paid plan",
    "No — sync, sharing, and full history require Pro",
    "Yes — no paid unlocks",
    "No — unlimited counters, sync, and export require Premium",
  ],
] as const;

function ComparisonTable() {
  return (
    <section className="landing-comparison" aria-labelledby="comparison-title">
      <div className="landing-section-title">
        <span>COMPARE THE COUNTERS</span>
        <h2 id="comparison-title">
          Simple when you want it. Capable when you need it.
        </h2>
        <p>
          Tally covers everyday counting, then keeps going with collaboration,
          automation, portable data, and layouts you can make your own.
        </p>
      </div>
      <div
        className="comparison-table-wrap"
        role="region"
        aria-label="Tally counter app feature comparison"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              {COMPARISON_APPS.map((app) => (
                <th key={app.name} scope="col">
                  <strong>{app.name}</strong>
                  <span>{app.platform}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_FEATURES.map(([feature, ...values]) => (
              <tr key={feature}>
                <th scope="row">{feature}</th>
                {values.map((value, index) => (
                  <td
                    key={COMPARISON_APPS[index].name}
                    className={index === 0 ? "tally-feature" : undefined}
                  >
                    {index === 0 && <Check aria-hidden="true" />}
                    <span>{value}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="comparison-note">
        Based on published feature listings reviewed August 2026. “Not listed”
        means the capability is not advertised in the linked listing. Sources:{" "}
        <a
          href="https://www.digitaltallycounter.com/"
          target="_blank"
          rel="noreferrer"
        >
          Online Tally Counter
        </a>,{" "}
        <a
          href="https://play.google.com/store/apps/details?id=me.versteege.thingcounter"
          target="_blank"
          rel="noreferrer"
        >
          Thing Count
        </a>, and{" "}
        <a
          href="https://apps.apple.com/us/app/tally-counter-score-tracker/id1412716242"
          target="_blank"
          rel="noreferrer"
        >
          Tally: Counter &amp; Score Tracker
        </a>.
      </p>
    </section>
  );
}

export function LandingPage({ theme }) {
  const [demos, setDemos] = useState<AnyRecord[]>(() =>
    starter.map((counter) => ({ ...counter, goals: [...counter.goals] })),
  );
  const [editing, setEditing] = useState(null);
  const [embedding, setEmbedding] = useState(null);
  const setValue = (id, requested) =>
    setDemos((items) =>
      items.map((counter) =>
        counter.id === id
          ? {
              ...counter,
              value: Math.max(
                counter.min ?? -Infinity,
                Math.min(counter.max ?? Infinity, requested),
              ),
            }
          : counter,
      ),
    );
  const save = (draft) => {
    const clean = sanitize(draft);
    setDemos((items) =>
      items.map((counter) => (counter.id === clean.id ? clean : counter)),
    );
    setEditing(null);
  };
  const countersUrl = `${import.meta.env.BASE_URL}counters`;
  return (
    <div className="landing-page" data-theme={theme}>
      <main className="landing-main">
        <section className="landing-hero">
          <a className="brand landing-brand" href={import.meta.env.BASE_URL}>
            <span className="brand-mark">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>
            TALLY
          </a>
          <div className="landing-hero-content">
            <div className="eyebrow">
              <Sparkles /> Your everyday counting space
            </div>
            <h1>
              Keep count.
              <br />
              <em>Stay on track.</em>
            </h1>
            <p>
              Flexible counters for goals, habits, inventory, scores, shared
              projects, and everything else that adds up.
            </p>
            <a className="start-counting" href={countersUrl}>
              Start counting <span>→</span>
            </a>
            <a className="landing-guide-link" href="/guide">
              Read the guide <span>↗</span>
            </a>
            <small>Account optional · Local-first · Cloud sync when you want it</small>
          </div>
        </section>
        <section className="landing-demo">
          <div className="landing-section-title">
            <span>TRY IT NOW</span>
            <h2>Real counters. No commitment.</h2>
            <p>
              These demos have every feature enabled. Change their values,
              goals, colors, or limits—they reset when you leave.
            </p>
          </div>
          <div className="grid demo-grid">
            {demos.map((counter, index) => (
              <CounterCard
                key={counter.id}
                counter={counter}
                index={index}
                showBounds
                onChange={(id, amount) => setValue(id, counter.value + amount)}
                onEdit={() =>
                  setEditing({ ...counter, goals: getGoals(counter) })
                }
                onEmbed={() => setEmbedding(counter)}
                onDelete={() =>
                  setDemos((items) => items.filter((c) => c.id !== counter.id))
                }
                onReset={() => setValue(counter.id, counter.start)}
              />
            ))}
          </div>
        </section>
        <section className="landing-features">
          <div>
            <Hash />
            <h3>Count your way</h3>
            <p>
              Use positive or negative values, different step sizes, and exact
              hard limits.
            </p>
          </div>
          <div>
            <Target />
            <h3>Milestones that move</h3>
            <p>
              Build multi-goal paths with smooth progress in either direction.
            </p>
          </div>
          <div>
            <Code2 />
            <h3>Automate with scripts</h3>
            <p>
              Use approachable TallyScript or full JavaScript to automate
              counter workflows.
            </p>
          </div>
          <div>
            <Cloud />
            <h3>Local-first cloud sync</h3>
            <p>
              Count without an account, or sign in to keep counters synchronized
              across devices.
            </p>
          </div>
          <div>
            <Users />
            <h3>Count together</h3>
            <p>
              Send independent copies or collaborate through groups with precise
              per-member permissions.
            </p>
          </div>
          <div>
            <LayoutDashboard />
            <h3>Make Tally yours</h3>
            <p>
              Tally Super moves, resizes, rotates, and restyles counter elements
              and workspace content.
            </p>
          </div>
        </section>
        <ComparisonTable />
        <section className="landing-showcase">
          <article className="scripting-showcase">
            <div className="landing-showcase-copy">
              <span>COUNTERS THAT CAN RUN THEMSELVES</span>
              <h2>Turn a tally into a live automated workflow.</h2>
              <p>
                Scripts do more than change a number once. Build counters that
                increment continuously, react when values cross thresholds,
                create their own goals, adjust steps and limits, reset on your
                rules, or coordinate a complete counting routine. Long-running
                yielding scripts keep working in the background while Tally is open.
              </p>
              <ul>
                <li><Code2 /> Run one-time routines or continuous background loops</li>
                <li><Target /> React to values and automate goals, limits, and steps</li>
                <li><Sparkles /> Start with TallyScript or build freely with the full JavaScript language</li>
              </ul>
            </div>
            <div className="landing-showcase-visual script-visual">
              <div className="script-window-head"><i></i><i></i><i></i><span>TALLYSCRIPT · RUNNING</span></div>
              <pre><code><em>while</em> true{"\n"}  <em>sleep</em> 1000 ms{"\n"}  add{"\n"}{"\n"}  <em>if</em> count is 25{"\n"}    add goal 50{"\n"}    set positive step to 2{"\n"}  <em>end</em>{"\n"}<em>end</em></code></pre>
              <div className="script-running"><span></span> Incrementing every second</div>
            </div>
          </article>
          <article>
            <div className="landing-showcase-copy">
              <span>SHARE WITHOUT GIVING UP CONTROL</span>
              <h2>From a quick copy to a shared workspace.</h2>
              <p>
                Send a counter to another Tally user or create a group where
                everyone works with the same live counters. Choose a preset such
                as Counting Only or Scripts Only, or control individual settings,
                actions, scripts, and Tally Super elements.
              </p>
              <ul>
                <li><Send /> Send counter copies by username or email</li>
                <li><Users /> Live group counters with multiple groups</li>
                <li><ShieldCheck /> Fine-grained member permissions</li>
              </ul>
            </div>
            <div className="landing-showcase-visual permissions-visual">
              <span>GROUP ACCESS</span>
              <strong>Project totals</strong>
              <div><i></i><p><b>Counting Only</b><small>Add, subtract, and reset</small></p></div>
              <div><i></i><p><b>Scripts Only</b><small>TallyScript and JavaScript</small></p></div>
              <div><i></i><p><b>Custom</b><small>Choose every allowed action</small></p></div>
            </div>
          </article>
          <article className="reverse">
            <div className="landing-showcase-copy">
              <span>POWERFUL, BUT STILL YOURS</span>
              <h2>Customize deeply. Back up everything.</h2>
              <p>
                Build a counter that fits the job instead of changing your job to
                fit the counter. Keep recoverable deletions in Trash, export
                portable JSON backups, and embed focused counters elsewhere.
              </p>
              <ul>
                <li><Sparkles /> Per-counter and workspace Tally Super layouts</li>
                <li><DatabaseBackup /> Separate or complete JSON backups</li>
                <li><Trash2 /> Five-day recoverable Trash</li>
              </ul>
            </div>
            <div className="landing-showcase-visual super-visual">
              <Sparkles />
              <span>TALLY SUPER</span>
              <strong>Move every part.</strong>
              <p>Position · Resize · Scale · Rotate · Restyle</p>
              <div><Hash /><b>42</b><Target /></div>
            </div>
          </article>
        </section>
        <section className="landing-cta">
          <span>READY WHEN YOU ARE</span>
          <h2>
            Start with one.
            <br />
            Count anything.
          </h2>
          <a className="start-counting" href={countersUrl}>
            Open my counters <span>→</span>
          </a>
        </section>
      </main>
      <footer>
        <span>Built for the little things that add up.</span>
        <div>
          <a href="/guide">Read the guide</a>
          <a
            href="https://github.com/supersnug/tally-counter"
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub
          </a>
        </div>
      </footer>
      {editing && (
        <Editor
          draft={editing}
          setDraft={setEditing}
          isNew={false}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
      {embedding && (
        <EmbedBuilder counter={embedding} onClose={() => setEmbedding(null)} />
      )}
    </div>
  );
}
