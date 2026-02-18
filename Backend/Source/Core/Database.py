from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from Backend.Source.Core.Config.Config import settings
import logging

logger = logging.getLogger(__name__)

# Use DATABASE_URL from config (PostgreSQL in production, can be SQLite for local dev)
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# Engine configuration — tuned per database type
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_args = {"connect_args": {"check_same_thread": False}}
else:
    engine_args = {
        "pool_size": 15,
        "max_overflow": 25,
        "pool_timeout": 30,
        "pool_recycle": 1800,
        "pool_pre_ping": True,
    }

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def run_migrations():
    """Add new columns if they don't exist. Idempotent — safe to run on every startup."""
    is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    with engine.connect() as conn:
        if is_sqlite:
            # SQLite: check pragma table_info for existing columns
            result = conn.execute(text("PRAGMA table_info(users)"))
            existing = {row[1] for row in result.fetchall()}
            if "cost_used" not in existing:
                conn.execute(text("ALTER TABLE users ADD COLUMN cost_used FLOAT DEFAULT 0.0 NOT NULL"))
                logger.info("Migration: added cost_used column to users table")
            if "cost_limit" not in existing:
                conn.execute(text("ALTER TABLE users ADD COLUMN cost_limit FLOAT DEFAULT 5.0 NOT NULL"))
                logger.info("Migration: added cost_limit column to users table")
            if "total_tokens_lifetime" not in existing:
                conn.execute(text("ALTER TABLE users ADD COLUMN total_tokens_lifetime BIGINT DEFAULT 0 NOT NULL"))
                logger.info("Migration: added total_tokens_lifetime column to users table")
            if "total_cost_lifetime" not in existing:
                conn.execute(text("ALTER TABLE users ADD COLUMN total_cost_lifetime FLOAT DEFAULT 0.0 NOT NULL"))
                logger.info("Migration: added total_cost_lifetime column to users table")
        else:
            # PostgreSQL: use ADD COLUMN IF NOT EXISTS
            try:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS cost_used FLOAT DEFAULT 0.0 NOT NULL"
                ))
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS cost_limit FLOAT DEFAULT 5.0 NOT NULL"
                ))
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS total_tokens_lifetime BIGINT DEFAULT 0 NOT NULL"
                ))
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS total_cost_lifetime FLOAT DEFAULT 0.0 NOT NULL"
                ))
                logger.info("Migration: ensured cost_used, cost_limit, total_tokens_lifetime, total_cost_lifetime columns exist")
            except Exception as e:
                logger.warning(f"Migration columns may already exist: {e}")

        # Backfill: set lifetime counters from current usage for existing users
        conn.execute(text(
            "UPDATE users SET total_tokens_lifetime = tokens_used WHERE total_tokens_lifetime = 0 AND tokens_used > 0"
        ))
        conn.execute(text(
            "UPDATE users SET total_cost_lifetime = cost_used WHERE total_cost_lifetime = 0 AND cost_used > 0"
        ))

        # --- Tenants: add is_system column ---
        if is_sqlite:
            result = conn.execute(text("PRAGMA table_info(tenants)"))
            existing_tenant_cols = {row[1] for row in result.fetchall()}
            if "is_system" not in existing_tenant_cols:
                conn.execute(text("ALTER TABLE tenants ADD COLUMN is_system BOOLEAN DEFAULT 0 NOT NULL"))
                logger.info("Migration: added is_system column to tenants table")
        else:
            conn.execute(text(
                "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE NOT NULL"
            ))

        # Backfill: mark the bootstrap "Qiyas" tenant as a system tenant
        conn.execute(text("UPDATE tenants SET is_system = TRUE WHERE slug = 'qiyas' AND is_system = FALSE"))

        # --- Tenants: add name_ar column ---
        if is_sqlite:
            result = conn.execute(text("PRAGMA table_info(tenants)"))
            existing_tenant_cols2 = {row[1] for row in result.fetchall()}
            if "name_ar" not in existing_tenant_cols2:
                conn.execute(text("ALTER TABLE tenants ADD COLUMN name_ar VARCHAR"))
                logger.info("Migration: added name_ar column to tenants table")
        else:
            conn.execute(text(
                "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS name_ar VARCHAR"
            ))

        # Backfill: set Arabic name for bootstrap Qiyas tenant
        conn.execute(text("UPDATE tenants SET name_ar = 'قياس' WHERE slug = 'qiyas' AND name_ar IS NULL"))

        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
