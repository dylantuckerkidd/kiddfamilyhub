import { Router } from 'express'
import crypto from 'crypto'

const router = Router()

// In-memory token store: token -> { createdAt }
const tokens = new Map<string, { createdAt: number }>()

const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function isValidToken(token: string): boolean {
  const entry = tokens.get(token)
  if (!entry) return false
  if (Date.now() - entry.createdAt > TOKEN_MAX_AGE_MS) {
    tokens.delete(token)
    return false
  }
  return true
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { pin } = req.body
  const authPin = process.env.AUTH_PIN

  if (!authPin) {
    // No PIN configured — allow access (dev mode)
    const token = crypto.randomUUID()
    tokens.set(token, { createdAt: Date.now() })
    return res.json({ token })
  }

  if (!pin || pin !== authPin) {
    return res.status(401).json({ error: 'Invalid PIN' })
  }

  const token = crypto.randomUUID()
  tokens.set(token, { createdAt: Date.now() })
  res.json({ token })
})

// GET /api/auth/verify
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')

  if (!token || !isValidToken(token)) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  res.json({ valid: true })
})

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')

  if (token) {
    tokens.delete(token)
  }

  res.json({ ok: true })
})

export default router
