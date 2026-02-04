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

  async function fetchTransactions() {
    const res = await fetch('/api/transactions')
    transactions.value = await res.json()
  }

  async function fetchBudgets() {
    const res = await fetch('/api/budgets')
    budgets.value = await res.json()
  }

  async function addTransaction(transaction: Omit<Transaction, 'id'>) {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    })
    const newTransaction = await res.json()
    transactions.value.push(newTransaction)
  }

  return {
    transactions,
    budgets,
    fetchTransactions,
    fetchBudgets,
    addTransaction
  }
})
