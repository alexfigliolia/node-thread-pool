# Thread Pool

A work stealing thread pool using node.js worker threads - motivated by the design of `tokio::runtime::Builder`.

## Installation

```bash
npm i -D @figliolia/thread-pool
```

## Setting Up Your Worker

Worker scripts are typically what trip up new-comers to node's multi-threading model.

Using this library, a type-safe worker script is as simple as wrapping your logic in a `ThreadPoolWorker` instance:

```typescript
// worker.ts
import { ThreadPoolWorker } from "@figliolia/thread-pool";

new ThreadPoolWorker((event: YourTaskArgs) => {
  // your multi-threaded work
});

// that's it.
```

Your callback will be invoked every time your enqueue a task using a `Thread` or `ThreadPool` instance. Your callback's return value will be the resolved value of the task's promise.

```typescript
const result = await new Thread(options).enqueueTask(myArgs);
// or
const result = await new ThreadPool(ThreadPool).enqueueTask(myArgs);
```

A working example of a `ThreadPoolWorker` managed script might look like the following:

```typescript
// worker.ts
import { readdir } from "node:fs/promises";
import { ThreadPoolWorker } from "@figliolia/thread-pool";

new ThreadPoolWorker((event: QueuedTaskArgs) => {
  // scan the file system recursively
  const list = readdir(args.filePath, {
    recursive: true,
    withFileTypes: true,
  });
  const results: string[] = [];
  for (const entry of list) {
    // search for files that include the search string
    if (entry.isFile() && entry.name.includes(search)) {
      results.push(entry.parentPath);
    }
  }
  // resolve with all matching file paths
  return results;
});

interface QueuedTaskArgs {
  filePath: string;
  search: string;
}
```

## Simple "Off-The-Main-Thread" Work

To spawn a thread for `off-the-main-thread` work, use the `Thread` object

```typescript
import { Thread } from "@figliolia/thread-pool";

const myThread = new Thread<ArgsType, ResultType>(
  {
    // a script to run on the thread
    workerScript: "./your-thread-pool-worker-script.js",
    // (optional) if a thread is idle for this duration it will shut down.
    // It can be brought back up simply by enqueing another task
    threadIdleTimeout: 2000,
    // (optional) a threadhold of milliseconds used to abandon a pending task
    taskTimeoutThreshold: Infinity,
    // (optional) an optional max number of tasks to allow to run concurrently
    maxConcurrency: Infinity,
    // (optional) a callback to run when the thread is destroyed
    onDestroy: () => {},
  },
  {/* Node.JS.WorkerOptions */},
);

// Run a task on your thread
const result = await myThread.enqueueTask(args);
// args will be posted to your worker script

// to kill your thread once all enqueued tasks complete
await myThread.killBackground();

// to kill your thread without waiting on pending tasks
await myThread.kill();

// whether the thread has no pending tasks running
myThread.isIdle;

// the number of tasks the thread is currently running
myThread.outstandingTasks;
```

## Thread Pooling

When optimizing the distribution of a large number of concurrent tasks, opt for the `TheadPool`. The `ThreadPool` will handle optimizing the distribution of your tasks amongst a series of idle threads.

```typescript
import { ThreadPool } from "@figliolia/thread-pool";

const myPool = new ThreadPool({
  // a script to run on the thread
  workerScript: "./your-thread-pool-worker-script.js",
  // (optional) if a thread is idle for this duration it will shut down.
  // It can be brought back up simply by enqueing another task
  threadIdleTimeout: 2000,
  // (optional) a threadhold of milliseconds used to abandon a pending task
  taskTimeoutThreshold: Infinity,
  // (optional) an optional max number of tasks to allow to run concurrently
  // on a given thread
  maxConcurrency: Infinity,
  // (optional) whether to spawn threads based on necessity or to pre-allocate them
  lazySpawnThreads: true,
  // (optional) the maximum number of threads allow the pool allocate
  totalThreads: os.cpus().length / 2,
});

// to run a task in your thread pool
const result = await myPool.enqueueTask(args);
// args will be posted to your worker script

// to kill your thread pool once all enqueued tasks complete
await myPool.shutDownBackground();

// to kill your thread pool without waiting on pending tasks
await myPool.shutDown();

// every task currently running in the pool
myPool.pendingTasks;

// the total number of pending tasks in the pool
myPool.totalPendingTasks;

// whether or not the pool is currently not waiting on any tasks to complete
myPool.isIdle;

// whether or not the pool currently has a thread not waiting on a task to complete
myPool.hasIdleThread;

// the current thread pool
myPool.threads;
```
