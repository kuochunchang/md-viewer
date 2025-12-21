import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from './debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should delay function execution', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 100)

    debouncedFn()
    expect(mockFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should only execute last call when called multiple times', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 100)

    debouncedFn()
    debouncedFn()
    debouncedFn()

    vi.advanceTimersByTime(100)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should pass correct arguments', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 100)

    debouncedFn('arg1', 'arg2')
    vi.advanceTimersByTime(100)

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
  })
})
