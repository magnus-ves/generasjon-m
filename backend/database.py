import os
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy import MetaData, create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Lokalt: SQLite-fil. I produksjon (Vercel): kobler til Postgres, siden
# Vercels serverless-funksjoner ikke har vedvarende disk for en SQLite-fil.
# Når du kobler "Storage" (Postgres) til et Vercel-prosjekt, settes en av
# disse variablene automatisk - vi sjekker dem i prioritert rekkefølge.
SQLALCHEMY_DATABASE_URL = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("POSTGRES_URL")
    or os.environ.get("POSTGRES_PRISMA_URL")
    or os.environ.get("POSTGRES_URL_NON_POOLING")
    or ""
)

# Uten database på Vercel: bruk SQLite i /tmp (den eneste skrivbare mappen),
# så appen virker. Data der er midlertidige og kan forsvinne ved ny oppstart.
MIDLERTIDIG_DATABASE = not SQLALCHEMY_DATABASE_URL and bool(os.environ.get("VERCEL"))
if not SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = (
        "sqlite:////tmp/generasjon_m.db" if MIDLERTIDIG_DATABASE else "sqlite:///./generasjon_m.db"
    )

# SQLAlchemy krever "postgresql://", mens Vercel/Neon ofte gir "postgres://"
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace(
        "postgres://", "postgresql://", 1
    )

# Administrerte Postgres-tjenester (Neon, Vercel Storage, Nile o.l.) krever
# som regel SSL. Legg til sslmode=require hvis det ikke allerede er angitt.
# Noen integrasjoner (f.eks. Supabase-tilkoblingen Vercel setter opp) legger
# også ved ukjente spørringsparametre (som "supa=base-pooler.x") som får
# psycopg2 til å feile - behold derfor bare kjente libpq-parametre.
_VALID_LIBPQ_PARAMS = {
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "connect_timeout",
    "application_name",
    "options",
    "target_session_attrs",
    "pgbouncer",
}

if SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
    parts = urlsplit(SQLALCHEMY_DATABASE_URL)
    query = {
        k: v for k, v in parse_qsl(parts.query) if k in _VALID_LIBPQ_PARAMS
    }
    query.setdefault("sslmode", "require")
    SQLALCHEMY_DATABASE_URL = urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )

connect_args = (
    {"check_same_thread": False}
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args, pool_pre_ping=True
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# I Postgres ligger appens tabeller i et eget skjema, så de ikke kolliderer
# med andre tabeller i samme database (f.eks. en delt Supabase-database).
SCHEMA = (
    os.environ.get("DB_SCHEMA", "generasjon_m")
    if SQLALCHEMY_DATABASE_URL.startswith("postgresql")
    else None
)

SCHEMA_FEIL = None
if SCHEMA:
    try:
        with engine.begin() as _con:
            _con.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))
    except Exception as e:  # vises via /api/health i stedet for å krasje appen
        SCHEMA_FEIL = f"{type(e).__name__}: {e}"

Base = declarative_base(metadata=MetaData(schema=SCHEMA))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
