import ssl
from urllib.parse import urlparse, parse_qs
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.config import settings

# Parse the DATABASE_URL and extract SSL parameters for asyncpg
database_url = settings.DATABASE_URL
connect_args = {}

if database_url.startswith("postgresql://"):
    # Parse URL to extract SSL parameters
    parsed = urlparse(database_url)
    query_params = parse_qs(parsed.query)
    
    # Handle SSL parameters for asyncpg
    if "sslmode" in query_params:
        sslmode = query_params["sslmode"][0]
        if sslmode == "require":
            # Create SSL context for asyncpg
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            connect_args["ssl"] = ssl_context
        elif sslmode == "disable":
            connect_args["ssl"] = False
        # Remove sslmode from URL for asyncpg
        query_params.pop("sslmode", None)
    
    # Handle channel_binding if present
    if "channel_binding" in query_params:
        query_params.pop("channel_binding", None)
    
    # Rebuild URL without SSL params
    new_query = "&".join(f"{k}={v[0]}" for k, v in query_params.items() if v)
    new_parsed = parsed._replace(query=new_query)
    database_url = new_parsed.geturl()
    
    # Convert to asyncpg dialect
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables. Call on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)