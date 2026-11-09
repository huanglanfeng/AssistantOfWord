<script setup lang="ts">
/**
 * 中间消息流区域：渲染消息列表，自动滚动到底部（需求 5.3）
 * 用户向上滚动时暂停自动滚动。
 */
import { nextTick, ref, watch } from 'vue'
import type { Conversation } from '../types'
import MessageItem from './MessageItem.vue'

const props = defineProps<{
  conversation: Conversation
}>()

const scrollRef = ref<HTMLElement | null>(null)
/** 用户是否主动向上滚动（暂停自动滚动） */
const userScrolledUp = ref(false)

function scrollToBottom() {
  if (userScrolledUp.value) return
  nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function onScroll() {
  const el = scrollRef.value
  if (!el) return
  // 距底部 40px 以内视为"在底部"
  userScrolledUp.value = el.scrollHeight - el.scrollTop - el.clientHeight > 40
}

// 消息条数变化（新消息）或内容变化（流式输出）都尝试滚动
watch(() => props.conversation.messages.length, scrollToBottom)
watch(
  () => props.conversation.messages.map((m) => m.content.length).join(','),
  scrollToBottom,
)
</script>

<template>
  <div ref="scrollRef" class="message-stream" @scroll="onScroll">
    <el-empty
      v-if="conversation.messages.length === 0"
      description="输入技术问题开始对话"
      :image-size="80"
      class="stream-empty"
    />
    <MessageItem
      v-for="msg in conversation.messages"
      :key="msg.id"
      :message="msg"
    />
  </div>
</template>

<style scoped>
.message-stream {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.stream-empty {
  margin-top: 20vh;
}
</style>
