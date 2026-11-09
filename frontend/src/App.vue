<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useChatStore } from './stores/chat'
import ConversationList from './components/ConversationList.vue'
import MessageStream from './components/MessageStream.vue'
import ChatInput from './components/ChatInput.vue'

const store = useChatStore()
const { activeConversation } = storeToRefs(store)

// 首次进入：无会话则自动创建一个
if (!store.activeConversationId) {
  store.createConversation()
}
</script>

<template>
  <el-container class="app-layout">
    <!-- 顶部：项目名称 / 模型标识（需求 5.1） -->
    <el-header class="app-header" height="56px">
      <span class="app-title">技术文档问答助手</span>
      <el-tag size="small" type="info" effect="plain">MVP · 聊天壳</el-tag>
    </el-header>

    <el-container class="app-body">
      <!-- 左侧：会话列表 -->
      <el-aside width="260px" class="app-aside">
        <ConversationList />
      </el-aside>

      <!-- 中间 + 底部：消息流与输入区 -->
      <el-main class="chat-main">
        <template v-if="activeConversation">
          <MessageStream :conversation="activeConversation" />
          <ChatInput />
        </template>
        <el-empty v-else description="暂无会话" />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-layout {
  height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.app-title {
  font-size: 16px;
  font-weight: 600;
}

.app-body {
  min-height: 0;
}

.app-aside {
  border-right: 1px solid var(--el-border-color-light);
  overflow-y: auto;
}

.chat-main {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
}
</style>
