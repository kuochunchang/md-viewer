<template>
  <v-dialog 
    v-model="isOpen" 
    max-width="700" 
    transition="dialog-bottom-transition"
    persistent
  >
    <v-card class="ai-dialog-card">
      <!-- Header -->
      <v-card-title class="dialog-header d-flex align-center justify-space-between">
        <div class="d-flex align-center gap-2">
          <v-icon color="primary">mdi-robot</v-icon>
          <span class="text-h6 font-weight-bold">AI Writing Assistant</span>
        </div>
        <v-btn icon variant="text" size="small" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text class="dialog-content pa-0">
        <!-- Original Text Section -->
        <div class="original-text-section pa-4">
          <div class="section-label d-flex align-center gap-2 mb-2">
            <v-icon size="small" color="grey">mdi-text-box-outline</v-icon>
            <span class="text-caption text-grey">Selected Text</span>
            <v-spacer></v-spacer>
            <v-chip size="x-small" variant="tonal">{{ selectedText.length }} chars</v-chip>
          </div>
          <div class="original-text-content">
            {{ selectedText }}
          </div>
        </div>

        <v-divider></v-divider>

        <!-- Quick Actions -->
        <div class="quick-actions pa-4">
          <div class="text-caption text-grey mb-2">Quick Actions</div>
          <div class="d-flex flex-wrap gap-2">
            <v-btn
              v-for="action in geminiAI.quickActions"
              :key="action.id"
              size="small"
              variant="tonal"
              :prepend-icon="action.icon"
              :disabled="geminiAI.isProcessing.value"
              @click="handleQuickAction(action)"
            >
              {{ action.label }}
            </v-btn>
          </div>
        </div>

        <v-divider></v-divider>

        <!-- Chat Messages -->
        <div class="chat-container" ref="chatContainer">
          <div 
            v-for="(msg, idx) in chatHistory" 
            :key="idx" 
            :class="['chat-message', msg.role]"
          >
            <div class="message-header">
              <v-icon size="small" :color="msg.role === 'user' ? 'primary' : 'success'">
                {{ msg.role === 'user' ? 'mdi-account' : 'mdi-robot' }}
              </v-icon>
              <span class="text-caption">{{ msg.role === 'user' ? 'You' : 'AI Assistant' }}</span>
            </div>
            <div class="message-content">
              {{ msg.content }}
            </div>
            <!-- Apply button for AI responses -->
            <v-btn
              v-if="msg.role === 'model' && idx === chatHistory.length - 1"
              size="small"
              color="primary"
              variant="tonal"
              class="mt-2"
              @click="applyText(msg.content)"
            >
              <v-icon start size="16">mdi-check</v-icon>
              Apply This Text
            </v-btn>
          </div>

          <!-- Loading indicator -->
          <div v-if="geminiAI.isProcessing.value" class="chat-message model">
            <div class="message-header">
              <v-icon size="small" color="success">mdi-robot</v-icon>
              <span class="text-caption">AI Assistant</span>
            </div>
            <div class="message-content">
              <v-progress-circular indeterminate size="16" width="2" class="mr-2"></v-progress-circular>
              Thinking...
            </div>
          </div>

          <!-- Error message -->
          <v-alert
            v-if="geminiAI.error.value"
            type="error"
            variant="tonal"
            density="compact"
            class="ma-4"
          >
            {{ geminiAI.error.value }}
          </v-alert>
        </div>
      </v-card-text>

      <v-divider></v-divider>

      <!-- Input Area -->
      <div class="input-area pa-4">
        <v-textarea
          v-model="userInput"
          placeholder="Ask AI to help edit the text... (e.g., 'Make it more professional' or 'Add more examples')"
          variant="outlined"
          density="compact"
          rows="2"
          hide-details
          :disabled="geminiAI.isProcessing.value"
          @keydown.enter.exact.prevent="sendMessage"
          @keydown.enter.shift.prevent="userInput += '\n'"
        ></v-textarea>
        <div class="d-flex justify-end mt-3 gap-2">
          <v-btn variant="text" color="grey" @click="closeDialog">
            Cancel
          </v-btn>
          <v-btn 
            color="primary" 
            variant="flat"
            :disabled="!userInput.trim() || geminiAI.isProcessing.value"
            :loading="geminiAI.isProcessing.value"
            @click="sendMessage"
          >
            <v-icon start size="18">mdi-send</v-icon>
            Send
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useGeminiAI, type ChatMessage } from '../composables/useGeminiAI';

interface Props {
  modelValue: boolean
  selectedText: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'apply': [text: string]
}>()

const geminiAI = useGeminiAI()

// Dialog state
const isOpen = ref(props.modelValue)
const userInput = ref('')
const chatHistory = ref<ChatMessage[]>([])
const chatContainer = ref<HTMLElement | null>(null)

// Sync dialog visibility
watch(() => props.modelValue, (newVal) => {
  isOpen.value = newVal
  if (newVal) {
    // Reset chat when dialog opens
    chatHistory.value = []
    userInput.value = ''
  }
})

watch(isOpen, (newVal) => {
  emit('update:modelValue', newVal)
})

// Auto-scroll chat to bottom
const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

watch(chatHistory, scrollToBottom, { deep: true })

function closeDialog() {
  isOpen.value = false
}

async function handleQuickAction(action: { id: string; label: string; prompt: string }) {
  try {
    const response = await geminiAI.chatAboutText(
      props.selectedText,
      action.prompt,
      chatHistory.value
    )
    
    chatHistory.value.push(
      { role: 'user', content: action.prompt },
      { role: 'model', content: response }
    )
  } catch (e) {
    console.error('Quick action failed:', e)
  }
}

async function sendMessage() {
  const message = userInput.value.trim()
  if (!message) return

  userInput.value = ''
  
  try {
    chatHistory.value.push({ role: 'user', content: message })
    
    const response = await geminiAI.chatAboutText(
      props.selectedText,
      message,
      chatHistory.value.slice(0, -1) // Exclude the message we just added
    )
    
    chatHistory.value.push({ role: 'model', content: response })
  } catch (e) {
    console.error('Send message failed:', e)
  }
}

function applyText(text: string) {
  emit('apply', text)
  closeDialog()
}
</script>

<style scoped lang="scss">
.ai-dialog-card {
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  background-color: rgb(var(--v-theme-surface));
}

.dialog-header {
  padding: 16px 20px;
  background: transparent;
}

.dialog-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}

.original-text-section {
  background-color: rgba(var(--v-theme-on-surface), 0.02);
}

.original-text-content {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  padding: 12px;
  background-color: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.quick-actions {
  background-color: transparent;
  
  :deep(.v-btn) {
    text-transform: none;
    font-weight: 500;
  }
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
  max-height: 300px;
  padding: 16px;
  background-color: rgba(var(--v-theme-on-surface), 0.01);
}

.chat-message {
  margin-bottom: 16px;
  
  &.user {
    .message-content {
      background-color: rgba(var(--v-theme-primary), 0.08);
      border-left: 3px solid rgb(var(--v-theme-primary));
    }
  }
  
  &.model {
    .message-content {
      background-color: rgba(var(--v-theme-on-surface), 0.04);
      border-left: 3px solid rgba(var(--v-theme-on-surface), 0.3);
    }
  }
}

.message-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  opacity: 0.6;
  font-size: 12px;
}

.message-content {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.input-area {
  background-color: transparent;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
</style>
