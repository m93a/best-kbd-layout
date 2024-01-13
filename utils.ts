export const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
export const never = () => new Promise<void>(() => {});

export interface EventTarget<E extends string, T = void> {
  addEventListener(event: E, listener: (payload: T) => void): void;
  removeEventListener(event: E, listener: (payload: T) => void): void;
}
export const on = <E extends string, T = void>(target: EventTarget<E, T>, event: E) =>
  new Promise<T>((res) => {
    const listener = (payload: T) => {
      target.removeEventListener(event, listener);
      res(payload);
    };
    target.addEventListener(event, listener);
  });

export interface TimeoutOptions {
  totalMs: number;
  updateMs?: number;
  signal?: AbortSignal;
}
export interface TimeoutUpdate {
  elapsedMs: number;
  remainingMs: number;
}

export async function* timeout(options: TimeoutOptions): AsyncIterable<TimeoutUpdate> {
  options.updateMs ??= 250;
  const { totalMs, updateMs, signal } = options;

  const startMs = Date.now();
  const endMs = startMs + totalMs;

  const totalPromise = delay(totalMs);
  let updatePromise = Promise.resolve();
  const abortPromise = signal ? on(signal, 'abort') : never();

  while (true) {
    await Promise.any([totalPromise, updatePromise, abortPromise]);
    if (signal?.aborted) return;

    const now = Date.now();
    yield {
      elapsedMs: now - startMs,
      remainingMs: endMs - now,
    };
    if (endMs - now <= 0) return;

    updatePromise = delay(updateMs);
  }
}

export async function* enumerate<T>(iter: AsyncIterable<T>): AsyncIterable<[number, T]> {
  let i = 0;
  for await (const value of iter) {
    yield [i++, value];
  }
}

export async function* asyncCombine<S, T>(
  a: AsyncIterable<S>,
  b: AsyncIterable<T>,
): AsyncIterable<[S | undefined, T | undefined]> {
  let aVal: S | undefined;
  let bVal: T | undefined;
  let aDone = false;
  let bDone = false;

  const aIter = a[Symbol.asyncIterator]();
  const bIter = b[Symbol.asyncIterator]();
  let aPromise: Promise<void> | undefined;
  let bPromise: Promise<void> | undefined;

  const aRequestNext = () =>
    aPromise = aIter.next().then((res) => {
      if (res.done) aDone = true;
      aVal = res.value;
      if (!aDone) aRequestNext();
    });
  const bRequestNext = () =>
    bPromise = bIter.next().then((res) => {
      if (res.done) bDone = true;
      bVal = res.value;
      if (!bDone) bRequestNext();
    });

  aRequestNext();
  bRequestNext();

  while (true) {
    if (!aDone && !bDone) await Promise.any([aPromise, bPromise]);
    else if (aDone) await bPromise;
    else if (bDone) await aPromise;

    if (aDone && bDone) return;
    yield [aVal, bVal];
  }
}
