<script setup lang="ts">
/**
 * 单条消息：根据角色与状态渲染不同 UI 与操作按钮（需求 5.2）
 */
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '../stores/chat'
import type { Message } from '../types'
import MarkdownView from './MarkdownView.vue'

const props = defineProps<{
  message: Message
}>()

const store = useChatStore()

const isUser = computed(() => props.message.role === 'user')
const canRetry = computed(() => props.message.status === 'error')
const canCopy = computed(() => props.message.status === 'done' && props.message.content)

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<template>
  <div class="message-item" :class="{ user: isUser }">
    <div class="bubble">
      <!-- 用户消息：纯文本 -->
      <p v-if="isUser" class="plain-content">{{ message.content }}</p>

      <!-- 助手消息：Markdown 渲染 -->
      <template v-else>
        <MarkdownView v-if="message.content" :content="message.content" />
        <span v-if="message.status === 'streaming'" class="typing-cursor">▍</span>

        <!-- 流式生成中的占位 -->
        <span v-if="message.status === 'streaming' && !message.content" class="streaming-hint">
          正在思考…
        </span>

        <!-- 用户中断提示（保留已生成内容） -->
        <el-text v-if="message.status === 'stopped'" type="info" size="small">
          已停止生成
        </el-text>

        <!-- 错误提示 + 重试按钮（需求 4.4） -->
        <el-alert
          v-if="message.status === 'error' && message.error"
          :title="message.error.message"
          type="error"
          :closable="false"
          show-icon
          class="error-alert"
        />
      </template>
    </div>

    <!-- 状态相关操作按钮 -->
    <div v-if="!isUser" class="actions">
      <el-button v-if="canRetry" size="small" type="primary" link @click="store.retryMessage(message.id)">
        重试
      </el-button>
      <el-button v-if="canCopy" size="small" type="primary" link @click="copyContent">
        复制
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.message-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 16px;
  max-width: 85%;
}

.message-item.user {
  align-self: flex-end;
  align-items: flex-end;
}

.bubble {
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  font-size: 14px;
  line-height: 1.6;
  overflow-wrap: break-word;
}

.message-item.user .bubble {
  background: var(--el-color-primary-light-9);
}

.plain-content {
  margin: 0;
  white-space: pre-wrap;
}

.streaming-hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.typing-cursor {
  display: inline-block;
  color: var(--el-color-primary);
  animation: blink 0.9s steps(1) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.error-alert {
  margin-top: 8px;
}

.actions {
  margin-top: 4px;
}
</style>
