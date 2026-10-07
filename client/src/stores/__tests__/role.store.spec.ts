import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ROLE_STORAGE_KEY } from '../../constants'
import { useRoleStore } from '../role.store'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('role store', () => {
  it('defaults to Operator when nothing is stored', () => {
    const store = useRoleStore()
    expect(store.role).toBe('Operator')
    expect(store.isOperator).toBe(true)
    expect(store.isManager).toBe(false)
  })

  it('persists the role to localStorage on setRole', () => {
    const store = useRoleStore()
    store.setRole('Manager')
    expect(store.role).toBe('Manager')
    expect(store.isManager).toBe(true)
    expect(localStorage.getItem(ROLE_STORAGE_KEY)).toBe('Manager')
  })

  it('toggleRole flips between Operator and Manager', () => {
    const store = useRoleStore()
    expect(store.role).toBe('Operator')
    store.toggleRole()
    expect(store.role).toBe('Manager')
    store.toggleRole()
    expect(store.role).toBe('Operator')
  })

  it('reads a previously persisted role back on init', () => {
    localStorage.setItem(ROLE_STORAGE_KEY, 'Manager')
    const store = useRoleStore()
    expect(store.role).toBe('Manager')
  })
})
