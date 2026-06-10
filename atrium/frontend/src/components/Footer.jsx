import { useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

/* ─── Modal shell ───────────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  const { isDark } = useTheme();
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-5"
      style={{ backdropFilter: "blur(4px)", background: "rgba(15,23,42,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: isDark ? "#161B22" : "#ffffff",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-7 py-5 flex-shrink-0"
          style={{ borderBottom: `1px solid ${isDark ? "#30363D" : "#E5E7EB"}` }}
        >
          <h2 className="text-[18px] font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto px-7 py-6 flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── FAQ accordion ─────────────────────────────────────────────────── */
const FAQS = [
  {
    q: "Who can use HillingOne?",
    a: "HillingOne is available to all Hillingdon residents and registered community groups. You need to create a free account with a valid email address to make bookings.",
  },
  {
    q: "How do I make a booking?",
    a: "Describe what you need in plain English on the home screen — for example, 'a room for a yoga class for 15 people on Saturday morning'. Our AI will find the best matching spaces and show you available slots.",
  },
  {
    q: "How long does a booking hold last?",
    a: "When you select a slot, it is held for 5 minutes while you complete payment. If you do not confirm within this window, the slot is released back to other residents.",
  },
  {
    q: "What is the cancellation policy?",
    a: "You may cancel any confirmed booking at any time. If you cancel more than 24 hours before your booking, you receive a full refund. Cancellations within 24 hours of the start time receive a 50% refund.",
  },
  {
    q: "Can I reschedule my booking?",
    a: "Yes — open My Bookings, select the booking, and choose a new time. Rescheduling must be done more than 24 hours before the original start time. If the new slot costs more, you will be charged the difference. If it costs less, the difference is refunded automatically.",
  },
  {
    q: "How long does a refund take?",
    a: "Refunds are issued immediately to your original payment method and typically appear within 5–10 business days depending on your bank.",
  },
  {
    q: "Can I book the same space every week?",
    a: "Yes. When making a booking, enable the recurring option and choose how many weeks you'd like to repeat. Each recurrence is confirmed individually.",
  },
  {
    q: "What happens if the council needs to cancel my booking?",
    a: "Staff may only cancel for documented operational reasons (maintenance, emergency closures, etc.). You will be notified immediately with the full reason, offered an equivalent alternative venue, and receive a 20% goodwill credit towards your next booking.",
  },
  {
    q: "Is my payment information secure?",
    a: "Yes. All payments are processed by Stripe and are encrypted end-to-end. HillingOne never stores your card details.",
  },
  {
    q: "How do I contact support?",
    a: "Email us at hillingone@hillingdon.gov.uk or use the contact form below. We aim to respond within 2 working days.",
  },
];

function FAQItem({ faq }) {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();
  return (
    <div
      className="rounded-2xl mb-3 overflow-hidden"
      style={{ border: `1px solid ${isDark ? "#30363D" : "#E5E7EB"}` }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
      >
        <span className="text-[14px] font-semibold text-gray-900 pr-4">{faq.q}</span>
        {open
          ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
          : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
        }
      </button>
      {open && (
        <div
          className="px-5 pb-4"
          style={{ borderTop: `1px solid ${isDark ? "#30363D" : "#F3F4F6"}` }}
        >
          <p className="text-[13px] text-gray-600 leading-relaxed pt-3">{faq.a}</p>
        </div>
      )}
    </div>
  );
}

function FAQModal({ onClose }) {
  return (
    <Modal title="Frequently asked questions" onClose={onClose}>
      {FAQS.map((faq, i) => <FAQItem key={i} faq={faq} />)}
    </Modal>
  );
}

/* ─── Privacy Policy modal ──────────────────────────────────────────── */
function PrivacyModal({ onClose }) {
  return (
    <Modal title="Privacy Policy" onClose={onClose}>
      <div className="space-y-5 text-[13px] text-gray-600 leading-relaxed">
        <p className="text-[12px] text-gray-400">Last updated: June 2026</p>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Who we are</h3>
          <p>HillingOne is operated by the London Borough of Hillingdon ("the Council", "we", "us"). We are the data controller for personal information collected through this platform. Contact: <a href="mailto:hillingone@hillingdon.gov.uk" className="text-teal-600 font-medium">hillingone@hillingdon.gov.uk</a></p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">What information we collect</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Name and email address (account registration)</li>
            <li>Your Hillingdon ward (to improve search results)</li>
            <li>Booking details: venue, date, time, attendee count, purpose</li>
            <li>Payment records (processed by Stripe — we do not store card details)</li>
            <li>Search queries and AI interaction logs (anonymised after 90 days)</li>
          </ul>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">How we use your information</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>To manage and confirm your bookings</li>
            <li>To process payments and issue refunds</li>
            <li>To send booking confirmation, reminder, and cancellation notifications</li>
            <li>To improve the AI matching and search features (using anonymised data)</li>
            <li>To comply with our legal obligations as a local authority</li>
          </ul>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Legal basis</h3>
          <p>We process your data under Article 6(1)(b) GDPR (performance of a contract) for booking and payment processing, and Article 6(1)(e) (public task) for service improvement.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Data retention</h3>
          <p>Account and booking records are retained for 7 years in line with local authority financial obligations. You may request deletion of your account at any time; booking records required for financial audit will be anonymised rather than deleted.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Your rights</h3>
          <p>Under UK GDPR you have the right to access, correct, or request deletion of your data. To exercise these rights, email <a href="mailto:hillingone@hillingdon.gov.uk" className="text-teal-600 font-medium">hillingone@hillingdon.gov.uk</a>. You also have the right to lodge a complaint with the ICO at <span className="font-medium">ico.org.uk</span>.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Third parties</h3>
          <p>We share data with Stripe (payment processing), Google (AI search via Gemini API — queries only, no personal data), and Resend (transactional email delivery). All processors are bound by data processing agreements.</p>
        </section>
      </div>
    </Modal>
  );
}

/* ─── Terms of Use modal ────────────────────────────────────────────── */
function TermsModal({ onClose }) {
  return (
    <Modal title="Terms of Use" onClose={onClose}>
      <div className="space-y-5 text-[13px] text-gray-600 leading-relaxed">
        <p className="text-[12px] text-gray-400">Last updated: June 2026</p>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Eligibility</h3>
          <p>HillingOne is available to Hillingdon residents aged 18 and over, and to registered community organisations based in the borough.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Booking rules</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Spaces must be used for the stated purpose</li>
            <li>Maximum 3 active bookings per resident at any time</li>
            <li>The space must be vacated promptly at the end of the booked time</li>
            <li>Any damage to the facility must be reported immediately</li>
            <li>Bookings may not be transferred or sub-let to third parties</li>
          </ul>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Cancellation & refunds</h3>
          <p>Cancellations more than 24 hours before the booking start receive a full refund. Cancellations within 24 hours receive a 50% refund. No refund is issued for no-shows.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Council's right to cancel</h3>
          <p>The Council reserves the right to cancel bookings for documented operational reasons (e.g. emergency maintenance, public safety). In such cases, a full refund and a 20% goodwill credit will be issued.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Acceptable use</h3>
          <p>Spaces may not be used for unlawful activities, commercial profit, or events that conflict with the Council's equality and inclusion policies. Misuse may result in account suspension.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Limitation of liability</h3>
          <p>The Council is not liable for loss or damage to personal property at any booked venue. Users are responsible for ensuring their activities comply with all applicable laws and regulations.</p>
        </section>
      </div>
    </Modal>
  );
}

/* ─── Accessibility statement modal ────────────────────────────────── */
function AccessibilityModal({ onClose }) {
  return (
    <Modal title="Accessibility Statement" onClose={onClose}>
      <div className="space-y-5 text-[13px] text-gray-600 leading-relaxed">
        <p>The London Borough of Hillingdon is committed to making HillingOne accessible to everyone, in accordance with the Public Sector Bodies (Websites and Mobile Applications) Accessibility Regulations 2018.</p>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Current compliance</h3>
          <p>HillingOne is partially compliant with WCAG 2.1 level AA. We are actively working to achieve full compliance.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Known issues</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Some interactive map elements may not be fully keyboard-navigable</li>
            <li>Certain date picker interactions require further screen reader optimisation</li>
          </ul>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Reporting issues</h3>
          <p>If you experience any accessibility barriers, please email <a href="mailto:hillingone@hillingdon.gov.uk" className="text-teal-600 font-medium">hillingone@hillingdon.gov.uk</a>. We aim to respond within 5 working days.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Enforcement</h3>
          <p>If you are not satisfied with our response, contact the Equality Advisory and Support Service (EASS) at <span className="font-medium">equalityadvisoryservice.com</span>.</p>
        </section>
      </div>
    </Modal>
  );
}

/* ─── Cookie Policy modal ───────────────────────────────────────────── */
function CookieModal({ onClose }) {
  return (
    <Modal title="Cookie Policy" onClose={onClose}>
      <div className="space-y-5 text-[13px] text-gray-600 leading-relaxed">
        <p className="text-[12px] text-gray-400">Last updated: June 2026</p>

        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
          <span className="text-emerald-600 text-[18px] flex-shrink-0">✓</span>
          <p className="text-[13px] text-emerald-800">
            <strong>HillingOne uses essential cookies only.</strong> We do not use any advertising,
            analytics, or tracking cookies. No third-party trackers are loaded on this site.
          </p>
        </div>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-3">What are cookies?</h3>
          <p>Cookies are small text files stored on your device by your browser. They help websites remember your preferences and keep you signed in between visits.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-3">Cookies we use</h3>
          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-bold text-gray-900">Authentication (localStorage)</span>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">Essential</span>
              </div>
              <p className="text-[12px] text-gray-500">Keeps you signed in during your session. Stored in browser localStorage, not a cookie. Expires after 30 days or when you sign out.</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-bold text-gray-900">Theme preference (localStorage)</span>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">Essential</span>
              </div>
              <p className="text-[12px] text-gray-500">Remembers whether you prefer light or dark mode. Stored locally on your device and never sent to our servers.</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-bold text-gray-900">Stripe (payment security)</span>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">Essential</span>
              </div>
              <p className="text-[12px] text-gray-500">Stripe sets cookies solely for fraud prevention and payment security when you make a booking. These are strictly necessary to process payments and are governed by <a href="https://stripe.com/gb/privacy" target="_blank" rel="noopener noreferrer" className="text-teal-600 font-medium">Stripe's Privacy Policy</a>.</p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Cookies we do NOT use</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-500">
            <li>Google Analytics or any usage tracking</li>
            <li>Advertising or retargeting cookies</li>
            <li>Social media tracking pixels</li>
            <li>Third-party personalisation cookies</li>
          </ul>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Managing cookies</h3>
          <p>You can clear cookies and localStorage at any time through your browser settings. Note that clearing your authentication token will sign you out. Essential cookies cannot be disabled without breaking core site functionality.</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-gray-900 mb-2">Contact</h3>
          <p>For questions about this policy email <a href="mailto:hillingone@hillingdon.gov.uk" className="text-teal-600 font-medium">hillingone@hillingdon.gov.uk</a>.</p>
        </section>
      </div>
    </Modal>
  );
}

/* ─── Footer ────────────────────────────────────────────────────────── */
export default function Footer({ cookieModalOpen = false, onCookieModalClose = () => {} }) {
  const { isDark } = useTheme();
  const [modal, setModal] = useState(null);

  // Controlled cookie modal from banner
  const showCookieModal = cookieModalOpen || modal === "cookies";
  const closeCookieModal = () => { onCookieModalClose(); setModal(null); };

  const linkCls = "text-[13px] transition cursor-pointer hover:text-teal-600";
  const headingCls = "text-[11px] font-bold uppercase tracking-widest mb-3";

  const borderColor = isDark ? "#21262D" : "#E5E7EB";
  const textMuted   = isDark ? "#8B949E" : "#6B7280";
  const textHeading = isDark ? "#6E7681" : "#9CA3AF";

  return (
    <>
      <footer
        style={{
          background: isDark ? "#0E1117" : "#F9FAFB",
          borderTop: `1px solid ${borderColor}`,
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0F766E, #0D9488)" }}>
                  <span className="text-white text-[13px] font-black">H</span>
                </div>
                <span className="text-[16px] font-black text-gray-900">HillingOne</span>
              </div>
              <p className="text-[13px] leading-relaxed mb-4" style={{ color: textMuted }}>
                The smart community booking platform for the London Borough of Hillingdon.
              </p>
              <p className="text-[12px]" style={{ color: textHeading }}>
                © {new Date().getFullYear()} London Borough of Hillingdon
              </p>
            </div>

            {/* Help */}
            <div>
              <p className={headingCls} style={{ color: textHeading }}>Help</p>
              <ul className="space-y-2.5">
                <li>
                  <span className={linkCls} style={{ color: textMuted }} onClick={() => setModal("faq")}>
                    Frequently asked questions
                  </span>
                </li>
                <li>
                  <a href="mailto:hillingone@hillingdon.gov.uk" className={linkCls} style={{ color: textMuted }}>
                    Contact support
                  </a>
                </li>
                <li>
                  <a href="mailto:hillingone@hillingdon.gov.uk?subject=Issue%20report" className={linkCls} style={{ color: textMuted }}>
                    Report an issue
                  </a>
                </li>
                <li>
                  <span className={linkCls} style={{ color: textMuted }} onClick={() => setModal("accessibility")}>
                    Accessibility
                  </span>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className={headingCls} style={{ color: textHeading }}>Legal</p>
              <ul className="space-y-2.5">
                <li>
                  <span className={linkCls} style={{ color: textMuted }} onClick={() => setModal("privacy")}>
                    Privacy policy
                  </span>
                </li>
                <li>
                  <span className={linkCls} style={{ color: textMuted }} onClick={() => setModal("terms")}>
                    Terms of use
                  </span>
                </li>
                <li>
                  <span className={linkCls} style={{ color: textMuted }} onClick={() => setModal("cookies")}>
                    Cookie policy
                  </span>
                </li>
                <li>
                  <span className={linkCls} style={{ color: textMuted }}>
                    Modern slavery statement
                  </span>
                </li>
              </ul>
            </div>

            {/* Council */}
            <div>
              <p className={headingCls} style={{ color: textHeading }}>Hillingdon Council</p>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="https://www.hillingdon.gov.uk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${linkCls} inline-flex items-center gap-1`}
                    style={{ color: textMuted }}
                  >
                    hillingdon.gov.uk <ExternalLink size={11} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.hillingdon.gov.uk/leisure"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${linkCls} inline-flex items-center gap-1`}
                    style={{ color: textMuted }}
                  >
                    Leisure &amp; culture <ExternalLink size={11} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.hillingdon.gov.uk/community"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${linkCls} inline-flex items-center gap-1`}
                    style={{ color: textMuted }}
                  >
                    Community services <ExternalLink size={11} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.hillingdon.gov.uk/wards"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${linkCls} inline-flex items-center gap-1`}
                    style={{ color: textMuted }}
                  >
                    Find your ward <ExternalLink size={11} />
                  </a>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom strip */}
          <div
            className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
            style={{ borderTop: `1px solid ${borderColor}` }}
          >
            <p className="text-[12px]" style={{ color: textHeading }}>
              Built for Hillingdon residents · Powered by AI
            </p>
            <div className="flex items-center gap-4">
              <span
                className="text-[12px] cursor-pointer hover:text-teal-600 transition"
                style={{ color: textHeading }}
                onClick={() => setModal("privacy")}
              >
                Privacy
              </span>
              <span
                className="text-[12px] cursor-pointer hover:text-teal-600 transition"
                style={{ color: textHeading }}
                onClick={() => setModal("terms")}
              >
                Terms
              </span>
              <span
                className="text-[12px] cursor-pointer hover:text-teal-600 transition"
                style={{ color: textHeading }}
                onClick={() => setModal("accessibility")}
              >
                Accessibility
              </span>
            </div>
          </div>
        </div>
      </footer>

      {modal === "faq"           && <FAQModal           onClose={() => setModal(null)} />}
      {modal === "privacy"       && <PrivacyModal       onClose={() => setModal(null)} />}
      {modal === "terms"         && <TermsModal         onClose={() => setModal(null)} />}
      {modal === "accessibility" && <AccessibilityModal onClose={() => setModal(null)} />}
      {showCookieModal           && <CookieModal        onClose={closeCookieModal} />}
    </>
  );
}
