"""Add DB-level constraints and indexes to prevent double-bookings and enforce data integrity.

Revision ID: 0005_constraints
Revises: 0004_assets_pricing_expansion
Create Date: 2026-06-07
"""
from alembic import op

revision = "0005_constraints"
down_revision = "0004_assets_pricing_expansion"
branch_labels = None
depends_on = None


def upgrade():
    # Unique partial index: no two bookings can share the same asset+slot in active states.
    # This is the DB-level guard against the application-level race condition.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_slot
        ON bookings (asset_id, start_time, end_time)
        WHERE state IN ('held', 'confirmed', 'swap_pending');
    """)

    # Performance indexes for audit log and search log date queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_audit_log_created
        ON audit_log (created_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_search_log_created
        ON search_log (created_at DESC);
    """)

    # CHECK constraints for data integrity
    op.execute("""
        ALTER TABLE bookings
            ADD CONSTRAINT IF NOT EXISTS chk_booking_times
            CHECK (end_time > start_time);
    """)
    op.execute("""
        ALTER TABLE bookings
            ADD CONSTRAINT IF NOT EXISTS chk_booking_state
            CHECK (state IN ('open','held','confirmed','swap_pending','cancelled','completed'));
    """)
    op.execute("""
        ALTER TABLE users
            ADD CONSTRAINT IF NOT EXISTS chk_user_role
            CHECK (role IN ('resident','staff','councillor','admin'));
    """)
    op.execute("""
        ALTER TABLE assets
            ADD CONSTRAINT IF NOT EXISTS chk_capacity
            CHECK (capacity > 0);
    """)
    op.execute("""
        ALTER TABLE assets
            ADD CONSTRAINT IF NOT EXISTS chk_rate
            CHECK (hourly_rate >= 0);
    """)
    op.execute("""
        ALTER TABLE payments
            ADD CONSTRAINT IF NOT EXISTS chk_amount
            CHECK (amount_pence > 0);
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_booking_slot;")
    op.execute("DROP INDEX IF EXISTS idx_audit_log_created;")
    op.execute("DROP INDEX IF EXISTS idx_search_log_created;")
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_booking_times;")
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_booking_state;")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_role;")
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS chk_capacity;")
    op.execute("ALTER TABLE assets DROP CONSTRAINT IF EXISTS chk_rate;")
    op.execute("ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_amount;")
