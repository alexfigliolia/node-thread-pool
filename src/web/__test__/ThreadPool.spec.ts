import { ThreadPool } from "../ThreadPool";
import { type Args } from "../__fixtures__/Worker";
import { WithTearDown } from "../__fixtures__/WithTearDown";

describe("Thread Pool", async () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setTimerTickMode("manual");
  });
  (
    [
      ["lazy-spawn", 4],
      ["pre-allocate", Math.trunc(navigator.hardwareConcurrency / 2)],
    ] as const
  ).forEach(([method, threads]) => {
    it(`It load balances compute - ${method} threads`, async () => {
      const Pool = new ThreadPool<Args, number[]>(
        {
          lazySpawnThreads: method === "lazy-spawn",
          // @ts-expect-error common.js target
          workerScript: new URL("../__fixtures__/Worker.ts", import.meta.url),
        },
        { type: "module" },
      );
      const results = await Promise.all(
        [1, 2, 3, 4].map(n => Pool.enqueueTask({ target: n * 1000 })),
      );
      results.forEach((result, i) => {
        expect(result).toHaveLength((i + 1) * 1000);
      });
      await expect(
        Pool.enqueueTask({ target: 1000, fail: true }),
      ).rejects.toThrow("Something went wrong");
      expect(Pool.threads).toHaveLength(threads);
      expect(Pool.pool).toHaveLength(
        Math.trunc(navigator.hardwareConcurrency / 2),
      );
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      expect(Pool.threads).toHaveLength(0);
      expect(Pool.isIdle).toEqual(true);
    });
  });

  (["lazy-spawn", "pre-allocate"] as const).forEach(method => {
    it(`When the thread pool is running tasks on all threads, the load balancer falls back on latency checks for allocating new tasks - ${method} threads`, async () => {
      const THREAD_COUNT = 4;
      const Pool = new ThreadPool<Args, number[]>(
        {
          maximumThreadCount: THREAD_COUNT,
          lazySpawnThreads: method === "lazy-spawn",
          // @ts-expect-error common.js target
          workerScript: new URL("../__fixtures__/Worker.ts", import.meta.url),
        },
        { type: "module" },
      );
      const firstFourTasks = Array.from(
        { length: THREAD_COUNT },
        (_, i) => i + 1,
      ).map(n => Pool.enqueueTask({ target: (THREAD_COUNT - n) * 1000 }));
      const spies = Pool.threads.map(thread => vi.spyOn(thread!, "ping"));
      const last4Tasks = Array.from(
        { length: THREAD_COUNT },
        (_, i) => i + 1,
      ).map(n => Pool.enqueueTask({ target: (THREAD_COUNT - n) * 2 * 1000 }));
      (await Promise.all(firstFourTasks)).forEach((result, i) => {
        expect(result).toHaveLength((THREAD_COUNT - (i + 1)) * 1000);
      });
      (await Promise.all(last4Tasks)).forEach((result, i) => {
        expect(result).toHaveLength((THREAD_COUNT - (i + 1)) * 2 * 1000);
      });
      expect(spies).toHaveLength(THREAD_COUNT);
      spies.forEach(spy => {
        expect(spy).toHaveBeenCalledTimes(THREAD_COUNT);
      });
      expect(Pool.threads).toHaveLength(THREAD_COUNT);
      expect(Pool.pool).toHaveLength(THREAD_COUNT);
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      expect(Pool.threads).toHaveLength(0);
      expect(Pool.isIdle).toEqual(true);
    });
  });

  await WithTearDown(
    new ThreadPool<undefined, string>(
      {
        workerScript: new URL(
          "../__fixtures__/ThrowingWorker.ts",
          // @ts-expect-error common.js target
          import.meta.url,
        ),
      },
      { type: "module" },
    ),
    Pool => {
      it("Threads are resilient to crashes", async () => {
        await expect(Pool.enqueueTask(undefined)).rejects.toThrow(
          new Error("Something went wrong"),
        );
        expect(await Pool.enqueueTask(undefined)).toEqual("hello");
        expect(Pool.isIdle).toEqual(true);
      });
    },
  );
});
