<script setup lang="ts">
/**
 * Markdown 渲染（需求 4.5）：markdown-it + highlight.js
 * 流式期间内容只增不减，Vue diff 保证不整页重排；节流由 store 层的
 * requestAnimationFrame 同步策略处理（见 README 设计）。
 */
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const props = defineProps<{
  content: string
}>()

/** 手写 HTML 转义，避免在 highlight 回调中引用 md 实例造成自引用类型推导 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const md = new MarkdownIt({
  html: false, // 禁止原始 HTML，防 XSS（需求 9.1）
  linkify: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang }).value}</code></pre>`
      } catch {
        /* 高亮失败降级为纯文本 */
      }
    }
    return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`
  },
})

const html = computed(() => md.render(props.content))
</script>

<template>
  <!-- v-html 内容来自 markdown-it 渲染（已禁用内嵌 HTML），风险可控 -->
  <div class="markdown-view" v-html="html" />
</template>

<style scoped>
.markdown-view :deep(pre) {
  position: relative;
  padding: 12px;
  border-radius: 8px;
  background: #f6f8fa;
  overflow-x: auto;
  font-size: 13px;
}

.markdown-view :deep(code) {
  font-family: Consolas, Monaco, 'Courier New', monospace;
}

.markdown-view :deep(p) {
  margin: 6px 0;
}

.markdown-view :deep(pre:first-child) {
  margin-top: 0;
}

.markdown-view :deep(pre:last-child) {
  margin-bottom: 0;
}
</style>
