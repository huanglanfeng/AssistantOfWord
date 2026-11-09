"""上游模型调用与流式转发（需求 6.2）

使用 httpx 直接调用 OpenAI 兼容接口（不绑定特定 SDK），逐行转发 SSE 给前端。
"""
from collections.abc import AsyncIterator
from typing import Any

import httpx

from .. import config

# 上游 HTTP 状态码 → 后端错误码（需求 7.1）
_STATUS_TO_CODE = {
    401: "UNAUTHORIZED",
    403: "UNAUTHORIZED",
    429: "RATE_LIMITED",
}


class UpstreamError(Exception):
    """上游调用失败，携带结构化错误码与可读信息"""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


async def stream_chat(messages: list[dict[str, Any]]) -> AsyncIterator[str]:
    """调用上游 /chat/completions（stream=True），逐行产出 SSE 文本。

    说明：
    - 使用 async with 管理连接，客户端断开时生成器被关闭，连接自动释放，
      避免资源泄漏（需求 4.3）。
    - 产出的是上游原始 SSE 行（如 `data: {...}` / `data: [DONE]`），
      由路由层统一加事件分隔符。
    """
    url = f"{config.OPENAI_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {config.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": config.OPENAI_MODEL,
        "messages": messages,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=None) as client:
        try:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                # 非 200：读取错误体并抛出结构化错误（由路由层转为 JSON 响应）
                if response.status_code != 200:
                    code = _STATUS_TO_CODE.get(response.status_code, "UPSTREAM_ERROR")
                    body = await response.aread()
                    detail = body.decode("utf-8", errors="replace")[:300]
                    raise UpstreamError(code, f"上游返回 {response.status_code}: {detail}")

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    yield line
                    if line.strip() == "data: [DONE]":
                        break
        except httpx.RequestError as exc:
            # DNS/连接/超时等网络异常统一转为结构化错误（需求 4.4 区分错误类型）
            raise UpstreamError("UPSTREAM_ERROR", f"无法连接上游服务: {exc}") from exc
