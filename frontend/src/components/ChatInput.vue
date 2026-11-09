<script setup lang="ts">
/**
 * 底部输入区：输入框 + 发送按钮 + 停止按钮（需求 4.2 / 4.3）
 * 流式过程中禁用发送，允许停止（需求 4.2 MVP 策略）。
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '../stores/chat'

const store = useChatStore()
const draft = ref('')

function send() {
  const content = draft.value.trim()
  if (!content) return
  if (store.isStreaming) {
    ElMessage.warning('正在生成回答，请先停止或等待完成')
    return
  }
  draft.value = ''
  void store.sendMessage(content)
}

/** Enter 发送，Shift+Enter 换行 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}
</script>

<template>
  <div class="chat-input">
    <el-input
      v-model="draft"
      type="textarea"
      :rows="3"
      resize="none"
      placeholder="输入技术问题，Enter 发送，Shift+Enter 换行"
      :disabled="false"
      @keydown="onKeydown"
    />
    <div class="input-actions">
      <span class="hint">回答内容由 AI 生成，请注意甄别</span>
      <div class="buttons">
        <!-- 流式中显示停止按钮（需求 4.3） -->
        <el-button v-if="store.isStreaming" type="warning" @click="store.stopGeneration()">
          停止生成
        </el-button>
        <el-button v-else type="primary" :disabled="draft.trim() === ''" @click="send">
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-input {
  border-top: 1px solid var(--el-border-color-light);
  padding: 12px 16px;
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.buttons {
  display: flex;
  gap: 8px;
}
</style>
