<script setup lang="ts">
/**
 * 左侧会话列表：新建 / 切换 / 删除（需求 4.1）
 */
import { useChatStore } from '../stores/chat'

const store = useChatStore()

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<template>
  <div class="conversation-list">
    <div class="list-toolbar">
      <el-button type="primary" size="small" :disabled="store.isStreaming" @click="store.createConversation()">
        新建会话
      </el-button>
    </div>

    <TransitionGroup name="list" tag="ul" class="list-items">
      <li
        v-for="conv in store.conversations"
        :key="conv.id"
        class="list-item"
        :class="{ active: conv.id === store.activeConversationId }"
        @click="store.switchConversation(conv.id)"
      >
        <div class="item-main">
          <span class="item-title">{{ conv.title }}</span>
          <span class="item-time">{{ formatTime(conv.updatedAt) }}</span>
        </div>
        <el-popconfirm title="确认删除该会话？" confirm-button-text="删除" cancel-button-text="取消" @confirm="store.deleteConversation(conv.id)">
          <template #reference>
            <el-button class="item-delete" type="danger" link size="small" @click.stop>删除</el-button>
          </template>
        </el-popconfirm>
      </li>
    </TransitionGroup>

    <el-empty v-if="store.conversations.length === 0" description="暂无会话" :image-size="60" />
  </div>
</template>

<style scoped>
.conversation-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
}

.list-toolbar {
  margin-bottom: 12px;
}

.list-items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
}

.list-item:hover {
  background: var(--el-fill-color-light);
}

.list-item.active {
  background: var(--el-color-primary-light-9);
}

.item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.item-title {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.item-delete {
  flex-shrink: 0;
  visibility: hidden;
}

.list-item:hover .item-delete {
  visibility: visible;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.2s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
