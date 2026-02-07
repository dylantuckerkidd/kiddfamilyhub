import 'dotenv/config'
import { Router } from 'express'
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'
import { getDb, saveDb } from '../db.js'

const router = Router()

function getPlaidClient() {
  const configuration = new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  })
  return new PlaidApi(configuration)
}

// Create a link token to initialize Plaid Link
router.post('/create-link-token', async (req, res) => {
  try {
    const response = await getPlaidClient().linkTokenCreate({
      user: { client_user_id: 'user-1' },
      client_name: 'Budget App',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })
    res.json({ link_token: response.data.link_token })
  } catch (error: any) {
    console.error('Error creating link token:', error.response?.data || error.message)
    res.status(500).json({ error: 'Failed to create link token' })
  }
})

// Exchange public token for access token after user connects bank
router.post('/exchange-token', async (req, res) => {
  const { public_token, institution } = req.body

  try {
    const response = await getPlaidClient().itemPublicTokenExchange({
      public_token,
    })

    const accessToken = response.data.access_token
    const itemId = response.data.item_id

    // Store the access token in the database
    const db = getDb()
    db.run(`
      INSERT OR REPLACE INTO plaid_items (item_id, access_token, institution_name)
      VALUES (?, ?, ?)
    `, [itemId, accessToken, institution?.name || 'Unknown'])
    saveDb()

    res.json({ success: true, item_id: itemId })
  } catch (error: any) {
    console.error('Error exchanging token:', error.response?.data || error.message)
    res.status(500).json({ error: 'Failed to exchange token' })
  }
})

// Get connected accounts
router.get('/accounts', async (_, res) => {
  const db = getDb()
  const stmt = db.prepare('SELECT item_id, institution_name, created_at FROM plaid_items')

  const items = []
  while (stmt.step()) {
    items.push(stmt.getAsObject())
  }
  stmt.free()

  res.json(items)
})

// Sync transactions from Plaid using transactionsSync API
router.post('/sync-transactions', async (_, res) => {
  const db = getDb()

  // Load category mappings
  const mappingStmt = db.prepare('SELECT plaid_category, budget_category FROM category_mappings')
  const categoryMap = new Map<string, string>()
  while (mappingStmt.step()) {
    const row = mappingStmt.getAsObject() as { plaid_category: string; budget_category: string }
    categoryMap.set(row.plaid_category, row.budget_category)
  }
  mappingStmt.free()

  const stmt = db.prepare('SELECT item_id, access_token, sync_cursor FROM plaid_items')

  const items: { item_id: string; access_token: string; sync_cursor: string | null }[] = []
  while (stmt.step()) {
    items.push(stmt.getAsObject() as any)
  }
  stmt.free()

  if (items.length === 0) {
    return res.json({ synced: 0, message: 'No connected accounts' })
  }

  let totalSynced = 0
  const errors: string[] = []

  for (const item of items) {
    try {
      let hasMore = true
      let cursor = item.sync_cursor || undefined

      while (hasMore) {
        const response = await getPlaidClient().transactionsSync({
          access_token: item.access_token,
          cursor,
        })

        const { added, next_cursor, has_more } = response.data

        // Process added transactions
        for (const txn of added) {
          const existing = db.exec(
            `SELECT id FROM transactions WHERE plaid_transaction_id = ?`,
            [txn.transaction_id]
          )

          if (existing.length === 0 || existing[0].values.length === 0) {
            const type = txn.amount > 0 ? 'expense' : 'income'
            const amount = Math.abs(txn.amount)
            const plaidCategory = txn.personal_finance_category?.primary || 'Uncategorized'
            // Use mapped category if available, otherwise use Plaid category
            const category = categoryMap.get(plaidCategory) || plaidCategory

            db.run(`
              INSERT INTO transactions (amount, description, category, date, type, plaid_transaction_id)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              amount,
              txn.name || txn.merchant_name || 'Unknown',
              category,
              txn.date,
              type,
              txn.transaction_id
            ])
            totalSynced++
          }
        }

        // Update cursor for next sync
        cursor = next_cursor
        hasMore = has_more
      }

      // Save cursor for incremental syncs
      db.run('UPDATE plaid_items SET sync_cursor = ? WHERE item_id = ?', [cursor || null, item.item_id])
    } catch (error: any) {
      const errMsg = error.response?.data?.error_message || error.message
      console.error(`Error syncing item ${item.item_id}:`, error.response?.data || error.message)
      errors.push(errMsg)
    }
  }

  saveDb()
  res.json({ synced: totalSynced, errors: errors.length > 0 ? errors : undefined })
})

// Disconnect a bank account
router.delete('/accounts/:itemId', async (req, res) => {
  const { itemId } = req.params
  const db = getDb()

  // Get access token to remove from Plaid
  const result = db.exec('SELECT access_token FROM plaid_items WHERE item_id = ?', [itemId])

  if (result.length > 0 && result[0].values.length > 0) {
    const accessToken = result[0].values[0][0] as string
    try {
      await getPlaidClient().itemRemove({ access_token: accessToken })
    } catch (error) {
      // Continue even if Plaid removal fails
    }
  }

  db.run('DELETE FROM plaid_items WHERE item_id = ?', [itemId])
  saveDb()

  res.status(204).send()
})

export default router
