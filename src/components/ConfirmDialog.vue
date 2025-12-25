<template>
  <v-dialog
    :model-value="modelValue"
    max-width="400"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="confirm-card rounded-lg elevation-4">
      <v-card-title class="pa-4 pb-2 text-h6 font-weight-bold d-flex align-center gap-2">
        <v-icon color="error" class="mr-2">mdi-alert-circle-outline</v-icon>
        {{ title }}
      </v-card-title>
      
      <v-card-text class="pa-4 pt-2 text-body-1 text-secondary">
        {{ message }}
      </v-card-text>
      
      <v-card-actions class="pa-4 pt-0">
        <v-spacer></v-spacer>
        <v-btn
          variant="outlined"
          color="secondary"
          class="text-none px-4"
          rounded="md"
          @click="handleCancel"
        >
          Cancel
        </v-btn>
        <v-btn
          color="error"
          variant="flat"
          class="text-none px-4 ml-2"
          rounded="md"
          @click="handleConfirm"
        >
          Delete
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  title: string
  message: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

function handleConfirm() {
  emit('confirm')
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
.confirm-card {
  border: 1px solid var(--border-color);
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.text-secondary {
  color: var(--text-secondary);
}
</style>
