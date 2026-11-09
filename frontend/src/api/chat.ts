/**
 * /api/chat 流式请求封装（需求 4.2 / 7.1）
 *
 * 使用原生 fetch 而非 axios：可直接拿到 ReadableStream，配合 AbortController 实现中断。
 */
import { createSSELineParser } from '../utils/stream'
import type { ChatContextMessage } from '../types'

const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? ''

/** 后端约定的错误码（需求 7.1） */
export type ChatErrorCode =
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'UPSTREAM_ERROR'
  | 'INVALID_REQUEST'
  | 'NETWORK_ERROR'

export class ChatRequestError extends Error {
  code: ChatErrorCode

  constructor(code: ChatErrorCode, message: string) {
    super(message)
    this.name = 'ChatRequestError'
    this.code = code
  }
}

export interface SendChatOptions {
  messages: ChatContextMessage[]
  /** 由 AbortController 提供，用于"停止生成"（需求 4.3） */
  signal?: AbortSignal
  /** 每收到一段增量文本时回调 */
  onDelta: (text: string) => void
}

/**
 * 发起流式对话请求。resolve 表示流正常结束；用户中断会抛出 AbortError；
 * 业务失败抛出 ChatRequestError。
 */
export async function sendChat(options: SendChatOptions): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: options.messages }),
      signal: options.signal,
    })
  } catch (err) {
    // fetch 阶段失败：用户主动中断（AbortError 原样上抛）或网络错误
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ChatRequestError('NETWORK_ERROR', '网络连接失败，请检查后端服务是否可用')
  }

  // 非 2xx：后端返回结构化错误 JSON（非流式）
  if (!response.ok) {
    let code: ChatErrorCode = 'UPSTREAM_ERROR'
    let message = `请求失败（HTTP ${response.status}）`
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } }
      if (body.error?.code) code = body.error.code as ChatErrorCode
      if (body.error?.message) message = body.error.message
    } catch {
      /* 响应体不是 JSON 时使用默认错误信息 */
    }
    throw new ChatRequestError(code, message)
  }

  if (!response.body) {
    throw new ChatRequestError('UPSTREAM_ERROR', '响应不含可读流')
  }

  // 核心流式读取：read() → 解码 → 逐行解析（buffer 处理见 stream.ts）
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  const parser = createSSELineParser({
    onDelta: options.onDelta,
    onError: (error) => {
      // 后端以错误事件收尾：抛给调用方，由 store 统一转为 error 状态
      throw new ChatRequestError(error.code as ChatErrorCode, error.message)
    },
  })

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    // stream: true 处理跨 chunk 截断的多字节字符（如中文/emoji）
    const finished = parser.feed(decoder.decode(value, { stream: true }))
    if (finished) {
      reader.cancel().catch(() => {})
      return
    }
  }
}
