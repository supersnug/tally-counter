import RELEASE_SYNC from "@jitl/quickjs-wasmfile-release-sync";
import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSContext,
  type QuickJSHandle,
} from "quickjs-emscripten-core";
import { createTallyApi, type TallyScriptState } from "./tally-api";

const CPU_BURST_LIMIT_MS = 1_000;
const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const STACK_LIMIT_BYTES = 512 * 1024;
const quickJsModule = newQuickJSWASMModuleFromVariant(RELEASE_SYNC);

export class JavaScriptSandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JavaScriptSandboxError";
  }
}

type JavaScriptOptions = {
  signal?: AbortSignal;
  onUpdate?: (state: TallyScriptState) => void;
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
  const QuickJS = await quickJsModule;
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  runtime.setMaxStackSize(STACK_LIMIT_BYTES);

  let cpuDeadline = Date.now() + CPU_BURST_LIMIT_MS;
  let stopped = options.signal?.aborted || false;
  const pendingSleeps = new Set<{
    timer: ReturnType<typeof setTimeout>;
    wake: () => void;
    cancel: () => void;
  }>();
  runtime.setInterruptHandler(() => Date.now() > cpuDeadline);
  const context = runtime.newContext();
  const { Tally, result, variables } = createTallyApi(counter, customization);

  const publish = () => options.onUpdate?.(structuredClone(result()));
  const expose = (target: QuickJSHandle, value: Record<string, any>) => {
    for (const [key, member] of Object.entries(value)) {
      if (typeof member === "function") {
        const handle = context.newFunction(key, (...arguments_) => {
          const returned = member(
            ...arguments_.map((item) => context.dump(item)),
          );
          publish();
          return toHandle(context, returned);
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
    const settle = (cancelled: boolean) => {
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
        promise.resolve(context.undefined);
      }
      promise.dispose();
      const jobs = runtime.executePendingJobs();
      if ("error" in jobs) jobs.error.dispose();
    };
    const entry = {
      timer: setTimeout(() => settle(false), milliseconds),
      wake: () => settle(false),
      cancel: () => settle(true),
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
    publish();
    return result();
  } finally {
    options.signal?.removeEventListener("abort", stop);
    for (const sleep of pendingSleeps) clearTimeout(sleep.timer);
    context.dispose();
    runtime.dispose();
  }
}
