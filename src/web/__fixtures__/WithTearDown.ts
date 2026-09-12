import type { ThreadPool } from "../ThreadPool";
import type { Thread } from "../Thread";

export const WithTearDown = async <
  T extends Thread<any, any> | ThreadPool<any, any>,
>(
  Thread: T,
  cb: (thread: T) => void | Promise<void>,
) => {
  await cb(Thread);
  await Thread.shutDown();
};
