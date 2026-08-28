from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import engine, Base
from app.routes import anc, partograph, delivery, ultrasound, fluid, dashboard, labour

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="Maternity Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(anc.router)
app.include_router(partograph.router)
app.include_router(delivery.router)
app.include_router(ultrasound.router)
app.include_router(fluid.router)
app.include_router(dashboard.router)
app.include_router(labour.router)

@app.get("/health")
async def health():
    return {"status": "OK", "service": "maternity-service", "version": "1.0.0"}
