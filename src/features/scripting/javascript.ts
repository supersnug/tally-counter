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
import RELEASE_SYNC from "@jitl/quickjs-wasmfile-release-sync";
import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSContext,
  type QuickJSHandle,
} from "quickjs-emscripten-core";
import { createTallyApi, type ScriptProposal, type TallyScriptState } from "./tally-api";

const CPU_BURST_LIMIT_MS = 1_000;
const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const STACK_LIMIT_BYTES = 512 * 1024;
const QUICK_JS_MODULE = newQuickJSWASMModuleFromVariant(RELEASE_SYNC);

export class JavaScriptSandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JavaScriptSandboxError";
  }
}

type JavaScriptOptions = {
  signal?: AbortSignal;
  onUpdate?: (state: TallyScriptState) => void;
  onProposal?: (proposal: ScriptProposal) => void | Promise<TallyScriptState | void>;
  invocationId?: string;
  counterId?: string | number;
  authority?: "personal" | "retained" | "group";
};

const toHandle = (context: QuickJSContext, value: unknown): QuickJSHandle => {
  if (value === undefined) return context.undefined;
  if (value === null) return context.null;
  if (typeof value === "number") return context.newNumber(value);
  if (typeof value === "boolean") return value ? context.true : context.false;
  if (typeof value === "string") return context.newString(value);
  if (Array.isArray(value)) {
    const array = context.newArray();
    value.forEach((item, index) => {
      const handle = toHandle(context, item);
      context.setProp(array, index, handle);
      if (handle !== context.undefined && handle !== context.null)
        handle.dispose();
    });
    return array;
  }
  return context.newString(JSON.stringify(value));
};

export async function runJavaScript(
  source: string,
  counter: Record<string, any>,
  customization: Record<string, any> = {},
  options: JavaScriptOptions = {},
): Promise<TallyScriptState> {
  const QuickJS = await QUICK_JS_MODULE;
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  runtime.setMaxStackSize(STACK_LIMIT_BYTES);

  let cpuDeadline = Date.now() + CPU_BURST_LIMIT_MS;
  let stopped = options.signal?.aborted || false;
  let publicationFailure: unknown;
  let publicationQueue = Promise.resolve();
  const pendingSleeps = new Set<{
    timer: ReturnType<typeof setTimeout>;
    wake: () => void;
    cancel: () => void;
  }>();
  runtime.setInterruptHandler(() => Date.now() > cpuDeadline);
  const context = runtime.newContext();
  const enqueueProposal = (proposal: Omit<ScriptProposal, "invocationId" | "operationId" | "counterId" | "authority">) => {
    if (publicationFailure || stopped) return;
    const fullProposal = { ...proposal, invocationId: options.invocationId || "", operationId: crypto.randomUUID(), counterId: options.counterId ?? counter.id, authority: options.authority || "personal" };
    publicationQueue = publicationQueue.then(async () => {
      if (publicationFailure || stopped) return;
      const authoritative = await options.onProposal?.(fullProposal);
      if (authoritative) replaceState(authoritative);
    }).catch((error) => {
      publicationFailure = error;
    });
  };
  const drainPublications = async () => {
    await publicationQueue;
    if (publicationFailure) throw publicationFailure;
    if (stopped) throw new JavaScriptSandboxError("Script stopped.");
  };
  const { Tally, result, variables, replaceState } = createTallyApi(counter, customization, (proposal) => { enqueueProposal(proposal); });

  const expose = (target: QuickJSHandle, value: Record<string, any>) => {
    const mutatorNames = new Set(["set", "exact", "jump", "add", "subtract", "reset", "start", "step", "addGoal", "remove", "clear", "setDirection", "setMinimum", "setMaximum", "setName", "setColor", "hide", "show", "move", "scale", "rotate", "resize"]);
    for (const [key, member] of Object.entries(value)) {
      if (typeof member === "function") {
        const handle = context.newFunction(key, (...arguments_) => {
          const returned = member(
            ...arguments_.map((item) => context.dump(item)),
          );
          if (!options.onProposal) options.onUpdate?.(structuredClone(result()));
          return mutatorNames.has(key) ? context.undefined : toHandle(context, returned);
        });
        context.setProp(target, key, handle);
        handle.dispose();
      } else if (member && typeof member === "object") {
        const handle = context.newObject();
        expose(handle, member);
        context.setProp(target, key, handle);
        handle.dispose();
      }
    }
  };

  const tallyHandle = context.newObject();
  expose(tallyHandle, Tally as unknown as Record<string, any>);
  const sleepHandle = context.newFunction("sleep", (millisecondsHandle) => {
    const milliseconds = Math.max(0, context.getNumber(millisecondsHandle));
    const promise = context.newPromise();
    let settled = false;
    const settle = async (cancelled: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(entry.timer);
      pendingSleeps.delete(entry);
      cpuDeadline = Date.now() + CPU_BURST_LIMIT_MS;
      if (cancelled) {
        const error = context.newError("Script stopped.");
        promise.reject(error);
        error.dispose();
      } else {
        try {
          await drainPublications();
        } catch (error) {
          const details = context.newError(error instanceof Error ? error.message : "Script publication failed.");
          promise.reject(details);
          details.dispose();
          promise.dispose();
          const jobs = runtime.executePendingJobs();
          if ("error" in jobs) jobs.error.dispose();
          return;
        }
        promise.resolve(context.undefined);
      }
      promise.dispose();
      const jobs = runtime.executePendingJobs();
      if ("error" in jobs) jobs.error.dispose();
    };
    const entry = {
      timer: setTimeout(() => void settle(false), milliseconds),
      wake: () => void settle(false),
      cancel: () => void settle(true),
    };
    pendingSleeps.add(entry);
    return promise.handle;
  });
  context.setProp(tallyHandle, "sleep", sleepHandle);
  sleepHandle.dispose();
  context.setProp(context.global, "Tally", tallyHandle);
  tallyHandle.dispose();
  for (const key of Object.keys(variables()))
    context.defineProp(context.global, key, {
      enumerable: true,
      get: () =>
        toHandle(
          context,
          variables()[key as keyof ReturnType<typeof variables>],
        ),
    });

  const stop = () => {
    stopped = true;
    for (const sleep of [...pendingSleeps]) sleep.cancel();
  };
  options.signal?.addEventListener("abort", stop, { once: true });
  if (options.signal?.aborted) stop();

  try {
    const evaluation = context.evalCode(`
      (async () => {
        "use strict";
        ${source}
      })()
    `);
    if ("error" in evaluation) {
      const details = context.dump(evaluation.error);
      evaluation.error.dispose();
      throw new JavaScriptSandboxError(
        details?.message || "JavaScript execution failed.",
      );
    }

    const resolution = context.resolvePromise(evaluation.value);
    const initialJobs = runtime.executePendingJobs();
    if ("error" in initialJobs) initialJobs.error.dispose();
    const resolved = await resolution;
    await drainPublications();
    evaluation.value.dispose();
    if ("error" in resolved) {
      const details = context.dump(resolved.error);
      resolved.error.dispose();
      const interrupted =
        stopped || /interrupted/i.test(details?.message || "");
      throw new JavaScriptSandboxError(
        interrupted
          ? stopped
            ? "Script stopped."
            : "Script stopped after using too much uninterrupted CPU time. Add await Tally.sleep(...) inside long-running loops."
          : details?.message || "JavaScript execution failed.",
      );
    }
    resolved.value.dispose();
    if (!options.onProposal) options.onUpdate?.(structuredClone(result()));
    return result();
  } finally {
    options.signal?.removeEventListener("abort", stop);
    for (const sleep of pendingSleeps) clearTimeout(sleep.timer);
    context.dispose();
    try {
      runtime.dispose();
    } catch (error) {
      if (stopped) throw new JavaScriptSandboxError("Script stopped.");
      throw error;
    }
  }
}
