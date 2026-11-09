/**
 * 全局数据模型（对应需求文档第 8 节）
 */

export type MessageRole = 'user' | 'assistant' | 'system'

/** 消息状态机：idle → streaming → done / stopped / error（需求 5.2） */
export type MessageStatus = 'idle' | 'streaming' | 'done' | 'stopped' | 'error'

export interface MessageError {
  code: string
  message: string
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  status: MessageStatus
  error?: MessageError
  // P1 预留：引用来源
  citations?: unknown[]
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

/** 发送给后端的上下文消息（不含状态等前端字段） */
export interface ChatContextMessage {
  role: MessageRole
  content: string
}
