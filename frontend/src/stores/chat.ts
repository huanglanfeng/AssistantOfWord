/**
 * 会话与消息状态管理（Pinia，需求 4.1 / 4.2 / 4.3 / 4.4 / 4.6）
 */
import { defineStore } from 'pinia'
import type { Conversation, Message, MessageRole, MessageStatus } from '../types'
import { ChatRequestError, sendChat } from '../api/chat'
import {
  loadActiveId,
  loadConversations,
  saveActiveId,
  saveConversations,
} from '../utils/storage'

/** 上下文长度策略：MVP 保留最近 10 轮对话（需求 4.6，README 说明） */
const MAX_CONTEXT_ROUNDS = 10

function createId(): string {
  return crypto.randomUUID()
}

function createMessage(role: MessageRole, content: string, status: MessageStatus): Message {
  return {
    id: createId(),
    role,
    content,
    status,
  }
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    conversations: loadConversations() as Conversation[],
    activeConversationId: loadActiveId(),
    /** 当前流式请求的中断控制器；非 null 即表示正在生成中 */
    abortController: null as AbortController | null,
  }),

  getters: {
    activeConversation(state): Conversation | null {
      return (
        state.conversations.find((c) => c.id === state.activeConversationId) ?? null
      )
    },
    isStreaming(state): boolean {
      return state.abortController !== null
    },
  },

  actions: {
    /** 同步持久化（MVP 用 localStorage） */
    persist() {
      saveConversations(this.conversations)
      saveActiveId(this.activeConversationId)
    },

    /** 会话 updatedAt 刷新 */
    touch(conv: Conversation) {
      conv.updatedAt = Date.now()
    },

    createConversation() {
      const now = Date.now()
      const conv: Conversation = {
        id: createId(),
        title: '新会话',
        messages: [],
        createdAt: now,
        updatedAt: now,
      }
      this.conversations.unshift(conv)
      this.activeConversationId = conv.id
      this.persist()
    },

    deleteConversation(id: string) {
      const index = this.conversations.findIndex((c) => c.id === id)
      if (index === -1) return
      // 正在流式输出的会话不允许删除（先停止再删）
      if (this.abortController && id === this.activeConversationId) {
        this.stopGeneration()
      }
      this.conversations.splice(index, 1)
      if (this.activeConversationId === id) {
        this.activeConversationId = this.conversations[0]?.id ?? null
      }
      this.persist()
    },

    switchConversation(id: string) {
      if (this.abortController) this.stopGeneration()
      this.activeConversationId = id
      this.persist()
    },

    clearConversation(id: string) {
      const conv = this.conversations.find((c) => c.id === id)
      if (!conv) return
      conv.messages = []
      conv.title = '新会话'
      this.touch(conv)
      this.persist()
    },

    /**
     * 组装请求上下文：只携带完成状态的消息，最近 MAX_CONTEXT_ROUNDS 轮（需求 4.6）
     */
    buildContext(messages: Message[], excludeId?: string) {
      const valid = messages.filter(
        (m) =>
          m.id !== excludeId &&
          m.role !== 'system' &&
          m.status !== 'error' &&
          m.content.trim() !== '',
      )
      // 每轮 = user + assistant 共 2 条
      return valid.slice(-MAX_CONTEXT_ROUNDS * 2).map((m) => ({
        role: m.role,
        content: m.content,
      }))
    },

    /**
     * 执行流式请求的核心流程：更新消息状态 → sendChat → 按结果收尾
     */
    async runStream(conv: Conversation, assistant: Message, context: Message[]) {
      const controller = new AbortController()
      this.abortController = controller

      assistant.status = 'streaming'
      this.touch(conv)
      this.persist()

      try {
        await sendChat({
          messages: this.buildContext(context, assistant.id),
          signal: controller.signal,
          onDelta: (text) => {
            assistant.content += text
          },
        })
        assistant.status = 'done'
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // 用户主动停止：保留已生成内容，不报错（需求 4.3）
          assistant.status = 'stopped'
        } else if (err instanceof ChatRequestError) {
          assistant.status = 'error'
          assistant.error = { code: err.code, message: err.message }
        } else {
          assistant.status = 'error'
          assistant.error = { code: 'UNKNOWN', message: '发生未知错误' }
        }
      } finally {
        this.abortController = null
        this.touch(conv)
        this.persist()
      }
    },

    async sendMessage(content: string) {
      const conv = this.activeConversation
      if (!conv || this.abortController || content.trim() === '') return

      conv.messages.push(createMessage('user', content.trim(), 'done'))
      // 首条消息自动作为会话标题
      if (conv.title === '新会话') {
        conv.title = content.trim().slice(0, 20)
      }

      const assistant = createMessage('assistant', '', 'streaming')
      conv.messages.push(assistant)
      // 关键：push 进响应式数组后必须重新读取，拿到的是响应式代理；
      // 若沿用 createMessage 的原始对象引用，后续赋值不会触发视图更新
      const assistantRef = conv.messages[conv.messages.length - 1]
      this.touch(conv)
      this.persist()

      await this.runStream(conv, assistantRef, conv.messages)
    },

    /** 停止生成（需求 4.3）：abort 后由 runStream 的 catch 收尾为 stopped */
    stopGeneration() {
      this.abortController?.abort()
    },

    /** 重试（需求 4.4）：清空失败内容，回退到该消息之前的上下文重新请求 */
    async retryMessage(messageId: string) {
      const conv = this.activeConversation
      if (!conv || this.abortController) return
      const index = conv.messages.findIndex((m) => m.id === messageId)
      const message = conv.messages[index]
      if (!message || message.role !== 'assistant') return

      message.content = ''
      delete message.error
      await this.runStream(conv, message, conv.messages.slice(0, index))
    },
  },
})
