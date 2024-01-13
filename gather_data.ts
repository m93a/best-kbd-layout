import { asyncCombine, enumerate, timeout } from './utils.ts';

Deno.addSignalListener('SIGINT', () => {
  Deno.stdin.setRaw(false);
  Deno.exit(0);
});

const positionDescriptions = {
  left_r0_c0: 'Move your left pinkie one key to the left and one key up from its resting position',
  left_r0_c1: 'Move your left pinkie one key up from its resting position',
  left_r0_c2: 'Move your left ring finger one key up from its resting position',
  left_r0_c3: 'Move your left middle finger one key up from its resting position',
  left_r0_c4: 'Move your left index finger one key up from its resting position',
  left_r0_c5: 'Move your left index finger one key to the right and one key up from its resting position',

  left_r1_c0: 'Move your left pinkie one key to the left from its resting position',
  left_r1_c1: 'Leave your left pinkie in its resting position',
  left_r1_c2: 'Leave your left ring finger in its resting position',
  left_r1_c3: 'Leave your left middle finger in its resting position',
  left_r1_c4: 'Leave your left index finger in its resting position',
  left_r1_c5: 'Move your left index finger one key to the right from its resting position',

  left_r2_c0: 'Move your left pinkie one key to the left and one key down from its resting position',
  left_r2_c1: 'Move your left pinkie one key down from its resting position',
  left_r2_c2: 'Move your left ring finger one key down from its resting position',
  left_r2_c3: 'Move your left middle finger one key down from its resting position',
  left_r2_c4: 'Move your left index finger one key down from its resting position',
  left_r2_c5: 'Move your left index finger one key to the right and one key down from its resting position',

  left_thumb_0: 'Move your left thumb one key to the left from its resting position',
  left_thumb_1: 'Leave your left thumb in its resting position',
  left_thumb_2: 'Move your left thumb one key to the right from its resting position',

  right_r0_c0: 'Move your right index finger one key to the left and one key up from its resting position',
  right_r0_c1: 'Move your right index finger one key up from its resting position',
  right_r0_c2: 'Move your right middle finger one key up from its resting position',
  right_r0_c3: 'Move your right ring finger one key up from its resting position',
  right_r0_c4: 'Move your right pinkie one key up from its resting position',
  right_r0_c5: 'Move your right pinkie one key to the right and one key up from its resting position',

  right_r1_c0: 'Move your right index finger one key to the left from its resting position',
  right_r1_c1: 'Leave your right index finger in its resting position',
  right_r1_c2: 'Leave your right middle finger in its resting position',
  right_r1_c3: 'Leave your right ring finger in its resting position',
  right_r1_c4: 'Leave your right pinkie in its resting position',
  right_r1_c5: 'Move your right pinkie one key to the right from its resting position',

  right_r2_c0: 'Move your right index finger one key to the left and one key down from its resting position',
  right_r2_c1: 'Move your right index finger one key down from its resting position',
  right_r2_c2: 'Move your right middle finger one key down from its resting position',
  right_r2_c3: 'Move your right ring finger one key down from its resting position',
  right_r2_c4: 'Move your right pinkie one key down from its resting position',
  right_r2_c5: 'Move your right pinkie one key to the right and one key down from its resting position',

  right_thumb_0: 'Move your right thumb one key to the left from its resting position',
  right_thumb_1: 'Leave your right thumb in its resting position',
  right_thumb_2: 'Move your right thumb one key to the right from its resting position',
};

export async function* readKeys(signal: AbortSignal) {
  const decoder = new TextDecoder();
  const reader = Deno.stdin.readable.getReader();

  Deno.stdin.setRaw(true, { cbreak: true });
  while (!signal.aborted) {
    const key = await reader.read();
    if (signal.aborted) break;
    yield decoder.decode(key.value);
  }
  reader.releaseLock();
  Deno.stdin.setRaw(false);
}

export async function gatherKeysFor({ ms, description }: { ms: number; description: string }) {
  console.clear();
  console.log(description);
  alert('Press any key when ready...');

  const ac = new AbortController();
  const keys: string[] = [];

  let lastN = -1;
  for await (
    const [keyN, update] of asyncCombine(
      enumerate(readKeys(ac.signal)),
      timeout({ totalMs: ms, signal: ac.signal, updateMs: 500 }),
    )
  ) {
    const { remainingMs } = update ?? {};
    const [n, key] = keyN ?? [];

    if (key && n && n !== lastN) {
      lastN = n;
      keys.push(key);
    }

    console.clear();
    console.log(description);
    console.log();
    console.log(`Keys pressed: ${keys.length}`);
    console.log(`Remaining time: ${Math.floor((remainingMs ?? 0) / 1000)}s`);

    if ((remainingMs ?? 0) <= 0) ac.abort();
  }

  return keys;
}

type FingerPosition = keyof typeof positionDescriptions;
const singleKeyPerMinute: { [key in FingerPosition]?: string[] } = {};

for (const [pos, desc] of Object.entries(positionDescriptions) as [FingerPosition, string][]) {
  const keys = await gatherKeysFor({
    ms: 5_000,
    description: `
You will have to press the described key as fast as you can for one minute.
Position: ${desc}.
`.trim(),
  });

  singleKeyPerMinute[pos] = keys;
}

console.clear();
console.log(JSON.stringify(singleKeyPerMinute, undefined, 2));
