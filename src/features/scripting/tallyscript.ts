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
import { parse } from "acorn";
import { createTallyApi, type ScriptProposal, type TallyScriptState } from "./tally-api";
import { compileTallyScript } from "./tallyscript-compiler";

const MAX_LOOP_ITERATIONS = 10_000;
const own = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export class TallyScriptError extends Error {
  constructor(message: string, node?: any) {
    super(
      node?.loc?.start?.line
        ? `Line ${node.loc.start.line}: ${message}`
        : message,
    );
    this.name = "TallyScriptError";
  }
}

type TallyScriptOptions = {
  signal?: AbortSignal;
  onUpdate?: (state: TallyScriptState) => void;
  onProposal?: (proposal: ScriptProposal) => void | Promise<TallyScriptState | void>;
  invocationId?: string;
  counterId?: string | number;
  authority?: "personal" | "retained" | "group";
};

export async function runTallyScript(
  source: string,
  counter: Record<string, any>,
  customization: Record<string, any> = {},
  options: TallyScriptOptions = {},
): Promise<TallyScriptState> {
  let program: any;
  try {
    program = parse(compileTallyScript(source), {
      ecmaVersion: 2022,
      locations: true,
      sourceType: "script",
    });
  } catch (error: any) {
    throw new TallyScriptError(error.message);
  }

  const {
    Tally,
    result,
    variables: tallyVariables,
  } = createTallyApi(counter, customization, (proposal) => options.onProposal?.({ ...proposal, invocationId: options.invocationId || "", operationId: crypto.randomUUID(), counterId: options.counterId ?? counter.id, authority: options.authority || "personal" }));
  const variables = new Map<string, any>();
  let loopIterations = 0;
  const publish = () => { if (!options.onProposal) options.onUpdate?.(structuredClone(result())); };
  const ensureRunning = () => {
    if (options.signal?.aborted) throw new TallyScriptError("Script stopped.");
  };
  const sleep = (milliseconds: number) => new Promise<void>((resolve, reject) => {
    ensureRunning();
    const duration = Math.max(0, Number(milliseconds));
    if (!Number.isFinite(duration)) throw new TallyScriptError("Sleep time must be a number.");
    const timer = window.setTimeout(done, duration);
    function done() {
      options.signal?.removeEventListener("abort", stop);
      loopIterations = 0;
      resolve();
    }
    function stop() {
      window.clearTimeout(timer);
      options.signal?.removeEventListener("abort", stop);
      reject(new TallyScriptError("Script stopped."));
    }
    options.signal?.addEventListener("abort", stop, { once: true });
  });

  const memberPath = (node: any): string[] => {
    if (node.type === "Identifier") return [node.name];
    if (node.type !== "MemberExpression" || node.computed)
      throw new TallyScriptError(
        "Only dotted Tally functions are supported.",
        node,
      );
    return [...memberPath(node.object), node.property.name];
  };
  const resolveTallyFunction = (node: any) => {
    const path = memberPath(node);
    if (path.shift() !== "Tally")
      throw new TallyScriptError(
        "Scripts may only call Tally functions.",
        node,
      );
    let parent: any = null;
    let value: any = Tally;
    for (const key of path) {
      if (!value || typeof value !== "object" || !own(value, key))
        throw new TallyScriptError(
          `Unknown Tally function: Tally.${path.join(".")}.`,
          node,
        );
      parent = value;
      value = value[key];
    }
    if (typeof value !== "function")
      throw new TallyScriptError("That Tally path is not callable.", node);
    return { value, parent };
  };

  const evaluate = (node: any): any => {
    if (!node) return undefined;
    switch (node.type) {
      case "Literal":
        return node.value;
      case "Identifier":
        if (variables.has(node.name)) return variables.get(node.name);
        if (node.name in tallyVariables())
          return tallyVariables()[
            node.name as keyof ReturnType<typeof tallyVariables>
          ];
        if (!variables.has(node.name))
          throw new TallyScriptError(`Unknown variable: ${node.name}.`, node);
        return variables.get(node.name);
      case "UnaryExpression": {
        const value = evaluate(node.argument);
        if (node.operator === "!") return !value;
        if (node.operator === "+") return +value;
        if (node.operator === "-") return -value;
        throw new TallyScriptError(
          `Unsupported operator: ${node.operator}.`,
          node,
        );
      }
      case "BinaryExpression": {
        const left = evaluate(node.left),
          right = evaluate(node.right);
        switch (node.operator) {
          case "+":
            return left + right;
          case "-":
            return left - right;
          case "*":
            return left * right;
          case "/":
            return left / right;
          case "%":
            return left % right;
          case "<":
            return left < right;
          case "<=":
            return left <= right;
          case ">":
            return left > right;
          case ">=":
            return left >= right;
          case "==":
          case "===":
            return left === right;
          case "!=":
          case "!==":
            return left !== right;
          default:
            throw new TallyScriptError(
              `Unsupported operator: ${node.operator}.`,
              node,
            );
        }
      }
      case "LogicalExpression":
        return node.operator === "&&"
          ? evaluate(node.left) && evaluate(node.right)
          : evaluate(node.left) || evaluate(node.right);
      case "ConditionalExpression":
        return evaluate(node.test)
          ? evaluate(node.consequent)
          : evaluate(node.alternate);
      case "AssignmentExpression": {
        if (node.left.type !== "Identifier" || !variables.has(node.left.name))
          throw new TallyScriptError(
            "Assignments require an existing variable.",
            node,
          );
        const current = variables.get(node.left.name),
          right = evaluate(node.right);
        const next =
          node.operator === "="
            ? right
            : node.operator === "+="
              ? current + right
              : node.operator === "-="
                ? current - right
                : node.operator === "*="
                  ? current * right
                  : node.operator === "/="
                    ? current / right
                    : (() => {
                        throw new TallyScriptError(
                          `Unsupported assignment: ${node.operator}.`,
                          node,
                        );
                      })();
        variables.set(node.left.name, next);
        return next;
      }
      case "UpdateExpression": {
        if (
          node.argument.type !== "Identifier" ||
          !variables.has(node.argument.name)
        )
          throw new TallyScriptError(
            "Updates require an existing variable.",
            node,
          );
        const current = Number(variables.get(node.argument.name));
        const next = node.operator === "++" ? current + 1 : current - 1;
        variables.set(node.argument.name, next);
        return node.prefix ? next : current;
      }
      case "CallExpression": {
        const callable = resolveTallyFunction(node.callee);
         return callable.value.apply(
          callable.parent,
          node.arguments.map(evaluate),
        );
      }
      default:
        throw new TallyScriptError(
          `Unsupported expression: ${node.type}.`,
          node,
        );
    }
  };

  const execute = async (node: any): Promise<"break" | "continue" | undefined> => {
    ensureRunning();
    switch (node.type) {
      case "Program":
      case "BlockStatement":
        for (const statement of node.body) {
          const signal = await execute(statement);
          if (signal) return signal;
        }
        return;
      case "EmptyStatement":
        return;
      case "ExpressionStatement":
        if (node.expression.type === "CallExpression") {
          const path = memberPath(node.expression.callee);
          if (path.join(".") === "Tally.sleep") {
            if (node.expression.arguments.length !== 1)
              throw new TallyScriptError("Sleep needs one duration.", node);
            await sleep(evaluate(node.expression.arguments[0]));
             publish();
            return;
          }
        }
         await evaluate(node.expression);
        publish();
        return;
      case "VariableDeclaration":
        if (node.kind === "var")
          throw new TallyScriptError("Use let or const instead of var.", node);
        for (const declaration of node.declarations) {
          if (declaration.id.type !== "Identifier")
            throw new TallyScriptError(
              "Only simple variable names are supported.",
              declaration,
            );
          if (declaration.id.name in tallyVariables())
            throw new TallyScriptError(
              `${declaration.id.name} is a read-only Tally variable.`,
              declaration,
            );
          variables.set(declaration.id.name, evaluate(declaration.init));
        }
        return;
      case "IfStatement":
        return evaluate(node.test)
          ? await execute(node.consequent)
          : node.alternate
            ? await execute(node.alternate)
            : undefined;
      case "WhileStatement":
        while (evaluate(node.test)) {
          if (++loopIterations > MAX_LOOP_ITERATIONS)
            throw new TallyScriptError("Loop limit exceeded.", node);
          const signal = await execute(node.body);
          if (signal === "break") break;
          if (signal === "continue") continue;
        }
        return;
      case "ForStatement":
        if (node.init)
          node.init.type === "VariableDeclaration"
            ? await execute(node.init)
            : evaluate(node.init);
        while (!node.test || evaluate(node.test)) {
          if (++loopIterations > MAX_LOOP_ITERATIONS)
            throw new TallyScriptError("Loop limit exceeded.", node);
          const signal = await execute(node.body);
          if (signal === "break") break;
          if (node.update) evaluate(node.update);
          if (signal === "continue") continue;
        }
        return;
      case "BreakStatement":
        return "break";
      case "ContinueStatement":
        return "continue";
      default:
        throw new TallyScriptError(
          `Unsupported statement: ${node.type}.`,
          node,
        );
    }
  };

  await execute(program);
  return result();
}
