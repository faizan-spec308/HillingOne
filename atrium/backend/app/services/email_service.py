"""Transactional email via Resend."""
import asyncio
import html as _html
import logging
from datetime import datetime

logger = logging.getLogger("hillingone.email")


def _e(v) -> str:
    """HTML-escape any user-supplied value before embedding in email templates."""
    return _html.escape(str(v) if v is not None else "")

FROM_ADDRESS = "onboarding@resend.dev"
BRAND_COLOR  = "#0D9488"


def _fmt_dt(dt: datetime) -> str:
    # Portable day-without-leading-zero (%-d is glibc-only and fails on Windows).
    return f"{dt.day} {dt.strftime('%B %Y')}" if hasattr(dt, "strftime") else str(dt)


def _fmt_time(dt: datetime) -> str:
    return dt.strftime("%H:%M") if hasattr(dt, "strftime") else str(dt)


def _base(title: str, body_html: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:{BRAND_COLOR};padding:28px 40px;">
              <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                HillingOne
              </span>
              <span style="font-size:13px;color:rgba(255,255,255,0.7);margin-left:8px;">
                by Hillingdon Council
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              {body_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                HillingOne · London Borough of Hillingdon<br />
                This is an automated message — please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _detail_row(label: str, value: str) -> str:
    return f"""
<tr>
  <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
    <span style="font-size:12px;font-weight:600;color:#9CA3AF;text-transform:uppercase;
                 letter-spacing:0.05em;">{label}</span><br />
    <span style="font-size:15px;font-weight:600;color:#111827;">{value}</span>
  </td>
</tr>
"""


def booking_confirmed_html(user_name: str, booking: object, asset: object) -> str:
    start = booking.start_time
    end   = booking.end_time
    body  = f"""
<h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#111827;">
  Booking confirmed ✓
</h1>
<p style="margin:0 0 28px;font-size:15px;color:#6B7280;">
  Hi {_e(user_name)}, your space is reserved and protected.
</p>

<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#F9FAFB;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
  <tr>
    <td style="padding:0 0 16px;">
      <span style="font-size:13px;font-weight:700;color:#374151;">Booking reference</span><br />
      <span style="font-size:22px;font-weight:900;font-family:monospace;color:{BRAND_COLOR};">
        {_e(booking.reference)}
      </span>
    </td>
  </tr>
  {_detail_row("Venue", _e(getattr(asset, "name", "—")))}
  {_detail_row("Date", _fmt_dt(start))}
  {_detail_row("Time", f"{_fmt_time(start)} – {_fmt_time(end)}")}
  {_detail_row("Location", f"{_e(getattr(asset, 'ward', ''))}, Hillingdon")}
</table>

<p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
  You can cancel this booking at any time from <strong>My Bookings</strong> in the app.
  A full refund is issued automatically if you cancel more than 24 hours before your booking.
</p>
"""
    return _base("Booking confirmed — HillingOne", body)


def booking_cancelled_html(user_name: str, booking: object, asset: object,
                           refund_amount: str | None = None,
                           late_cancel: bool = False) -> str:
    refund_block = ""
    if refund_amount:
        if late_cancel:
            refund_block = f"""
<div style="margin-top:20px;padding:16px 20px;background:#FFFBEB;border-radius:10px;
            border:1px solid #FCD34D;">
  <span style="font-size:14px;font-weight:600;color:#92400E;">
    ⚠ {refund_amount} partial refund issued — 50% applies when cancelling within 24 hours of the booking.
  </span>
</div>
"""
        else:
            refund_block = f"""
<div style="margin-top:20px;padding:16px 20px;background:#ECFDF5;border-radius:10px;
            border:1px solid #A7F3D0;">
  <span style="font-size:14px;font-weight:600;color:#065F46;">
    ✓ {refund_amount} full refund has been issued to your original payment method.
  </span>
</div>
"""
    body = f"""
<h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#111827;">
  Booking cancelled
</h1>
<p style="margin:0 0 28px;font-size:15px;color:#6B7280;">
  Hi {_e(user_name)}, your booking has been cancelled.
</p>

<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#F9FAFB;border-radius:12px;padding:20px 24px;margin-bottom:20px;">
  {_detail_row("Venue", _e(getattr(asset, "name", "—")))}
  {_detail_row("Reference", _e(booking.reference))}
</table>

{refund_block}

<p style="margin-top:20px;font-size:13px;color:#6B7280;line-height:1.6;">
  You can make a new booking any time at <a href="https://hilling-one.vercel.app"
  style="color:{BRAND_COLOR};font-weight:600;">hilling-one.vercel.app</a>.
</p>
"""
    return _base("Booking cancelled — HillingOne", body)


def booking_rescheduled_html(user_name: str, booking: object, asset: object,
                              refund_amount: str | None = None) -> str:
    start = booking.start_time
    end   = booking.end_time
    refund_block = ""
    if refund_amount:
        refund_block = f"""
<div style="margin-top:20px;padding:16px 20px;background:#ECFDF5;border-radius:10px;
            border:1px solid #A7F3D0;">
  <span style="font-size:14px;font-weight:600;color:#065F46;">
    ✓ {refund_amount} partial refund has been issued for the shorter duration.
  </span>
</div>
"""
    body = f"""
<h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#111827;">
  Booking rescheduled
</h1>
<p style="margin:0 0 28px;font-size:15px;color:#6B7280;">
  Hi {_e(user_name)}, your booking has been moved to a new time.
</p>

<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#F9FAFB;border-radius:12px;padding:20px 24px;margin-bottom:20px;">
  {_detail_row("Venue", _e(getattr(asset, "name", "—")))}
  {_detail_row("Reference", _e(booking.reference))}
  {_detail_row("New date", _fmt_dt(start))}
  {_detail_row("New time", f"{_fmt_time(start)} – {_fmt_time(end)}")}
</table>

{refund_block}
"""
    return _base("Booking rescheduled — HillingOne", body)


def booking_swap_proposed_html(user_name: str, booking: object, original_asset: object,
                               alt_asset: object, credit_percent: int, swap_message: str) -> str:
    start = booking.start_time
    end   = booking.end_time
    body = f"""
<h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#111827;">
  A proposed change to your booking
</h1>
<p style="margin:0 0 28px;font-size:15px;color:#6B7280;">
  Hi {_e(user_name)}, an unexpected priority need has come up for your booking at
  {_e(getattr(original_asset, "name", "your venue"))}. We would like to ask whether you would
  consider moving — but the choice is entirely yours.
</p>

<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#F9FAFB;border-radius:12px;padding:20px 24px;margin-bottom:20px;">
  {_detail_row("Your booking", _e(getattr(original_asset, "name", "—")))}
  {_detail_row("Reference", _e(booking.reference))}
  {_detail_row("Proposed venue", _e(getattr(alt_asset, "name", "—")))}
  {_detail_row("Time (unchanged)", f"{_fmt_dt(start)}, {_fmt_time(start)} – {_fmt_time(end)}")}
  {_detail_row("Goodwill credit", f"{credit_percent}% off your next booking")}
</table>

<div style="margin-top:4px;padding:16px 20px;background:#ECFDF5;border-radius:10px;border:1px solid #A7F3D0;">
  <span style="font-size:14px;font-weight:600;color:#065F46;">
    You decide. Open <strong>My Bookings</strong> to accept the move or keep your booking.
    If you do nothing, your original booking stays exactly as it is.
  </span>
</div>

<p style="margin-top:20px;font-size:13px;color:#6B7280;line-height:1.6;font-style:italic;">
  {_e(swap_message)}
</p>
"""
    return _base("A proposed change to your booking — HillingOne", body)


def password_reset_html(user_name: str, reset_url: str) -> str:
    body = f"""
<h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#111827;">
  Reset your password
</h1>
<p style="margin:0 0 28px;font-size:15px;color:#6B7280;">
  Hi {_e(user_name)}, we received a request to reset your HillingOne password.
</p>

<div style="text-align:center;margin:32px 0;">
  <a href="{_e(reset_url)}"
     style="display:inline-block;background:{BRAND_COLOR};color:#ffffff;
            font-size:15px;font-weight:700;padding:14px 36px;border-radius:14px;
            text-decoration:none;letter-spacing:-0.1px;">
    Reset password
  </a>
</div>

<p style="font-size:13px;color:#6B7280;line-height:1.6;">
  This link expires in <strong>30 minutes</strong>. If you did not request a password reset,
  you can safely ignore this email — your password will not change.
</p>

<div style="margin-top:24px;padding:16px 20px;background:#F9FAFB;border-radius:10px;
            border:1px solid #E5E7EB;">
  <p style="margin:0;font-size:12px;color:#9CA3AF;">
    If the button above does not work, copy and paste this link into your browser:<br />
    <span style="color:{BRAND_COLOR};word-break:break-all;">{_e(reset_url)}</span>
  </p>
</div>
"""
    return _base("Reset your password — HillingOne", body)


async def send_email(to: str, subject: str, html: str) -> None:
    """Fire-and-forget email send. Logs errors but never raises."""
    from app.config import settings
    if not settings.resend_api_key:
        logger.debug("resend_api_key not set — skipping email to %s", to)
        return
    try:
        import resend as _resend
        _resend.api_key = settings.resend_api_key
        await asyncio.to_thread(
            _resend.Emails.send,
            {
                "from": FROM_ADDRESS,
                "to": [to],
                "subject": subject,
                "html": html,
            },
        )
        logger.info("email_sent to=%s subject=%s", to, subject)
    except Exception as exc:
        logger.error("email_error to=%s err=%s", to, str(exc))
