// Budget store - commented out for Supabase migration (v1 scope: calendar, todos, grocery only)
// This will be revisited when budget features are added to the Supabase schema.

import { defineStore } from 'pinia'
import { ref } from 'vue'

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

export const useBudgetStore = defineStore('budget', () => {
  const transactions = ref<Transaction[]>([])
  const budgets = ref<Budget[]>([])

  return {
    transactions,
    budgets
  }
})
