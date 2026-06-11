"""Add password reset token columns to users table.

Revision ID: 0006_password_reset
Revises: 0005_constraints
Create Date: 2026-06-10
"""
from alembic import op

revision = "0006_password_reset"
down_revision = "0005_constraints"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS reset_token VARCHAR(128),
        ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
    """)


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS reset_token;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS reset_token_expires;")
