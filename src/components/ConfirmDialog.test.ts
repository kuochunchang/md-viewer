import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import ConfirmDialog from './ConfirmDialog.vue'

describe('ConfirmDialog', () => {
  it('應該能夠渲染', () => {
    const wrapper = shallowMount(ConfirmDialog, {
      props: {
        modelValue: true,
        title: '確認刪除',
        message: '確定要刪除這個頁籤嗎？',
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('應該能夠觸發確認事件', async () => {
    const wrapper = shallowMount(ConfirmDialog, {
      props: {
        modelValue: true,
        title: '確認刪除',
        message: '確定要刪除這個頁籤嗎？',
      },
    })

    wrapper.vm.$emit('confirm')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('應該能夠觸發取消事件', async () => {
    const wrapper = shallowMount(ConfirmDialog, {
      props: {
        modelValue: true,
        title: '確認刪除',
        message: '確定要刪除這個頁籤嗎？',
      },
    })

    wrapper.vm.$emit('cancel')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
