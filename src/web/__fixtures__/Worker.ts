import { ThreadPoolWorker } from "../ThreadPoolWorker";

new ThreadPoolWorker<Args, number[]>(args => {
  if (args.fail) {
    throw "Something went wrong";
  }
  return Array.from({ length: args.target }, (_, i) => i);
});

export interface Args {
  target: number;
  fail?: boolean;
}
