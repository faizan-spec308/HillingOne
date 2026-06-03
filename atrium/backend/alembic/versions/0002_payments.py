"""Add payments table

Revision ID: 0002_payments
Revises: 0001_initial
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_payments"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("stripe_payment_intent_id", sa.String(255), unique=True, nullable=False),
        sa.Column("amount_pence", sa.Integer, nullable=False),
        sa.Column("currency", sa.String(10), server_default="gbp"),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("stripe_charge_id", sa.String(255), nullable=True),
        sa.Column("refund_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_payments_booking", "payments", ["booking_id"])
    op.create_index("idx_payments_intent", "payments", ["stripe_payment_intent_id"])


def downgrade() -> None:
    op.drop_index("idx_payments_intent", table_name="payments")
    op.drop_index("idx_payments_booking", table_name="payments")
    op.drop_table("payments")
