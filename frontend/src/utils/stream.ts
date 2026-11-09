/**
 * SSE（Server-Sent Events）流式解析核心 —— 手写实现，不使用第三方封装（需求 9.4）
 *
 * 上游返回格式形如：
 *   data: {"choices":[{"delta":{"content":"闭"}}]}
 *   data: {"choices":[{"delta":{"content":"包"}}]}
 *   data: [DONE]
 *
 * 关键点（需求 12 风险项）：
 * 1. 每次 reader.read() 拿到的 chunk 可能在一行中间被截断（半截 chunk），
 *    所以必须维护 buffer，只消费 buffer 中完整的行，剩余部分留待下一个 chunk。
 * 2. 收到 data: [DONE] 表示流结束。
 * 3. 空行是 SSE 事件分隔符，冒号开头的是注释行，均直接跳过。
 */
export interface SSEParseHandlers {
  /** 每解析到一段增量文本时回调 */
  onDelta: (text: string) => void
  /** 解析到后端错误事件（data: {"error": {...}}）时回调 */
  onError: (error: { code: string; message: string }) => void
}

export interface SSELineParser {
  /**
   * 喂入一个解码后的 chunk。
   * @returns 是否解析到 [DONE]（流结束信号）
   */
  feed(chunk: string): boolean
}

export function createSSELineParser(handlers: SSEParseHandlers): SSELineParser {
  let buffer = ''

  return {
    feed(chunk: string): boolean {
      // 追加到 buffer，再按换行拆分
      buffer += chunk
      const lines = buffer.split('\n')
      // 最后一段可能是被截断的半行，必须留在 buffer 等待下一个 chunk 拼接
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trimEnd()
        // 空行 = 事件分隔；冒号开头 = SSE 注释
        if (!line || line.startsWith(':')) continue
        if (!line.startsWith('data:')) continue

        const payload = line.slice(5).trim()
        if (payload === '[DONE]') {
          return true
        }

        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
            error?: { code?: string; message?: string }
          }
          // 后端流式中途出错：以错误事件收尾（见后端 chat.py）
          if (json.error) {
            handlers.onError({
              code: json.error.code ?? 'UPSTREAM_ERROR',
              message: json.error.message ?? '上游服务错误',
            })
            return true
          }
          const delta = json.choices?.[0]?.delta?.content
          if (delta) handlers.onDelta(delta)
        } catch {
          // 单行 JSON 解析失败不应中断整个流，忽略
        }
      }
      return false
    },
  }
}
