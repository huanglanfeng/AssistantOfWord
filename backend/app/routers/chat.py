"""对话流式接口（需求 4.2 / 7.1）"""
import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from ..services.llm import UpstreamError, stream_chat

router = APIRouter()
logger = logging.getLogger(__name__)

# 请求体基本校验（需求 9.1）
MAX_MESSAGES = 40
MAX_CONTENT_LENGTH = 8000

VALID_ROLES = {"user", "assistant", "system"}


class ChatMessage(BaseModel):
    role: str = Field(..., description="消息角色")
    content: str = Field(..., description="消息内容")

    @field_validator("role")
    @classmethod
    def check_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"role 必须是 {VALID_ROLES} 之一")
        return v

    @field_validator("content")
    @classmethod
    def check_content(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content 不能为空")
        if len(v) > MAX_CONTENT_LENGTH:
            raise ValueError(f"单条消息不能超过 {MAX_CONTENT_LENGTH} 字符")
        return v


class ChatRequestBody(BaseModel):
    messages: list[ChatMessage]


@router.post("/api/chat")
async def chat(body: ChatRequestBody, request: Request) -> Any:
    if not body.messages:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_REQUEST", "message": "messages 不能为空"},
        )
    if len(body.messages) > MAX_MESSAGES:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_REQUEST", "message": f"上下文最多 {MAX_MESSAGES} 条消息"},
        )

    async def event_generator():
        logger.info("chat 请求开始，消息数=%d", len(body.messages))
        try:
            async for line in stream_chat([m.model_dump() for m in body.messages]):
                # 上游行已是 `data: {...}` 格式，补充 SSE 事件分隔符
                yield f"{line}\n\n"
        except UpstreamError as exc:
            # 流已开始后上游才报错的情况：以错误事件收尾，前端可识别
            yield f"data: {json.dumps({'error': {'code': exc.code, 'message': exc.message}}, ensure_ascii=False)}\n\n"
        except Exception as exc:  # noqa: BLE001 兜底：任何异常都以错误事件收尾，避免连接被硬掐断
            logger.exception("chat 流式转发出现未预期异常")
            yield f"data: {json.dumps({'error': {'code': 'UPSTREAM_ERROR', 'message': f'服务内部错误: {exc}'}}, ensure_ascii=False)}\n\n"
        finally:
            logger.info("chat 请求结束")

    # 客户端断开时 uvicorn 会取消该生成器，httpx 上下文管理器自动释放上游连接
    return StreamingResponse(event_generator(), media_type="text/event-stream")
