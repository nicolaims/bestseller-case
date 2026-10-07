import { defineStore } from 'pinia'
import { ROLE_STORAGE_KEY } from '../constants'
import type { Role } from '../types'

export const useRoleStore = defineStore('role', {
  state: () => ({
    role: (localStorage.getItem(ROLE_STORAGE_KEY) as Role | null) ?? ('Operator' as Role),
  }),
  getters: {
    isManager: (state) => state.role === 'Manager',
    isOperator: (state) => state.role === 'Operator',
  },
  actions: {
    setRole(role: Role) {
      this.role = role
      localStorage.setItem(ROLE_STORAGE_KEY, role)
    },
    toggleRole() {
      this.setRole(this.role === 'Operator' ? 'Manager' : 'Operator')
    },
  },
})
