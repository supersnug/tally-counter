export class TallyScriptSyntaxError extends Error {
  constructor(line: number, message: string) {
    super(`Line ${line}: ${message}`);
    this.name = "TallyScriptSyntaxError";
  }
}

const expressionNames: Array<[RegExp, string]> = [
  [/\bstarting value\b/gi, "tally_starting_value"],
  [/\bpositive step\b/gi, "tally_positive_step"],
  [/\bnegative step\b/gi, "tally_negative_step"],
  [/\bgoal direction\b/gi, "tally_goal_direction"],
  [/\bgoal count\b/gi, "tally_goal_count"],
  [/\bhas minimum\b/gi, "tally_has_minimum"],
  [/\bhas maximum\b/gi, "tally_has_maximum"],
  [/\bminimum\b/gi, "tally_minimum"],
  [/\bmaximum\b/gi, "tally_maximum"],
  [/\bgoals\b/gi, "tally_goals"],
  [/\bcount\b/gi, "tally_count"],
];

const compileExpression = (expression: string) => {
  const pieces = expression.split(
    /((?:"(?:\\.|[^"\\])*")|(?:'(?:\\.|[^'\\])*'))/,
  );
  return pieces
    .map((piece, index) => {
      if (index % 2) return piece;
      let compiled = piece;
      for (const [pattern, replacement] of expressionNames)
        compiled = compiled.replace(pattern, replacement);
      return compiled
        .replace(/\bis not\b/gi, "!==")
        .replace(/\bis at least\b/gi, ">=")
        .replace(/\bis at most\b/gi, "<=")
        .replace(/\bis greater than\b/gi, ">")
        .replace(/\bis less than\b/gi, "<")
        .replace(/\bis\b/gi, "===")
        .replace(/\band\b/gi, "&&")
        .replace(/\bor\b/gi, "||")
        .replace(/\bnot\b/gi, "!")
        .replace(/\btrue\b/gi, "true")
        .replace(/\bfalse\b/gi, "false");
    })
    .join("")
    .trim();
};

const settingCommands: Array<[RegExp, (value: string) => string]> = [
  [
    /^set (?:count|exact value) to (.+)$/i,
    (value) => `Tally.value.set(${value});`,
  ],
  [
    /^set starting value to (.+)$/i,
    (value) => `Tally.startingValue.set(${value});`,
  ],
  [
    /^set positive step to (.+)$/i,
    (value) => `Tally.steps.positive.set(${value});`,
  ],
  [
    /^set negative step to (.+)$/i,
    (value) => `Tally.steps.negative.set(${value});`,
  ],
  [
    /^set (?:goal )?direction to (more|less)$/i,
    (value) => `Tally.goalDirection.set("${value.toLowerCase()}");`,
  ],
  [/^set minimum to (.+)$/i, (value) => `Tally.minimum.set(${value});`],
  [/^set maximum to (.+)$/i, (value) => `Tally.maximum.set(${value});`],
  [
    /^set name to (.+)$/i,
    (value) => `Tally.cosmetic.preferences.name.set(${value});`,
  ],
  [
    /^set color to (.+)$/i,
    (value) => `Tally.cosmetic.preferences.color.set(${value});`,
  ],
];

export function compileTallyScript(source: string) {
  const lines = source.split(/\r?\n/);
  let repeatIndex = 0;
  return lines
    .map((original, index) => {
      const lineNumber = index + 1;
      const line = original.trim();
      if (!line || line.startsWith("#")) return "";
      let match: RegExpMatchArray | null;

      if ((match = line.match(/^add goal (.+)$/i)))
        return `Tally.goals.add(${compileExpression(match[1])});`;
      if ((match = line.match(/^remove goal (.+)$/i)))
        return `Tally.goals.remove(${compileExpression(match[1])});`;
      if ((match = line.match(/^add quick setting (.+)$/i)))
        return `Tally.cosmetic.super.quickSettings.add(${JSON.stringify(match[1].trim())});`;
      if ((match = line.match(/^remove quick setting (.+)$/i)))
        return `Tally.cosmetic.super.quickSettings.remove(${JSON.stringify(match[1].trim())});`;
      if (/^clear goals$/i.test(line)) return "Tally.goals.clear();";
      if (/^remove minimum$/i.test(line)) return "Tally.minimum.remove();";
      if (/^remove maximum$/i.test(line)) return "Tally.maximum.remove();";
      if ((match = line.match(/^move (.+?) to (.+?),\s*(.+)$/i)))
        return `Tally.cosmetic.super.move(${JSON.stringify(match[1].trim())}, ${compileExpression(match[2])}, ${compileExpression(match[3])});`;
      if ((match = line.match(/^scale (.+?) to (.+?)(?:,\s*(.+))?$/i)))
        return `Tally.cosmetic.super.scale(${JSON.stringify(match[1].trim())}, ${compileExpression(match[2])}${match[3] ? `, ${compileExpression(match[3])}` : ""});`;
      if ((match = line.match(/^rotate (.+?) to (.+)$/i)))
        return `Tally.cosmetic.super.rotate(${JSON.stringify(match[1].trim())}, ${compileExpression(match[2])});`;
      if ((match = line.match(/^resize (.+?) to (.+?),\s*(.+)$/i)))
        return `Tally.cosmetic.super.resize(${JSON.stringify(match[1].trim())}, ${compileExpression(match[2])}, ${compileExpression(match[3])});`;
      if ((match = line.match(/^show (.+)$/i)))
        return `Tally.cosmetic.super.show(${JSON.stringify(match[1].trim())});`;
      if ((match = line.match(/^hide (.+)$/i)))
        return `Tally.cosmetic.super.hide(${JSON.stringify(match[1].trim())});`;
      if ((match = line.match(/^reset super (.+)$/i)))
        return `Tally.cosmetic.super.reset(${JSON.stringify(match[1].trim())});`;
      if (/^reset$/i.test(line)) return "Tally.reset();";
      if ((match = line.match(/^jump to (.+)$/i)))
        return `Tally.value.jump(${compileExpression(match[1])});`;
      if ((match = line.match(/^add(?: (.+))?$/i)))
        return `Tally.value.add(${match[1] ? compileExpression(match[1]) : ""});`;
      if ((match = line.match(/^subtract(?: (.+))?$/i)))
        return `Tally.value.subtract(${match[1] ? compileExpression(match[1]) : ""});`;

      for (const [pattern, command] of settingCommands) {
        match = line.match(pattern);
        if (match) return command(compileExpression(match[1]));
      }

      if ((match = line.match(/^if (.+)$/i)))
        return `if (${compileExpression(match[1])}) {`;
      if (/^otherwise$/i.test(line)) return "} else {";
      if ((match = line.match(/^while (.+)$/i)))
        return `while (${compileExpression(match[1])}) {`;
      if ((match = line.match(/^repeat (.+) times?$/i))) {
        const variable = `tally_repeat_${repeatIndex++}`;
        const amount = compileExpression(match[1]);
        return `for (let ${variable} = 0; ${variable} < ${amount}; ${variable}++) {`;
      }
      if (/^end$/i.test(line)) return "}";
      if ((match = line.match(/^remember ([A-Za-z_$][\w$]*) as (.+)$/i)))
        return `let ${match[1]} = ${compileExpression(match[2])};`;

      throw new TallyScriptSyntaxError(
        lineNumber,
        `I don't understand “${line}”.`,
      );
    })
    .join("\n");
}
