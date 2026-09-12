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
          workerScript: new URL("../__fixtures__/Worker.ts", import.meta.url),
        },
        { type: "module" },
      );
      const results = await Promise.all(
        [1, 2, 3, 4].map(n => Pool.enqueueTask({ target: n * 1_000_000 })),
      );
      results.forEach((result, i) => {
        expect(result).toHaveLength((i + 1) * 1_000_000);
      });
      await expect(
        Pool.enqueueTask({ target: 1_000_000, fail: true }),
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

  await WithTearDown(
    new ThreadPool<{}, string>(
      {
        workerScript: new URL(
          "../__fixtures__/ThrowingWorker.ts",
          import.meta.url,
        ),
      },
      { type: "module" },
    ),
    Pool => {
      it("Threads are resilient to crashes", async () => {
        await expect(Pool.enqueueTask({})).rejects.toThrow(
          expect.any(ErrorEvent),
        );
        expect(await Pool.enqueueTask({})).toEqual("hello");
        expect(Pool.isIdle).toEqual(true);
      });
    },
  );
});
