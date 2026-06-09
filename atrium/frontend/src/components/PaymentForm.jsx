import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Lock, CreditCard, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// Publishable key is intentionally public — safe to embed in frontend code
const stripePromise = loadStripe(
  "pk_test_51Tdu5YQwQUDdwUxjCQ5M2ucTRi7kp9yaCkfmUvkR9rwJNKbcpOEBhZVEYD5lcOcw7Gllzgj4ky0pPS1UKsHZjAPt00KXyYf3YG"
);

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

      <div className="flex items-center justify-center gap-1.5 text-[12px] text-gray-400">
        <Lock size={11} />
        Secured by Stripe · Payments encrypted end-to-end
      </div>
    </form>
  );
}

export default function PaymentForm({ clientSecret, amountDisplay, onSuccess, onBack }) {
  const { isDark } = useTheme();

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
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-civic-md">

        {/* Header */}
        <div className="text-center mb-7">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #0F766E, #0D9488)" }}
          >
            <CreditCard size={24} className="text-white" />
          </div>
          <h2 className="text-[20px] font-bold text-gray-900 mb-1">Complete payment</h2>
          <p className="text-[32px] font-black" style={{ color: "#0D9488" }}>{amountDisplay}</p>
          <p className="text-[13px] text-gray-500 mt-1">Booking fee · Fully refundable on cancellation</p>
        </div>

        {/* Stripe Elements form */}
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm
            amountDisplay={amountDisplay}
            onSuccess={onSuccess}
            onBack={onBack}
          />
        </Elements>

        {/* Test mode helper */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-[12px] text-amber-800 font-semibold mb-1">Test mode — use these details:</p>
          <p className="text-[12px] text-amber-700 font-mono">
            Card: <strong>4242 4242 4242 4242</strong><br />
            Expiry: any future date &nbsp;·&nbsp; CVC: any 3 digits
          </p>
        </div>
      </div>
    </div>
  );
}
