import { loadStripe } from "@stripe/stripe-js";

// Publishable key is intentionally public — safe to embed in frontend code
export const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51Tdu5YQwQUDdwUxjCQ5M2ucTRi7kp9yaCkfmUvkR9rwJNKbcpOEBhZVEYD5lcOcw7Gllzgj4ky0pPS1UKsHZjAPt00KXyYf3YG";

// Drives the "test card" helper panels — they disappear automatically when a live key ships
export const IS_STRIPE_TEST_MODE = STRIPE_PUBLISHABLE_KEY.startsWith("pk_test_");

export const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
