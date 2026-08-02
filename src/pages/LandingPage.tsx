import { useState } from "react";
import { Code2, Hash, Sparkles, Target } from "lucide-react";
import { CounterCard } from "../features/counters/CounterCard";
import { EmbedBuilder } from "../features/embed/EmbedComponents";
import { Editor } from "../features/counters/CounterEditor";
import {
  getGoals,
  sanitize,
  starter,
  type AnyRecord,
} from "../features/counters/model";

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
              Flexible, private counters for goals, habits, inventory, scores,
              and everything else that adds up.
            </p>
            <a className="start-counting" href={countersUrl}>
              Start counting <span>→</span>
            </a>
            <small>Account optional · Saved on your device</small>
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
            <h3>Ready to share</h3>
            <p>
              Customize and embed an interactive counter into another website.
            </p>
          </div>
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
