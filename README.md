# Thread Pool

A work stealing thread pool for the browser and node.js motivated by the design of `tokio::runtime::Builder`.

In the browser, each thread is an instance of a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) while the server uses the [`node:worker_threads`](https://nodejs.org/api/worker_threads.html) module.

This library provides an identical API for each platform - available at `@figliolia/thread-pool/web` nad `@figliolia/thread-pool/node`

1. [Installation](#installation)
2. [Workers](#setting-up-your-worker)
3. [Simple Theading](#simple-off-the-main-thread-work)
4. [Thread Pooling](#thread-pooling)

## Installation

```bash
npm i -D @figliolia/thread-pool
```

## Setting Up Your Worker

The Worker's script is typically what trips up new-comers to JavaScript's multi-threading model. With this in mind, we designed an interface to simplify worker creation.

Start by creating your worker file and wrapping your desired logic in
a `ThreadPoolWorker` instance;

```typescript
// worker.ts
import { ThreadPoolWorker } from "@figliolia/thread-pool/node";
// or
import { ThreadPoolWorker } from "@figliolia/thread-pool/web";

new ThreadPoolWorker((args: YourTaskArgs) => {
  // your multi-threaded work
  // return or throw the value you'd like to pass back
  // to the main thread
});

// that's it.
```

Your `ThreadPoolWorker` will be invoked every time a task is enqueued from a `Thread` or `ThreadPool` instance.

```typescript
// main thread
import { TheadPool, Thread } from "@figliolia/thread-pool/web|node";

const yourReturnValue = await new Thread(options).enqueueTask(myArgs);
// or
const yourReturnValue = await new ThreadPool(options).enqueueTask(myArgs);
```

A working example of a `ThreadPoolWorker` script might look like the following:

```typescript
// worker.ts
import { readdir } from "node:fs/promises";
import { ThreadPoolWorker } from "@figliolia/thread-pool/node";

new ThreadPoolWorker((event: { filePath: string; search: string }) => {
  // scan the file system recursively
  const list = readdir(event.filePath, {
    recursive: true,
    withFileTypes: true,
  });
  const results: string[] = [];
  for (const entry of list) {
    // search for files that include the search string
    if (entry.isFile() && entry.name.includes(event.search)) {
      results.push(entry.parentPath);
    }
  }
  // return all matching file paths
  return results;
});
```

## Simple "Off-The-Main-Thread" Work

To spawn a thread for more predictable `off-the-main-thread` work, use the `Thread` object

```typescript
import { Thread } from "@figliolia/thread-pool/node";
// or
import { Thread } from "@figliolia/thread-pool/web";

const myThread = new Thread<ArgsType, ResultType>(
  {
    // a script to run on the thread
    workerScript: new URL("./your-worker-script.ts", import.meta.url),
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
  {/* WorkerOptions */},
);

// Run a task on your thread
const result = await myThread.enqueueTask(args);
// args will be posted to your worker script

// Get the current measure of thread latency
const latency = await myThread.ping();

// whether the thread has no pending tasks running
myThread.isIdle;

// a map of all currently running tasks keyed by their task IDs
myThread.outstandingTasks;

// the number of currently running tasks on the thread
myThread.totalOutstandingTasks;

// to shut down your thread once it reaches an idle state
await myThread.shutDownBackground();

// to shut down your thread without waiting on pending tasks to complete
await myThread.shutDown();
```

## Thread Pooling

When optimizing the distribution of a large number of concurrent tasks, opt for the `TheadPool`. The `ThreadPool` will load-balance your tasks load between a pool of `Threads`:

```typescript
import { ThreadPool } from "@figliolia/thread-pool/web";
// or
import { ThreadPool } from "@figliolia/thread-pool/node";

const myPool = new ThreadPool({
  // a script to run on the thread
  workerScript: new URL("./your-worker-script.ts", import.meta.url),
  // (optional) if a thread is idle for this duration it will shut down.
  // It can be brought back up simply by queueing a task to it
  threadIdleTimeout: 2000,
  // (optional) a threadhold of milliseconds used to abandon a pending task
  taskTimeoutThreshold: Infinity,
  // (optional) an optional max number of tasks to allow to run concurrently
  // on a given thread
  maxConcurrency: Infinity,
  // (optional) whether to spawn threads based on necessity or to pre-allocate them
  lazySpawnThreads: true,
  // (optional) the maximum number of threads allow the pool allocate
  maximumThreadCount: os.cpus().length / 2,
});

// to run a task in your thread pool
const result = await myPool.enqueueTask(args);
// args will be posted to your worker script

// Returns the lowest latency thread between all threads in the pool
const latency = await myPool.ping();

// A list of tasks currently running in the pool
myPool.pendingTasks;

// the total number of pending tasks in the pool
myPool.totalPendingTasks;

// returns true if all threads in the pool are idle
myPool.isIdle;

// returns true if at least one thread in the pool is idle
myPool.hasIdleThread;

// the current thread pool
myPool.pool;

// A list of the currently operating threads in the pool
myPool.threads;

// to kill all threads in the pool once they reach idle
await myPool.shutDownBackground();

// to kill all threads in the pool without waiting for them to reach idle
await myPool.shutDown();
```
