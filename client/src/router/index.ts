import { createRouter, createWebHistory } from 'vue-router'
import { useRoleStore } from '../stores/role.store'

const routes = [
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/tickets', name: 'queue', component: () => import('../views/TicketQueueView.vue') },
  {
    path: '/tickets/new',
    name: 'create',
    component: () => import('../views/TicketCreateView.vue'),
    meta: { requiresRole: 'Operator' as const },
  },
  { path: '/partners', name: 'partners', component: () => import('../views/PartnerOverviewView.vue') },
  { path: '/approved', name: 'approved', component: () => import('../views/ApprovedLibraryView.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Advisory guard only — there is no real auth, this just keeps the demo
// honest by not letting a Manager land on the Operator-only create form.
router.beforeEach((to) => {
  const requiredRole = to.meta.requiresRole as 'Operator' | 'Manager' | undefined
  if (requiredRole && useRoleStore().role !== requiredRole) {
    return { name: 'queue' }
  }
})
