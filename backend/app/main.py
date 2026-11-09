"""FastAPI 应用入口（需求 6.2）

启动方式（在 backend 目录下）：
    uvicorn app.main:app --reload --port 8000
"""
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config
from .routers import chat, health
from .services.llm import UpstreamError

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="技术文档问答助手 API", version="0.1.0")

# CORS：仅允许配置的前端来源
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(chat.router)


@app.exception_handler(UpstreamError)
async def upstream_error_handler(request: Request, exc: UpstreamError) -> JSONResponse:
    """上游错误以结构化 JSON 返回（非流式），前端据此区分错误类型（需求 7.1）"""
    return JSONResponse(
        status_code=502,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        return JSONResponse(status_code=exc.status_code, content={"error": detail})
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "INVALID_REQUEST", "message": str(detail)}},
    )
