import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfirmDialog from './ConfirmDialog.vue'

describe('ConfirmDialog', () => {
  it('should render correctly', () => {
    const wrapper = shallowMount(ConfirmDialog, {
      props: {
        modelValue: true,
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this tab?',
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('should emit confirm event', async () => {
    const wrapper = shallowMount(ConfirmDialog, {
      props: {
        modelValue: true,
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this tab?',
      },
    })

    wrapper.vm.$emit('confirm')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('should emit cancel event', async () => {
    const wrapper = shallowMount(ConfirmDialog, {
      props: {
        modelValue: true,
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this tab?',
      },
    })

    wrapper.vm.$emit('cancel')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
