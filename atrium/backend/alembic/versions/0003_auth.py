"""Add password_hash to users

Revision ID: 0003_auth
Revises: 0002_payments
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_auth"
down_revision = "0002_payments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")
