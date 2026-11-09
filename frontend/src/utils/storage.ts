/**
 * 会话持久化：MVP 阶段使用 localStorage（需求 4.1 / 6.3）
 */
import type { Conversation } from '../types'

const CONVERSATIONS_KEY = 'aow:conversations'
const ACTIVE_ID_KEY = 'aow:active-conversation-id'

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Conversation[]
    // 恢复时把中断的 streaming 状态收尾，避免刷新后出现僵尸消息
    for (const conv of parsed) {
      for (const msg of conv.messages) {
        if (msg.status === 'streaming' || msg.status === 'idle') {
          msg.status = 'stopped'
        }
      }
    }
    return parsed
  } catch {
    return []
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
  } catch {
    // 存储满 / 隐私模式下静默失败，不影响聊天主流程
  }
}

export function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_ID_KEY)
}

export function saveActiveId(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_ID_KEY)
    else localStorage.setItem(ACTIVE_ID_KEY, id)
  } catch {
    /* 同上 */
  }
}
