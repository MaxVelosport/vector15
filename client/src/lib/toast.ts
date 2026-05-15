import { toast as sonner } from "sonner";

type Opts = Parameters<typeof sonner.success>[1];

function toast(message: string, opts?: Opts) {
  return sonner(message, opts);
}

toast.success = (message: string, opts?: Opts) =>
  sonner.success(message, { duration: 3000, ...opts });

toast.error = (message: string, opts?: Opts) =>
  sonner.error(message, { duration: 5000, ...opts });

toast.info = (message: string, opts?: Opts) =>
  sonner.info(message, { duration: 4000, ...opts });

toast.warning = (message: string, opts?: Opts) =>
  sonner.warning(message, { duration: 4000, ...opts });

toast.message = (message: string, opts?: Opts) =>
  sonner.message(message, opts);

toast.loading = (message: string, opts?: Parameters<typeof sonner.loading>[1]) =>
  sonner.loading(message, opts);

toast.dismiss = sonner.dismiss;

export { toast };
