import { ThreadPoolWorker } from "../ThreadPoolWorker";

new ThreadPoolWorker<Args, number[]>((args, resolve, reject) => {
  if (args.fail) {
    return reject("Something went wrong");
  }
  return resolve(Array.from({ length: args.target }, (_, i) => i));
});

export interface Args {
  target: number;
  fail?: boolean;
}
