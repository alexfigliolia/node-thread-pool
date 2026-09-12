import { ThreadPoolWorker } from "../ThreadPoolWorker";

let shouldThrow = true;

new ThreadPoolWorker<{}, string>((_, resolve) => {
  if (shouldThrow) {
    shouldThrow = false;
    throw new Error("Something went wrong");
  }
  return resolve("hello");
});
