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

export function TallyScriptEditor({
  source,
  language,
  running,
  externalError,
  onChange,
  onRun,
  onStop,
  allowedLanguages = ["tallyscript", "javascript"],
}) {
  const [result, setResult] = useState(null);
  const isJavaScript = language === "javascript";
  const run = async () => {
    try {
      if (!onRun) throw new Error("Script execution is unavailable.");
      const execution = await onRun();
      if (execution === false) throw new Error("The script did not start.");
      setResult({
        kind: "success",
        text: execution?.background
          ? "Script started and will continue while Tally is open."
          : "Script ran successfully.",
      });
    } catch (error) {
      setResult({
        kind: "error",
        text:
          error instanceof Error ? error.message : "The script could not run.",
      });
    }
  };

  return (
    <div className="counter-scripting-tab">
      <div className="tallyscript-heading">
        <div>
          <span>{isJavaScript ? "JAVASCRIPT" : "TALLYSCRIPT"}</span>
          <h3>Automate this counter</h3>
        </div>
        <em>{isJavaScript ? "Full language" : "Accessible language"}</em>
      </div>
      <p>
        {isJavaScript
          ? "Build advanced automation with full JavaScript, standard language features, reusable functions, and background loops. JavaScript runs in isolation and can interact with the counter through the Tally API."
          : "Build complete counter automation with readable commands, conditions, variables, and background loops. Use sleep inside continuous loops to keep Tally responsive."}
      </p>
      <div className="script-language-switch" aria-label="Script language">
        <button
          type="button"
          disabled={!allowedLanguages.includes("tallyscript")}
          className={!isJavaScript ? "active" : ""}
          onClick={() => {
            onChange?.({ language: "tallyscript" });
            setResult(null);
          }}
        >
          TallyScript
        </button>
        <button
          type="button"
          disabled={!allowedLanguages.includes("javascript")}
          className={isJavaScript ? "active" : ""}
          onClick={() => {
            onChange?.({ language: "javascript" });
            setResult(null);
          }}
        >
          JavaScript
        </button>
      </div>
      <textarea
        disabled={!allowedLanguages.includes(language)}
        aria-label={`${isJavaScript ? "JavaScript" : "TallyScript"} code`}
        spellCheck={false}
        value={source}
        onChange={(event) => {
          onChange?.({ source: event.target.value });
          setResult(null);
        }}
        placeholder={
          isJavaScript
            ? `Tally.goals.add(20);\n\nfor (let i = 0; i < 3; i++) {\n  Tally.value.add();\n}`
            : `set positive step to 2\n\nrepeat 3 times\n  add\nend\n\nif count is at least 6\n  add goal 10\nend`
        }
      />
      <div className="tallyscript-actions">
        {running ? (
          <button type="button" className="stop" onClick={onStop}>
            Stop script
          </button>
        ) : (
          <button type="button" disabled={!allowedLanguages.includes(language)} onClick={run}>
            Run script
          </button>
        )}
        <small>Saved automatically</small>
      </div>
      {externalError && (
        <div className="tallyscript-result error" role="alert">
          {externalError}
        </div>
      )}
      {result && (
        <div className={`tallyscript-result ${result.kind}`} role="status">
          {result.text}
        </div>
      )}
      <details className="tallyscript-reference">
        <summary>
          {isJavaScript
            ? "Function reference and examples"
            : "Command reference and examples"}
        </summary>
        <div>
          {isJavaScript ? (
            <>
              <code>Tally.value.set(10)</code>
              <code>Tally.value.add()</code>
              <code>Tally.value.subtract(2)</code>
              <code>Tally.reset()</code>
              <code>Tally.startingValue.set(0)</code>
              <code>Tally.steps.positive.set(5)</code>
              <code>Tally.steps.negative.set(2)</code>
              <code>Tally.goals.add(20)</code>
              <code>Tally.goals.remove(20)</code>
              <code>Tally.goals.clear()</code>
              <code>Tally.goalDirection.set("more")</code>
              <code>Tally.minimum.set(-10)</code>
              <code>Tally.minimum.remove()</code>
              <code>Tally.maximum.set(100)</code>
              <code>Tally.maximum.remove()</code>
              <code>Tally.cosmetic.preferences.name.set("Daily tally")</code>
              <code>Tally.cosmetic.preferences.color.set("#47ccef")</code>
              <code>Tally.cosmetic.super.move("title", 20, -10)</code>
              <code>Tally.cosmetic.super.scale("goal", 1.2, 0.8)</code>
              <code>Tally.cosmetic.super.rotate("count", 5)</code>
              <code>Tally.cosmetic.super.resize("add", 160, 60)</code>
              <code>Tally.cosmetic.super.show("maximum")</code>
              <code>Tally.cosmetic.super.hide("minimum")</code>
              <code>Tally.cosmetic.super.reset("title")</code>
              <code>await Tally.sleep(1000)</code>
            </>
          ) : (
            <>
              <code>add</code>
              <code>add 5</code>
              <code>subtract 2</code>
              <code>reset</code>
              <code>jump to 20</code>
              <code>set count to 10</code>
              <code>set starting value to 0</code>
              <code>set positive step to 5</code>
              <code>set negative step to 2</code>
              <code>add goal 20</code>
              <code>remove goal 20</code>
              <code>clear goals</code>
              <code>set direction to more</code>
              <code>set minimum to -10</code>
              <code>remove minimum</code>
              <code>set maximum to 100</code>
              <code>set name to "Daily tally"</code>
              <code>set color to "#47ccef"</code>
              <code>move title to 20, -10</code>
              <code>scale goal to 1.2, 0.8</code>
              <code>rotate count to 5</code>
              <code>resize add to 160, 60</code>
              <code>show maximum</code>
              <code>hide minimum</code>
              <code>reset super title</code>
              <code>add quick setting positiveStep</code>
              <code>remove quick setting positiveStep</code>
              <code>repeat 3 times … end</code>
              <code>if count is at least 10 … end</code>
              <code>otherwise</code>
              <code>remember amount as 5</code>
              <code>sleep 1000 ms</code>
              <code>wait for 1000 milliseconds</code>
            </>
          )}
        </div>
        <p className="tallyscript-variable-list">
          {isJavaScript ? "Live condition variables: " : "Condition values: "}
          <code>{isJavaScript ? "tally_count" : "count"}</code>,{" "}
          <code>
            {isJavaScript ? "tally_starting_value" : "starting value"}
          </code>
          ,{" "}
          <code>{isJavaScript ? "tally_positive_step" : "positive step"}</code>,{" "}
          <code>{isJavaScript ? "tally_negative_step" : "negative step"}</code>,{" "}
          <code>{isJavaScript ? "tally_goal_count" : "goal count"}</code>,{" "}
          <code>
            {isJavaScript ? "tally_goal_direction" : "goal direction"}
          </code>
          , <code>{isJavaScript ? "tally_minimum" : "minimum"}</code>,{" "}
          <code>{isJavaScript ? "tally_maximum" : "maximum"}</code>,{" "}
          <code>{isJavaScript ? "tally_has_minimum" : "has minimum"}</code>, and{" "}
          <code>{isJavaScript ? "tally_has_maximum" : "has maximum"}</code>.
        </p>
        <p>
          {isJavaScript
            ? "JavaScript mode supports the full language and standard built-ins. Scripts may run continuously when they yield with await Tally.sleep(...); only uninterrupted CPU bursts, stack usage, and memory are limited."
            : "TallyScript uses one command per line. Close repeat, if, and while blocks with end. Continuous while loops must include sleep so they yield between actions."}
        </p>
      </details>
    </div>
  );
}
