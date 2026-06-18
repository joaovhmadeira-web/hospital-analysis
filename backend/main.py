from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import (
    indicadores, leitos, fila, estoque, profissionais, alertas, relatorios, simulador
)

app = FastAPI(
    title="Hospital Indicadores — API",
    description="Sistema de acompanhamento de indicadores operacionais de hospital público.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(indicadores.router)
app.include_router(leitos.router)
app.include_router(fila.router)
app.include_router(estoque.router)
app.include_router(profissionais.router)
app.include_router(alertas.router)
app.include_router(relatorios.router)
app.include_router(simulador.router)


@app.get("/")
def root():
    return {"status": "online", "sistema": "Hospital Indicadores API v1.0"}
