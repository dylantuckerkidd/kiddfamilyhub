import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '@/composables/useApi'

export interface Transaction {
  id: number
  amount: number
  description: string
  category: string
  date: string
  type: 'income' | 'expense'
}

export interface Budget {
  id: number
  category: string
  limit: number
  spent: number
}

export interface PlaidItem {
  item_id: string
  institution_name: string
  created_at: string
}

export interface CategoryMapping {
  id: number
  plaid_category: string
  budget_category: string
}

export const useBudgetStore = defineStore('budget', () => {
  const transactions = ref<Transaction[]>([])
  const budgets = ref<Budget[]>([])
  const plaidItems = ref<PlaidItem[]>([])
  const categoryMappings = ref<CategoryMapping[]>([])
  const plaidCategories = ref<string[]>([])
  const isSyncing = ref(false)

  async function fetchTransactions() {
    const res = await apiFetch('/api/transactions')
    transactions.value = await res.json()
  }

  async function fetchBudgets() {
    const res = await apiFetch('/api/budgets')
    budgets.value = await res.json()
  }

  async function addTransaction(transaction: Omit<Transaction, 'id'>) {
    const res = await apiFetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    })
    const newTransaction = await res.json()
    transactions.value.push(newTransaction)
    await fetchBudgets()
  }

  async function deleteTransaction(id: number) {
    await apiFetch(`/api/transactions/${id}`, {
      method: 'DELETE'
    })
    transactions.value = transactions.value.filter(t => t.id !== id)
    await fetchBudgets()
  }

  async function addBudget(budget: { category: string; limit: number }) {
    const res = await apiFetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(budget)
    })
    const newBudget = await res.json()
    const existingIndex = budgets.value.findIndex(b => b.id === newBudget.id)
    if (existingIndex >= 0) {
      budgets.value[existingIndex] = newBudget
    } else {
      budgets.value.push(newBudget)
    }
  }

  async function deleteBudget(id: number) {
    await apiFetch(`/api/budgets/${id}`, {
      method: 'DELETE'
    })
    budgets.value = budgets.value.filter(b => b.id !== id)
  }

  async function fetchPlaidItems() {
    const res = await apiFetch('/api/plaid/accounts')
    plaidItems.value = await res.json()
  }

  async function createLinkToken(): Promise<string> {
    const res = await apiFetch('/api/plaid/create-link-token', {
      method: 'POST'
    })
    const data = await res.json()
    return data.link_token
  }

  async function exchangePlaidToken(publicToken: string, institution: { name: string }) {
    await apiFetch('/api/plaid/exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_token: publicToken, institution })
    })
    await fetchPlaidItems()
  }

  async function syncTransactions() {
    isSyncing.value = true
    try {
      const res = await apiFetch('/api/plaid/sync-transactions', {
        method: 'POST'
      })
      const data = await res.json()
      await fetchTransactions()
      await fetchBudgets()
      return data.synced
    } finally {
      isSyncing.value = false
    }
  }

  async function disconnectPlaidItem(itemId: string) {
    await apiFetch(`/api/plaid/accounts/${itemId}`, {
      method: 'DELETE'
    })
    plaidItems.value = plaidItems.value.filter(i => i.item_id !== itemId)
  }

  async function updateTransactionCategory(id: number, category: string) {
    const res = await apiFetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    })
    const updated = await res.json()
    const index = transactions.value.findIndex(t => t.id === id)
    if (index >= 0) {
      transactions.value[index] = updated
    }
    await fetchBudgets()
  }

  async function fetchCategoryMappings() {
    const res = await apiFetch('/api/categories/mappings')
    categoryMappings.value = await res.json()
  }

  async function fetchPlaidCategories() {
    const res = await apiFetch('/api/categories/plaid-categories')
    plaidCategories.value = await res.json()
  }

  async function addCategoryMapping(plaidCategory: string, budgetCategory: string) {
    const res = await apiFetch('/api/categories/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plaid_category: plaidCategory, budget_category: budgetCategory })
    })
    const mapping = await res.json()
    const existingIndex = categoryMappings.value.findIndex(m => m.plaid_category === plaidCategory)
    if (existingIndex >= 0) {
      categoryMappings.value[existingIndex] = mapping
    } else {
      categoryMappings.value.push(mapping)
    }
  }

  async function deleteCategoryMapping(id: number) {
    await apiFetch(`/api/categories/mappings/${id}`, {
      method: 'DELETE'
    })
    categoryMappings.value = categoryMappings.value.filter(m => m.id !== id)
  }

  return {
    transactions,
    budgets,
    plaidItems,
    categoryMappings,
    plaidCategories,
    isSyncing,
    fetchTransactions,
    fetchBudgets,
    addTransaction,
    deleteTransaction,
    addBudget,
    deleteBudget,
    fetchPlaidItems,
    createLinkToken,
    exchangePlaidToken,
    syncTransactions,
    disconnectPlaidItem,
    updateTransactionCategory,
    fetchCategoryMappings,
    fetchPlaidCategories,
    addCategoryMapping,
    deleteCategoryMapping
  }
})
