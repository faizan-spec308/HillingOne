import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Lock, CreditCard, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { stripePromise, IS_STRIPE_TEST_MODE } from "../lib/stripe";

function CheckoutForm({ amountDisplay, onSuccess, onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message);
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      onSuccess();
    } else {
      setError("Payment did not complete. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: "tabs",
          fields: { billingDetails: { name: "auto" } },
        }}
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          className="btn-secondary flex-1"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="btn-primary flex-1"
        >
          {processing ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Processing…
            </>
          ) : (
            <>
              <CheckCircle2 size={15} />
              Pay {amountDisplay}
            </>
          )}
        </button>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[12px]" style={{ color: "var(--text-3)" }}>
        <Lock size={11} />
        Secured by Stripe · Payments encrypted end-to-end
      </div>
    </form>
  );
}

export default function PaymentForm({ clientSecret, amountDisplay, asset, booking, onSuccess, onBack }) {
  const { isDark } = useTheme();

  const venueLine = asset && booking?.start_time
    ? `${asset.name} · ${new Date(booking.start_time).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${new Date(booking.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}–${new Date(booking.end_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : null;

  const options = {
    clientSecret,
    appearance: {
      theme: isDark ? "night" : "stripe",
      variables: {
        colorPrimary: "#0D9488",
        colorBackground: isDark ? "#161B22" : "#ffffff",
        colorText: isDark ? "#E6EDF3" : "#111827",
        borderRadius: "12px",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSizeBase: "14px",
      },
    },
  };

  return (
    <div className="max-w-md mx-auto px-6 py-12 fade-in-up">
      <div className="rounded-2xl p-8 shadow-civic-md" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="text-center mb-7">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--brand)" }}
          >
            <CreditCard size={24} className="text-white" />
          </div>
          <h2 className="text-[20px] font-bold mb-1" style={{ color: "var(--text-1)" }}>Complete payment</h2>
          <p className="text-[32px] font-black" style={{ color: "var(--brand)" }}>{amountDisplay}</p>
          {venueLine && (
            <p className="text-[13px] mt-1 font-medium" style={{ color: "var(--text-1)" }}>{venueLine}</p>
          )}
          <p className="text-[13px] mt-1" style={{ color: "var(--text-2)" }}>Booking fee · Fully refundable on cancellation</p>
        </div>

        {/* Stripe Elements form */}
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm
            amountDisplay={amountDisplay}
            onSuccess={onSuccess}
            onBack={onBack}
          />
        </Elements>

        {/* Test mode helper — hidden automatically with a live key */}
        {IS_STRIPE_TEST_MODE && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-[12px] text-amber-800 font-semibold mb-1">Test mode — use these details:</p>
            <p className="text-[12px] text-amber-700 font-mono">
              Card: <strong>4242 4242 4242 4242</strong><br />
              Expiry: any future date &nbsp;·&nbsp; CVC: any 3 digits
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
