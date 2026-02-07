import initSqlJs, { Database } from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dataDir = join(__dirname, '..', '..', 'data')
const dbPath = join(dataDir, 'budget.db')

let db: Database

export async function initDb(): Promise<Database> {
  const SQL = await initSqlJs()

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
      plaid_transaction_id TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS plaid_items (
      item_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      institution_name TEXT,
      sync_cursor TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Add sync_cursor column if it doesn't exist (migration for existing DBs)
  const plaidCols = db.exec(`PRAGMA table_info(plaid_items)`)
  const hasSyncCursor = plaidCols.length > 0 && plaidCols[0].values.some((row: any) => row[1] === 'sync_cursor')
  if (!hasSyncCursor) {
    db.run(`ALTER TABLE plaid_items ADD COLUMN sync_cursor TEXT`)
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL UNIQUE,
      amount_limit REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS category_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plaid_category TEXT NOT NULL UNIQUE,
      budget_category TEXT NOT NULL
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)`)

  // Family members table
  db.run(`
    CREATE TABLE IF NOT EXISTS family_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Calendar events table
  db.run(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      time TEXT,
      end_date TEXT,
      end_time TEXT,
      all_day INTEGER DEFAULT 1,
      person_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES family_members(id) ON DELETE SET NULL
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date)`)

  // Grocery list table
  db.run(`
    CREATE TABLE IF NOT EXISTS grocery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity REAL,
      unit TEXT,
      category TEXT,
      checked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Grocery item name history for autocomplete suggestions
  db.run(`
    CREATE TABLE IF NOT EXISTS grocery_item_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      category TEXT,
      use_count INTEGER DEFAULT 1,
      last_used TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Todo categories table
  db.run(`
    CREATE TABLE IF NOT EXISTS todo_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Todo list table
  db.run(`
    CREATE TABLE IF NOT EXISTS todo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER DEFAULT 0,
      person_id INTEGER,
      due_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES family_members(id) ON DELETE SET NULL
    )
  `)

  // Todo subtasks table
  db.run(`
    CREATE TABLE IF NOT EXISTS todo_subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (todo_id) REFERENCES todo_items(id) ON DELETE CASCADE
    )
  `)

  // Migration: add category_id and sort_order to todo_items
  const todoCols = db.exec(`PRAGMA table_info(todo_items)`)
  const hasCategoryId = todoCols.length > 0 && todoCols[0].values.some((row: any) => row[1] === 'category_id')
  if (!hasCategoryId) {
    db.run(`ALTER TABLE todo_items ADD COLUMN category_id INTEGER REFERENCES todo_categories(id) ON DELETE SET NULL`)
  }
  const hasTodoSortOrder = todoCols.length > 0 && todoCols[0].values.some((row: any) => row[1] === 'sort_order')
  if (!hasTodoSortOrder) {
    db.run(`ALTER TABLE todo_items ADD COLUMN sort_order INTEGER DEFAULT 0`)
  }

  // Add category column to grocery_item_history if it doesn't exist (migration)
  const histCols = db.exec(`PRAGMA table_info(grocery_item_history)`)
  const hasHistCategory = histCols.length > 0 && histCols[0].values.some((row: any) => row[1] === 'category')
  if (!hasHistCategory) {
    db.run(`ALTER TABLE grocery_item_history ADD COLUMN category TEXT`)
  }

  // Seed common grocery items for autocomplete (use_count=0 so user items rank higher)
  const seedItems: [string, string][] = [
    // Produce
    ['Apples', 'Produce'], ['Bananas', 'Produce'], ['Oranges', 'Produce'], ['Lemons', 'Produce'],
    ['Limes', 'Produce'], ['Avocado', 'Produce'], ['Tomatoes', 'Produce'], ['Potatoes', 'Produce'],
    ['Onions', 'Produce'], ['Garlic', 'Produce'], ['Lettuce', 'Produce'], ['Spinach', 'Produce'],
    ['Kale', 'Produce'], ['Broccoli', 'Produce'], ['Carrots', 'Produce'], ['Celery', 'Produce'],
    ['Cucumber', 'Produce'], ['Bell Pepper', 'Produce'], ['Mushrooms', 'Produce'], ['Corn', 'Produce'],
    ['Grapes', 'Produce'], ['Strawberries', 'Produce'], ['Blueberries', 'Produce'], ['Watermelon', 'Produce'],
    ['Mango', 'Produce'], ['Pineapple', 'Produce'], ['Peaches', 'Produce'], ['Pears', 'Produce'],
    ['Ginger', 'Produce'], ['Cilantro', 'Produce'], ['Basil', 'Produce'], ['Green Onions', 'Produce'],
    ['Jalapeño', 'Produce'], ['Zucchini', 'Produce'], ['Sweet Potatoes', 'Produce'],
    // Dairy
    ['Milk', 'Dairy'], ['Cheese', 'Dairy'], ['Butter', 'Dairy'], ['Yogurt', 'Dairy'],
    ['Cream Cheese', 'Dairy'], ['Sour Cream', 'Dairy'], ['Eggs', 'Dairy'], ['Heavy Cream', 'Dairy'],
    ['Half and Half', 'Dairy'], ['Cottage Cheese', 'Dairy'], ['Cheddar', 'Dairy'],
    ['Mozzarella', 'Dairy'], ['Parmesan', 'Dairy'], ['Shredded Cheese', 'Dairy'],
    // Meat
    ['Chicken', 'Meat'], ['Chicken Breast', 'Meat'], ['Chicken Thighs', 'Meat'],
    ['Ground Beef', 'Meat'], ['Ground Turkey', 'Meat'], ['Beef', 'Meat'], ['Pork', 'Meat'],
    ['Bacon', 'Meat'], ['Sausage', 'Meat'], ['Steak', 'Meat'], ['Ham', 'Meat'],
    ['Salmon', 'Meat'], ['Shrimp', 'Meat'], ['Tuna', 'Meat'], ['Turkey', 'Meat'],
    ['Hot Dogs', 'Meat'], ['Deli Meat', 'Meat'],
    // Bakery
    ['Bread', 'Bakery'], ['Bagels', 'Bakery'], ['Tortillas', 'Bakery'], ['Buns', 'Bakery'],
    ['Rolls', 'Bakery'], ['Muffins', 'Bakery'], ['Croissants', 'Bakery'], ['Pita', 'Bakery'],
    ['English Muffins', 'Bakery'],
    // Frozen
    ['Ice Cream', 'Frozen'], ['Frozen Pizza', 'Frozen'], ['Frozen Vegetables', 'Frozen'],
    ['Frozen Fruit', 'Frozen'], ['Frozen Waffles', 'Frozen'],
    // Pantry
    ['Rice', 'Pantry'], ['Pasta', 'Pantry'], ['Flour', 'Pantry'], ['Sugar', 'Pantry'],
    ['Olive Oil', 'Pantry'], ['Vegetable Oil', 'Pantry'], ['Soy Sauce', 'Pantry'],
    ['Vinegar', 'Pantry'], ['Honey', 'Pantry'], ['Peanut Butter', 'Pantry'], ['Jelly', 'Pantry'],
    ['Ketchup', 'Pantry'], ['Mustard', 'Pantry'], ['Mayo', 'Pantry'], ['Hot Sauce', 'Pantry'],
    ['Cereal', 'Pantry'], ['Oatmeal', 'Pantry'], ['Beans', 'Pantry'], ['Canned Tomatoes', 'Pantry'],
    ['Tomato Sauce', 'Pantry'], ['Chicken Broth', 'Pantry'], ['Coconut Milk', 'Pantry'],
    ['Noodles', 'Pantry'], ['Crackers', 'Pantry'], ['Salsa', 'Pantry'], ['BBQ Sauce', 'Pantry'],
    ['Ranch', 'Pantry'], ['Maple Syrup', 'Pantry'], ['Salt', 'Pantry'], ['Pepper', 'Pantry'],
    // Beverages
    ['Water', 'Beverages'], ['Orange Juice', 'Beverages'], ['Apple Juice', 'Beverages'],
    ['Coffee', 'Beverages'], ['Tea', 'Beverages'], ['Soda', 'Beverages'],
    ['Sparkling Water', 'Beverages'], ['Lemonade', 'Beverages'], ['Almond Milk', 'Beverages'],
    ['Oat Milk', 'Beverages'],
    // Snacks
    ['Chips', 'Snacks'], ['Cookies', 'Snacks'], ['Pretzels', 'Snacks'], ['Popcorn', 'Snacks'],
    ['Granola Bars', 'Snacks'], ['Nuts', 'Snacks'], ['Trail Mix', 'Snacks'],
    ['Hummus', 'Snacks'], ['Goldfish', 'Snacks'], ['Fruit Snacks', 'Snacks'],
    // Household
    ['Paper Towels', 'Household'], ['Toilet Paper', 'Household'], ['Trash Bags', 'Household'],
    ['Dish Soap', 'Household'], ['Laundry Detergent', 'Household'], ['Sponges', 'Household'],
    ['Aluminum Foil', 'Household'], ['Plastic Wrap', 'Household'], ['Napkins', 'Household'],
    ['Zip Bags', 'Household'], ['Hand Soap', 'Household'], ['Tissues', 'Household'],
  ]
  for (const [name, category] of seedItems) {
    db.run(
      `INSERT OR IGNORE INTO grocery_item_history (name, category, use_count) VALUES (?, ?, 0)`,
      [name, category, ]
    )
  }

  // Add plaid_transaction_id column if it doesn't exist (migration for existing DBs)
  const cols = db.exec(`PRAGMA table_info(transactions)`)
  const hasPlaidCol = cols.length > 0 && cols[0].values.some((row: any) => row[1] === 'plaid_transaction_id')
  if (!hasPlaidCol) {
    db.run(`ALTER TABLE transactions ADD COLUMN plaid_transaction_id TEXT`)
  }

  saveDb()
  return db
}

export function getDb(): Database {
  return db
}

export function saveDb() {
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)
}
