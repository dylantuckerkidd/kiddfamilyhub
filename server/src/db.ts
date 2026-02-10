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

  // Migration: add ical_uid column to calendar_events for iCloud sync
  const calCols = db.exec(`PRAGMA table_info(calendar_events)`)
  const hasIcalUid = calCols.length > 0 && calCols[0].values.some((row: any) => row[1] === 'ical_uid')
  if (!hasIcalUid) {
    db.run(`ALTER TABLE calendar_events ADD COLUMN ical_uid TEXT`)
  }

  // Migration: add sync_to_icloud column to calendar_events
  const hasSyncToIcloud = calCols.length > 0 && calCols[0].values.some((row: any) => row[1] === 'sync_to_icloud')
  if (!hasSyncToIcloud) {
    db.run(`ALTER TABLE calendar_events ADD COLUMN sync_to_icloud INTEGER DEFAULT 1`)
  }

  // Migration: add recurring_group_id column to calendar_events
  const hasRecurringGroupId = calCols.length > 0 && calCols[0].values.some((row: any) => row[1] === 'recurring_group_id')
  if (!hasRecurringGroupId) {
    db.run(`ALTER TABLE calendar_events ADD COLUMN recurring_group_id TEXT`)
  }

  // Migration: add event_type column to calendar_events (e.g. 'birthday')
  const hasEventType = calCols.length > 0 && calCols[0].values.some((row: any) => row[1] === 'event_type')
  if (!hasEventType) {
    db.run(`ALTER TABLE calendar_events ADD COLUMN event_type TEXT`)
  }

  // iCloud accounts table for multi-account support
  db.run(`
    CREATE TABLE IF NOT EXISTS icloud_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      email TEXT NOT NULL,
      app_password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Junction table: which events sync to which iCloud accounts
  db.run(`
    CREATE TABLE IF NOT EXISTS event_icloud_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      ical_uid TEXT,
      UNIQUE(event_id, account_id),
      FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES icloud_accounts(id) ON DELETE CASCADE
    )
  `)

  // Seed migration: if env vars exist and icloud_accounts is empty, create a default account
  // and migrate existing ical_uid rows into the junction table
  const icloudEmail = process.env.ICLOUD_EMAIL
  const icloudPassword = process.env.ICLOUD_APP_PASSWORD
  if (icloudEmail && icloudPassword) {
    const countResult = db.exec('SELECT COUNT(*) FROM icloud_accounts')
    const accountCount = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0
    if (accountCount === 0) {
      db.run('INSERT INTO icloud_accounts (label, email, app_password) VALUES (?, ?, ?)', ['Default', icloudEmail, icloudPassword])
      const idResult = db.exec('SELECT last_insert_rowid() as id')
      const accountId = idResult[0].values[0][0] as number

      // Migrate existing events with ical_uid into junction table
      const uidRows = db.exec('SELECT id, ical_uid FROM calendar_events WHERE ical_uid IS NOT NULL')
      if (uidRows.length > 0) {
        for (const row of uidRows[0].values) {
          const eventId = row[0]
          const icalUid = row[1]
          db.run('INSERT OR IGNORE INTO event_icloud_sync (event_id, account_id, ical_uid) VALUES (?, ?, ?)', [eventId, accountId, icalUid])
        }
      }
    }
  }

  // Add plaid_transaction_id column if it doesn't exist (migration for existing DBs)
  const cols = db.exec(`PRAGMA table_info(transactions)`)
  const hasPlaidCol = cols.length > 0 && cols[0].values.some((row: any) => row[1] === 'plaid_transaction_id')
  if (!hasPlaidCol) {
    db.run(`ALTER TABLE transactions ADD COLUMN plaid_transaction_id TEXT`)
  }

  // Seed major US holidays
  seedHolidays()

  saveDb()
  return db
}

// --- Holiday seeding helpers ---

/** Returns the nth occurrence of a weekday in a given month (1-indexed). weekday: 0=Sun..6=Sat */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month, 1).getDay()
  let day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  return day
}

/** Returns the last occurrence of a weekday in a given month. weekday: 0=Sun..6=Sat */
function lastWeekday(year: number, month: number, weekday: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const lastDow = new Date(year, month, lastDay).getDay()
  const diff = (lastDow - weekday + 7) % 7
  return lastDay - diff
}

/** Anonymous Gregorian computus — returns [month (0-indexed), day] for Easter Sunday */
function easterSunday(year: number): [number, number] {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return [month - 1, day] // convert to 0-indexed month
}

function seedHolidays() {
  const countResult = db.exec(`SELECT COUNT(*) FROM calendar_events WHERE event_type = 'holiday'`)
  const count = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0
  if (count > 0) return // already seeded

  const currentYear = new Date().getFullYear()
  const pad = (n: number) => String(n).padStart(2, '0')

  for (let year = currentYear; year < currentYear + 5; year++) {
    const holidays: [string, string][] = [] // [date, title]

    // Fixed-date holidays
    holidays.push([`${year}-01-01`, "New Year's Day"])
    holidays.push([`${year}-02-14`, "Valentine's Day"])
    holidays.push([`${year}-06-19`, 'Juneteenth'])
    holidays.push([`${year}-07-04`, 'Independence Day'])
    holidays.push([`${year}-10-31`, 'Halloween'])
    holidays.push([`${year}-11-11`, "Veterans Day"])
    holidays.push([`${year}-12-24`, 'Christmas Eve'])
    holidays.push([`${year}-12-25`, 'Christmas Day'])
    holidays.push([`${year}-12-31`, "New Year's Eve"])

    // Floating holidays
    // MLK Day: 3rd Monday in January
    holidays.push([`${year}-01-${pad(nthWeekday(year, 0, 1, 3))}`, 'MLK Day'])
    // Presidents' Day: 3rd Monday in February
    holidays.push([`${year}-02-${pad(nthWeekday(year, 1, 1, 3))}`, "Presidents' Day"])
    // Easter Sunday
    const [eMonth, eDay] = easterSunday(year)
    holidays.push([`${year}-${pad(eMonth + 1)}-${pad(eDay)}`, 'Easter Sunday'])
    // Mother's Day: 2nd Sunday in May
    holidays.push([`${year}-05-${pad(nthWeekday(year, 4, 0, 2))}`, "Mother's Day"])
    // Memorial Day: last Monday in May
    holidays.push([`${year}-05-${pad(lastWeekday(year, 4, 1))}`, 'Memorial Day'])
    // Father's Day: 3rd Sunday in June
    holidays.push([`${year}-06-${pad(nthWeekday(year, 5, 0, 3))}`, "Father's Day"])
    // Labor Day: 1st Monday in September
    holidays.push([`${year}-09-${pad(nthWeekday(year, 8, 1, 1))}`, 'Labor Day'])
    // Thanksgiving: 4th Thursday in November
    holidays.push([`${year}-11-${pad(nthWeekday(year, 10, 4, 4))}`, 'Thanksgiving'])

    for (const [date, title] of holidays) {
      db.run(
        `INSERT INTO calendar_events (title, date, all_day, event_type) VALUES (?, ?, 1, 'holiday')`,
        [title, date]
      )
    }
  }
}

export function getDb(): Database {
  return db
}

export function saveDb() {
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)
}
