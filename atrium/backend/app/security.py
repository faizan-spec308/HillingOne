"""In-process security helpers: account lockout and token blacklist.

Both use in-memory state — fast, no DB overhead, and acceptable because:
- Lockout: 15-min window resets on restart, which is fine (attacker must retry).
- Blacklist: tokens expire in 30 days; on restart the blacklist is empty but
  so are active sessions (users must log in again), which is safe.
"""
import time
from collections import defaultdict

# ── Account lockout ────────────────────────────────────────────────────────
_failed: dict[str, list[float]] = defaultdict(list)
LOCKOUT_LIMIT  = 10   # failed attempts before lockout
LOCKOUT_WINDOW = 900  # seconds (15 minutes)


def record_failed_login(email: str) -> None:
    now = time.time()
    _failed[email] = [t for t in _failed[email] if now - t < LOCKOUT_WINDOW]
    _failed[email].append(now)


def is_locked_out(email: str) -> bool:
    now = time.time()
    _failed[email] = [t for t in _failed[email] if now - t < LOCKOUT_WINDOW]
    return len(_failed[email]) >= LOCKOUT_LIMIT


def clear_failed_logins(email: str) -> None:
    _failed.pop(email, None)


def failed_attempt_count(email: str) -> int:
    now = time.time()
    _failed[email] = [t for t in _failed[email] if now - t < LOCKOUT_WINDOW]
    return len(_failed[email])


# ── Token blacklist ────────────────────────────────────────────────────────
# Maps token string → expiry timestamp so we can evict expired entries.
_blacklist: dict[str, float] = {}


def blacklist_token(token: str, exp: float) -> None:
    _evict_expired()
    _blacklist[token] = exp


def is_blacklisted(token: str) -> bool:
    _evict_expired()
    return token in _blacklist


def _evict_expired() -> None:
    now = time.time()
    expired = [t for t, exp in _blacklist.items() if exp < now]
    for t in expired:
        del _blacklist[t]
