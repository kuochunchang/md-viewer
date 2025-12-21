<template>
  <div class="settings-menu">
    <!-- 主題切換按鈕 -->
    <v-btn
      icon
      variant="text"
      size="small"
      class="theme-toggle-btn"
      :title="isDark ? '切換至淺色主題' : '切換至深色主題'"
      @click="toggleTheme"
    >
      <v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
    </v-btn>

    <!-- 字體大小調整選單 -->
    <v-menu location="bottom end" :close-on-content-click="false">
      <template #activator="{ props: menuProps }">
        <v-btn
          icon
          variant="text"
          size="small"
          class="font-size-btn"
          title="調整字體大小"
          v-bind="menuProps"
        >
          <v-icon>mdi-format-size</v-icon>
        </v-btn>
      </template>
      <v-card min-width="280" class="font-size-menu">
        <v-card-title class="text-subtitle-1 pa-4 pb-2">
          字體大小
        </v-card-title>
        <v-card-text class="pt-2">
          <div class="font-size-controls">
            <!-- 字體大小顯示 -->
            <div class="font-size-display mb-4">
              <span class="text-body-2">目前大小：{{ fontSize }}px</span>
            </div>

            <!-- 滑桿控制 -->
            <v-slider
              v-model="localFontSize"
              :min="10"
              :max="24"
              :step="1"
              color="primary"
              track-color="grey-lighten-2"
              hide-details
              @update:model-value="handleFontSizeChange"
            >
              <template #append>
                <v-text-field
                  v-model.number="localFontSize"
                  type="number"
                  variant="outlined"
                  density="compact"
                  style="width: 70px"
                  :min="10"
                  :max="24"
                  hide-details
                  @update:model-value="handleFontSizeChange"
                ></v-text-field>
              </template>
            </v-slider>

            <!-- 快速調整按鈕 -->
            <div class="font-size-presets mt-4">
              <v-btn
                v-for="preset in fontSizePresets"
                :key="preset"
                size="small"
                variant="outlined"
                :color="localFontSize === preset ? 'primary' : undefined"
                class="preset-btn"
                @click="setFontSize(preset)"
              >
                {{ preset }}px
              </v-btn>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useTabsStore } from '../stores/tabsStore'

const theme = useTheme()
const tabsStore = useTabsStore()

// 主題狀態
const isDark = computed(() => theme.global.name.value === 'dark')

// 字體大小狀態
const fontSize = computed(() => tabsStore.fontSize)
const localFontSize = ref(fontSize.value)

// 字體大小預設值
const fontSizePresets = [12, 14, 16, 18, 20]

// 監聽外部字體大小變化
watch(fontSize, (newValue) => {
  localFontSize.value = newValue
})

// 切換主題
function toggleTheme() {
  theme.global.name.value = isDark.value ? 'light' : 'dark'
  // 儲存主題偏好到 localStorage
  localStorage.setItem('theme', theme.global.name.value)
}

// 處理字體大小變化
function handleFontSizeChange(value: number | string) {
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value
  if (!isNaN(numValue) && numValue >= 10 && numValue <= 24) {
    tabsStore.setFontSize(numValue)
  }
}

// 設定字體大小（預設值）
function setFontSize(size: number) {
  tabsStore.setFontSize(size)
}

// 初始化：從 localStorage 載入主題偏好
const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'dark' || savedTheme === 'light') {
  theme.global.name.value = savedTheme
}
</script>

<style scoped lang="scss">
.settings-menu {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding-right: 8px;
}

.theme-toggle-btn,
.font-size-btn {
  flex-shrink: 0;
}

.font-size-menu {
  .font-size-controls {
    .font-size-display {
      text-align: center;
      color: rgba(var(--v-theme-on-surface), 0.7);
    }

    .font-size-presets {
      display: flex;
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;

      .preset-btn {
        min-width: 60px;
      }
    }
  }
}

// 響應式設計：小螢幕時調整按鈕大小
@media (max-width: 600px) {
  .settings-menu {
    gap: 2px;
    padding-right: 4px;
  }

  .theme-toggle-btn,
  .font-size-btn {
    :deep(.v-btn) {
      width: 36px;
      height: 36px;
    }
  }
}
</style>
