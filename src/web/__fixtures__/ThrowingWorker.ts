import { ThreadPoolWorker } from "../ThreadPoolWorker";

let shouldThrow = true;

new ThreadPoolWorker<never, string>(() => {
  if (shouldThrow) {
    shouldThrow = false;
    throw new Error("Something went wrong");
  }
  return "hello";
});
