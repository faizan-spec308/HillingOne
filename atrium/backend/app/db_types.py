"""Portable column types.

These let the same models run on PostgreSQL in production AND on SQLite in tests,
with **zero change to Postgres behaviour**: on PostgreSQL they delegate to the
native `UUID` / `JSONB` types exactly as before; only under other dialects (SQLite)
do they fall back to portable equivalents.
"""
import uuid

from sqlalchemy.types import TypeDecorator, CHAR, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB as PG_JSONB


class GUID(TypeDecorator):
    """UUID that is native `UUID` on PostgreSQL and CHAR(36) elsewhere."""
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


class JSONType(TypeDecorator):
    """JSON that is `JSONB` on PostgreSQL and generic JSON elsewhere."""
    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_JSONB())
        return dialect.type_descriptor(JSON())
