export type RazorpayCheckoutSuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckout = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

let checkoutScriptPromise: Promise<void> | null = null;

export async function ensureRazorpayCheckout() {
  if (window.Razorpay) return;
  if (checkoutScriptPromise) return checkoutScriptPromise;

  checkoutScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-pujaone-razorpay="checkout"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Secure checkout could not load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.pujaoneRazorpay = "checkout";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Secure checkout could not load."));
    document.head.appendChild(script);
  }).catch((error) => {
    checkoutScriptPromise = null;
    throw error;
  });

  return checkoutScriptPromise;
}
