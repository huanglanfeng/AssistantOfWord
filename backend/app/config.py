"""环境变量与配置（需求 6.2 / 9.1）

API Key 仅存后端环境变量，前端不接触密钥；.env 不提交 Git。
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# 加载 backend/.env
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# 允许的前端来源（逗号分隔）
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
