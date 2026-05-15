import { useEffect } from "react";
import { toast } from "@/lib/toast";

type PaymentParam = "purchase" | "payment";
type PaymentValue = "success" | "fail" | "cancel";

interface Options {
  param: PaymentParam;
  successMessage: string;
  failMessage?: string;
  successAction?: () => void;
}

export function usePaymentResult(options: Options) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(options.param) as PaymentValue | null;

    if (value === "success") {
      toast.success(options.successMessage, { duration: 6000 });
      options.successAction?.();
    } else if (value === "fail") {
      toast.error(options.failMessage ?? "Платёж не прошёл. Попробуйте ещё раз.", { duration: 6000 });
    } else if (value === "cancel") {
      toast.info("Платёж отменён.", { duration: 4000 });
    }

    if (value) {
      url.searchParams.delete(options.param);
      window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
