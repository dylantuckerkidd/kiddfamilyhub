-- Supabase Schema Migration for Family Hub
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- ============================================
-- 1. TABLES
-- ============================================

-- Family Members
CREATE TABLE family_members (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar Events
CREATE TABLE calendar_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  time TEXT,
  end_date TEXT,
  end_time TEXT,
  all_day BOOLEAN DEFAULT TRUE,
  person_id BIGINT REFERENCES family_members(id) ON DELETE SET NULL,
  recurring_group_id TEXT,
  event_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_date ON calendar_events(date);
CREATE INDEX idx_calendar_events_user ON calendar_events(user_id);

-- Grocery Items
CREATE TABLE grocery_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  category TEXT,
  checked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grocery_items_user ON grocery_items(user_id);

-- Grocery Item History (for autocomplete suggestions)
CREATE TABLE grocery_item_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  use_count INTEGER DEFAULT 1,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_grocery_history_user ON grocery_item_history(user_id);
CREATE INDEX idx_grocery_history_name ON grocery_item_history(name);

-- Todo Categories
CREATE TABLE todo_categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Todo Items
CREATE TABLE todo_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  person_id BIGINT REFERENCES family_members(id) ON DELETE SET NULL,
  due_date TEXT,
  category_id BIGINT REFERENCES todo_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_todo_items_user ON todo_items(user_id);

-- Todo Subtasks
CREATE TABLE todo_subtasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  todo_id BIGINT NOT NULL REFERENCES todo_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_todo_subtasks_todo ON todo_subtasks(todo_id);

-- ============================================
-- 1.5 AUTO-SET user_id ON INSERT
-- ============================================

-- Trigger function to automatically set user_id from auth context
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_user_id_family_members BEFORE INSERT ON family_members FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER set_user_id_calendar_events BEFORE INSERT ON calendar_events FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER set_user_id_grocery_items BEFORE INSERT ON grocery_items FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER set_user_id_todo_categories BEFORE INSERT ON todo_categories FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER set_user_id_todo_items BEFORE INSERT ON todo_items FOR EACH ROW EXECUTE FUNCTION set_user_id();

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_item_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_subtasks ENABLE ROW LEVEL SECURITY;

-- Standard policy: users can only access their own data
CREATE POLICY "users_own_data" ON family_members
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON calendar_events
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON grocery_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grocery history: users see their own + global seed data (user_id IS NULL)
CREATE POLICY "users_own_and_global" ON grocery_item_history
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "users_insert_own" ON grocery_item_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own" ON grocery_item_history
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own" ON grocery_item_history
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON todo_categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON todo_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Subtasks: RLS via parent todo_item ownership
CREATE POLICY "users_own_via_parent" ON todo_subtasks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM todo_items WHERE id = todo_subtasks.todo_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM todo_items WHERE id = todo_subtasks.todo_id AND user_id = auth.uid()));

-- ============================================
-- 3. VIEWS (preserve data shapes for frontend)
-- ============================================

-- Calendar events with person info
-- NOTE: security_invoker ensures RLS on underlying tables is enforced
CREATE VIEW calendar_events_with_person
WITH (security_invoker = true)
AS
SELECT
  e.*,
  m.name AS person_name,
  m.color AS person_color
FROM calendar_events e
LEFT JOIN family_members m ON e.person_id = m.id;

-- Todos with person, category, and subtask counts
CREATE VIEW todo_items_full
WITH (security_invoker = true)
AS
SELECT
  t.*,
  m.name AS person_name,
  m.color AS person_color,
  c.name AS category_name,
  c.color AS category_color,
  COALESCE((SELECT COUNT(*) FROM todo_subtasks s WHERE s.todo_id = t.id), 0) AS subtask_count,
  COALESCE((SELECT COUNT(*) FROM todo_subtasks s WHERE s.todo_id = t.id AND s.completed = TRUE), 0) AS subtask_completed_count
FROM todo_items t
LEFT JOIN family_members m ON t.person_id = m.id
LEFT JOIN todo_categories c ON t.category_id = c.id;

-- ============================================
-- 4. RPC FUNCTIONS
-- ============================================

-- Get grocery suggestions (ILIKE prefix search)
CREATE OR REPLACE FUNCTION get_grocery_suggestions(query TEXT)
RETURNS TABLE(name TEXT, category TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.name, h.category
  FROM grocery_item_history h
  WHERE h.name ILIKE query || '%'
    AND (h.user_id = auth.uid() OR h.user_id IS NULL)
  ORDER BY
    CASE WHEN h.user_id = auth.uid() THEN 0 ELSE 1 END,
    h.use_count DESC,
    h.name
  LIMIT 10;
$$;

-- Add grocery item with auto-category from history + upsert history
CREATE OR REPLACE FUNCTION add_grocery_item(
  p_name TEXT,
  p_quantity REAL DEFAULT NULL,
  p_unit TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS grocery_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_category TEXT;
  new_item grocery_items;
BEGIN
  -- Resolve category: use provided, or look up from history
  IF p_category IS NOT NULL AND p_category != '' THEN
    resolved_category := p_category;
  ELSE
    SELECT h.category INTO resolved_category
    FROM grocery_item_history h
    WHERE h.name ILIKE p_name
      AND h.category IS NOT NULL
      AND (h.user_id = auth.uid() OR h.user_id IS NULL)
    ORDER BY
      CASE WHEN h.user_id = auth.uid() THEN 0 ELSE 1 END,
      h.use_count DESC
    LIMIT 1;
  END IF;

  -- Insert the grocery item
  INSERT INTO grocery_items (user_id, name, quantity, unit, category, checked)
  VALUES (auth.uid(), p_name, p_quantity, p_unit, resolved_category, FALSE)
  RETURNING * INTO new_item;

  -- Upsert history for this user
  INSERT INTO grocery_item_history (user_id, name, category, use_count, last_used)
  VALUES (auth.uid(), p_name, resolved_category, 1, NOW())
  ON CONFLICT (user_id, name)
  DO UPDATE SET
    use_count = grocery_item_history.use_count + 1,
    last_used = NOW(),
    category = COALESCE(EXCLUDED.category, grocery_item_history.category);

  RETURN new_item;
END;
$$;

-- Reorder todos by ID array
CREATE OR REPLACE FUNCTION reorder_todos(ids BIGINT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(ids, 1) LOOP
    UPDATE todo_items
    SET sort_order = i - 1
    WHERE id = ids[i] AND user_id = auth.uid();
  END LOOP;
END;
$$;

-- Reorder subtasks by ID array
CREATE OR REPLACE FUNCTION reorder_subtasks(p_todo_id BIGINT, ids BIGINT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
BEGIN
  -- Verify ownership of parent todo
  IF NOT EXISTS (SELECT 1 FROM todo_items WHERE id = p_todo_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR i IN 1..array_length(ids, 1) LOOP
    UPDATE todo_subtasks
    SET sort_order = i - 1
    WHERE id = ids[i] AND todo_id = p_todo_id;
  END LOOP;
END;
$$;

-- ============================================
-- 5. SEED GROCERY ITEM HISTORY (global, user_id = NULL)
-- ============================================

INSERT INTO grocery_item_history (user_id, name, category, use_count) VALUES
  -- Produce
  (NULL, 'Apples', 'Produce', 0), (NULL, 'Bananas', 'Produce', 0), (NULL, 'Oranges', 'Produce', 0),
  (NULL, 'Lemons', 'Produce', 0), (NULL, 'Limes', 'Produce', 0), (NULL, 'Avocado', 'Produce', 0),
  (NULL, 'Tomatoes', 'Produce', 0), (NULL, 'Potatoes', 'Produce', 0), (NULL, 'Onions', 'Produce', 0),
  (NULL, 'Garlic', 'Produce', 0), (NULL, 'Lettuce', 'Produce', 0), (NULL, 'Spinach', 'Produce', 0),
  (NULL, 'Kale', 'Produce', 0), (NULL, 'Broccoli', 'Produce', 0), (NULL, 'Carrots', 'Produce', 0),
  (NULL, 'Celery', 'Produce', 0), (NULL, 'Cucumber', 'Produce', 0), (NULL, 'Bell Pepper', 'Produce', 0),
  (NULL, 'Mushrooms', 'Produce', 0), (NULL, 'Corn', 'Produce', 0), (NULL, 'Grapes', 'Produce', 0),
  (NULL, 'Strawberries', 'Produce', 0), (NULL, 'Blueberries', 'Produce', 0), (NULL, 'Watermelon', 'Produce', 0),
  (NULL, 'Mango', 'Produce', 0), (NULL, 'Pineapple', 'Produce', 0), (NULL, 'Peaches', 'Produce', 0),
  (NULL, 'Pears', 'Produce', 0), (NULL, 'Ginger', 'Produce', 0), (NULL, 'Cilantro', 'Produce', 0),
  (NULL, 'Basil', 'Produce', 0), (NULL, 'Green Onions', 'Produce', 0), (NULL, 'Jalapeño', 'Produce', 0),
  (NULL, 'Zucchini', 'Produce', 0), (NULL, 'Sweet Potatoes', 'Produce', 0),
  -- Dairy
  (NULL, 'Milk', 'Dairy', 0), (NULL, 'Cheese', 'Dairy', 0), (NULL, 'Butter', 'Dairy', 0),
  (NULL, 'Yogurt', 'Dairy', 0), (NULL, 'Cream Cheese', 'Dairy', 0), (NULL, 'Sour Cream', 'Dairy', 0),
  (NULL, 'Eggs', 'Dairy', 0), (NULL, 'Heavy Cream', 'Dairy', 0), (NULL, 'Half and Half', 'Dairy', 0),
  (NULL, 'Cottage Cheese', 'Dairy', 0), (NULL, 'Cheddar', 'Dairy', 0), (NULL, 'Mozzarella', 'Dairy', 0),
  (NULL, 'Parmesan', 'Dairy', 0), (NULL, 'Shredded Cheese', 'Dairy', 0),
  -- Meat
  (NULL, 'Chicken', 'Meat', 0), (NULL, 'Chicken Breast', 'Meat', 0), (NULL, 'Chicken Thighs', 'Meat', 0),
  (NULL, 'Ground Beef', 'Meat', 0), (NULL, 'Ground Turkey', 'Meat', 0), (NULL, 'Beef', 'Meat', 0),
  (NULL, 'Pork', 'Meat', 0), (NULL, 'Bacon', 'Meat', 0), (NULL, 'Sausage', 'Meat', 0),
  (NULL, 'Steak', 'Meat', 0), (NULL, 'Ham', 'Meat', 0), (NULL, 'Salmon', 'Meat', 0),
  (NULL, 'Shrimp', 'Meat', 0), (NULL, 'Tuna', 'Meat', 0), (NULL, 'Turkey', 'Meat', 0),
  (NULL, 'Hot Dogs', 'Meat', 0), (NULL, 'Deli Meat', 'Meat', 0),
  -- Bakery
  (NULL, 'Bread', 'Bakery', 0), (NULL, 'Bagels', 'Bakery', 0), (NULL, 'Tortillas', 'Bakery', 0),
  (NULL, 'Buns', 'Bakery', 0), (NULL, 'Rolls', 'Bakery', 0), (NULL, 'Muffins', 'Bakery', 0),
  (NULL, 'Croissants', 'Bakery', 0), (NULL, 'Pita', 'Bakery', 0), (NULL, 'English Muffins', 'Bakery', 0),
  -- Frozen
  (NULL, 'Ice Cream', 'Frozen', 0), (NULL, 'Frozen Pizza', 'Frozen', 0), (NULL, 'Frozen Vegetables', 'Frozen', 0),
  (NULL, 'Frozen Fruit', 'Frozen', 0), (NULL, 'Frozen Waffles', 'Frozen', 0),
  -- Pantry
  (NULL, 'Rice', 'Pantry', 0), (NULL, 'Pasta', 'Pantry', 0), (NULL, 'Flour', 'Pantry', 0),
  (NULL, 'Sugar', 'Pantry', 0), (NULL, 'Olive Oil', 'Pantry', 0), (NULL, 'Vegetable Oil', 'Pantry', 0),
  (NULL, 'Soy Sauce', 'Pantry', 0), (NULL, 'Vinegar', 'Pantry', 0), (NULL, 'Honey', 'Pantry', 0),
  (NULL, 'Peanut Butter', 'Pantry', 0), (NULL, 'Jelly', 'Pantry', 0), (NULL, 'Ketchup', 'Pantry', 0),
  (NULL, 'Mustard', 'Pantry', 0), (NULL, 'Mayo', 'Pantry', 0), (NULL, 'Hot Sauce', 'Pantry', 0),
  (NULL, 'Cereal', 'Pantry', 0), (NULL, 'Oatmeal', 'Pantry', 0), (NULL, 'Beans', 'Pantry', 0),
  (NULL, 'Canned Tomatoes', 'Pantry', 0), (NULL, 'Tomato Sauce', 'Pantry', 0),
  (NULL, 'Chicken Broth', 'Pantry', 0), (NULL, 'Coconut Milk', 'Pantry', 0),
  (NULL, 'Noodles', 'Pantry', 0), (NULL, 'Crackers', 'Pantry', 0), (NULL, 'Salsa', 'Pantry', 0),
  (NULL, 'BBQ Sauce', 'Pantry', 0), (NULL, 'Ranch', 'Pantry', 0), (NULL, 'Maple Syrup', 'Pantry', 0),
  (NULL, 'Salt', 'Pantry', 0), (NULL, 'Pepper', 'Pantry', 0),
  -- Beverages
  (NULL, 'Water', 'Beverages', 0), (NULL, 'Orange Juice', 'Beverages', 0), (NULL, 'Apple Juice', 'Beverages', 0),
  (NULL, 'Coffee', 'Beverages', 0), (NULL, 'Tea', 'Beverages', 0), (NULL, 'Soda', 'Beverages', 0),
  (NULL, 'Sparkling Water', 'Beverages', 0), (NULL, 'Lemonade', 'Beverages', 0),
  (NULL, 'Almond Milk', 'Beverages', 0), (NULL, 'Oat Milk', 'Beverages', 0),
  -- Snacks
  (NULL, 'Chips', 'Snacks', 0), (NULL, 'Cookies', 'Snacks', 0), (NULL, 'Pretzels', 'Snacks', 0),
  (NULL, 'Popcorn', 'Snacks', 0), (NULL, 'Granola Bars', 'Snacks', 0), (NULL, 'Nuts', 'Snacks', 0),
  (NULL, 'Trail Mix', 'Snacks', 0), (NULL, 'Hummus', 'Snacks', 0), (NULL, 'Goldfish', 'Snacks', 0),
  (NULL, 'Fruit Snacks', 'Snacks', 0),
  -- Household
  (NULL, 'Paper Towels', 'Household', 0), (NULL, 'Toilet Paper', 'Household', 0),
  (NULL, 'Trash Bags', 'Household', 0), (NULL, 'Dish Soap', 'Household', 0),
  (NULL, 'Laundry Detergent', 'Household', 0), (NULL, 'Sponges', 'Household', 0),
  (NULL, 'Aluminum Foil', 'Household', 0), (NULL, 'Plastic Wrap', 'Household', 0),
  (NULL, 'Napkins', 'Household', 0), (NULL, 'Zip Bags', 'Household', 0),
  (NULL, 'Hand Soap', 'Household', 0), (NULL, 'Tissues', 'Household', 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. MAINTENANCE LOG TABLES
-- ============================================

-- Maintenance Categories
CREATE TABLE maintenance_categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_user_id_maintenance_categories BEFORE INSERT ON maintenance_categories FOR EACH ROW EXECUTE FUNCTION set_user_id();

ALTER TABLE maintenance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_data" ON maintenance_categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Maintenance Items
CREATE TABLE maintenance_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category_id BIGINT REFERENCES maintenance_categories(id) ON DELETE SET NULL,
  person_id BIGINT REFERENCES family_members(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  frequency_days INTEGER,
  next_due_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_user_id_maintenance_items BEFORE INSERT ON maintenance_items FOR EACH ROW EXECUTE FUNCTION set_user_id();

ALTER TABLE maintenance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_data" ON maintenance_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Maintenance History
CREATE TABLE maintenance_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES maintenance_items(id) ON DELETE CASCADE,
  completed_date TEXT NOT NULL,
  notes TEXT,
  cost REAL,
  person_id BIGINT REFERENCES family_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;

-- RLS via parent item ownership
CREATE POLICY "users_own_via_parent" ON maintenance_history
  FOR ALL
  USING (EXISTS (SELECT 1 FROM maintenance_items WHERE id = maintenance_history.item_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM maintenance_items WHERE id = maintenance_history.item_id AND user_id = auth.uid()));

-- View: maintenance items with category, person, and last completed date
CREATE VIEW maintenance_items_full
WITH (security_invoker = true)
AS
SELECT
  i.*,
  c.name AS category_name,
  c.icon AS category_icon,
  m.name AS person_name,
  m.color AS person_color,
  (SELECT MAX(h.completed_date) FROM maintenance_history h WHERE h.item_id = i.id) AS last_completed
FROM maintenance_items i
LEFT JOIN maintenance_categories c ON i.category_id = c.id
LEFT JOIN family_members m ON i.person_id = m.id;

-- View: maintenance history with person info
CREATE VIEW maintenance_history_with_person
WITH (security_invoker = true)
AS
SELECT
  h.*,
  m.name AS person_name,
  m.color AS person_color
FROM maintenance_history h
LEFT JOIN family_members m ON h.person_id = m.id;

-- RPC: Complete a maintenance item (insert history + auto-calculate next due date)
CREATE OR REPLACE FUNCTION complete_maintenance_item(
  p_item_id BIGINT,
  p_completed_date TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_cost REAL DEFAULT NULL,
  p_person_id BIGINT DEFAULT NULL
)
RETURNS maintenance_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item maintenance_items;
  v_history maintenance_history;
  v_next_date DATE;
  v_freq_days INTEGER;
  v_completed DATE;
BEGIN
  -- Verify ownership
  SELECT * INTO v_item FROM maintenance_items WHERE id = p_item_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized or item not found';
  END IF;

  v_completed := COALESCE(p_completed_date::DATE, CURRENT_DATE);

  -- Insert history record
  INSERT INTO maintenance_history (item_id, completed_date, notes, cost, person_id)
  VALUES (p_item_id, COALESCE(p_completed_date, CURRENT_DATE::TEXT), p_notes, p_cost, p_person_id)
  RETURNING * INTO v_history;

  -- Calculate next due date based on frequency
  CASE v_item.frequency
    WHEN 'weekly' THEN v_freq_days := 7;
    WHEN 'monthly' THEN v_freq_days := 30;
    WHEN 'quarterly' THEN v_freq_days := 90;
    WHEN 'biannual' THEN v_freq_days := 180;
    WHEN 'annual' THEN v_freq_days := 365;
    WHEN 'custom' THEN v_freq_days := COALESCE(v_item.frequency_days, 30);
    ELSE v_freq_days := 30;
  END CASE;

  v_next_date := v_completed + v_freq_days;

  UPDATE maintenance_items
  SET next_due_date = v_next_date::TEXT
  WHERE id = p_item_id;

  RETURN v_history;
END;
$$;

-- NOTE: Default maintenance categories should be seeded per-user
-- via the client when they first access the maintenance feature.

-- ============================================
-- 6.5 SEED HOLIDAYS PER USER
-- ============================================

-- Helper: nth weekday of a month (1-indexed). weekday: 0=Sun..6=Sat
CREATE OR REPLACE FUNCTION nth_weekday(p_year INT, p_month INT, p_weekday INT, p_n INT)
RETURNS INT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  first_dow INT;
  day_val INT;
BEGIN
  first_dow := EXTRACT(DOW FROM make_date(p_year, p_month, 1))::INT;
  day_val := 1 + ((p_weekday - first_dow + 7) % 7) + (p_n - 1) * 7;
  RETURN day_val;
END;
$$;

-- Helper: last weekday of a month
CREATE OR REPLACE FUNCTION last_weekday(p_year INT, p_month INT, p_weekday INT)
RETURNS INT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  last_day INT;
  last_dow INT;
BEGIN
  last_day := EXTRACT(DAY FROM (make_date(p_year, p_month + 1, 1) - INTERVAL '1 day'))::INT;
  last_dow := EXTRACT(DOW FROM make_date(p_year, p_month, last_day))::INT;
  RETURN last_day - ((last_dow - p_weekday + 7) % 7);
END;
$$;

-- Helper: Easter Sunday via anonymous Gregorian computus
CREATE OR REPLACE FUNCTION easter_sunday(p_year INT)
RETURNS DATE
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  a INT; b INT; c INT; d INT; e INT; f INT; g INT;
  h INT; i INT; k INT; l INT; m INT;
  month_val INT; day_val INT;
BEGIN
  a := p_year % 19;
  b := p_year / 100;
  c := p_year % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  month_val := (h + l - 7 * m + 114) / 31;
  day_val := ((h + l - 7 * m + 114) % 31) + 1;
  RETURN make_date(p_year, month_val, day_val);
END;
$$;

-- Seed US holidays for the current user (5 years)
CREATE OR REPLACE FUNCTION seed_holidays()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr INT;
  cur_year INT;
  easter DATE;
BEGIN
  -- Skip if user already has holidays
  IF EXISTS (SELECT 1 FROM calendar_events WHERE user_id = auth.uid() AND event_type = 'holiday' LIMIT 1) THEN
    RETURN;
  END IF;

  cur_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;

  FOR yr IN cur_year..(cur_year + 4) LOOP
    easter := easter_sunday(yr);

    INSERT INTO calendar_events (user_id, title, date, all_day, event_type) VALUES
      (auth.uid(), 'New Year''s Day',   yr || '-01-01', TRUE, 'holiday'),
      (auth.uid(), 'MLK Day',           yr || '-01-' || LPAD(nth_weekday(yr, 1, 1, 3)::TEXT, 2, '0'), TRUE, 'holiday'),
      (auth.uid(), 'Valentine''s Day',  yr || '-02-14', TRUE, 'holiday'),
      (auth.uid(), 'Presidents'' Day',  yr || '-02-' || LPAD(nth_weekday(yr, 2, 1, 3)::TEXT, 2, '0'), TRUE, 'holiday'),
      (auth.uid(), 'Easter Sunday',     easter::TEXT, TRUE, 'holiday'),
      (auth.uid(), 'Mother''s Day',     yr || '-05-' || LPAD(nth_weekday(yr, 5, 0, 2)::TEXT, 2, '0'), TRUE, 'holiday'),
      (auth.uid(), 'Memorial Day',      yr || '-05-' || LPAD(last_weekday(yr, 5, 1)::TEXT, 2, '0'), TRUE, 'holiday'),
      (auth.uid(), 'Juneteenth',        yr || '-06-19', TRUE, 'holiday'),
      (auth.uid(), 'Father''s Day',     yr || '-06-' || LPAD(nth_weekday(yr, 6, 0, 3)::TEXT, 2, '0'), TRUE, 'holiday'),
      (auth.uid(), 'Independence Day',  yr || '-07-04', TRUE, 'holiday'),
      (auth.uid(), 'Labor Day',         yr || '-09-' || LPAD(nth_weekday(yr, 9, 1, 1)::TEXT, 2, '0'), TRUE, 'holiday'),
      (auth.uid(), 'Halloween',         yr || '-10-31', TRUE, 'holiday'),
      (auth.uid(), 'Veterans Day',      yr || '-11-11', TRUE, 'holiday'),
      (auth.uid(), 'Thanksgiving',      yr || '-11-' || LPAD(nth_weekday(yr, 11, 4, 4)::TEXT, 2, '0'), TRUE, 'holiday'),
      (auth.uid(), 'Christmas Eve',     yr || '-12-24', TRUE, 'holiday'),
      (auth.uid(), 'Christmas Day',     yr || '-12-25', TRUE, 'holiday'),
      (auth.uid(), 'New Year''s Eve',   yr || '-12-31', TRUE, 'holiday');
  END LOOP;
END;
$$;

-- ============================================
-- 7. ICLOUD CALENDAR SYNC
-- ============================================

-- iCloud Sync Accounts (credentials stored securely)
CREATE TABLE icloud_sync_accounts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  email TEXT NOT NULL,
  app_password TEXT NOT NULL,
  calendar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_user_id_icloud_sync_accounts BEFORE INSERT ON icloud_sync_accounts FOR EACH ROW EXECUTE FUNCTION set_user_id();

ALTER TABLE icloud_sync_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_data" ON icloud_sync_accounts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Safe view: excludes app_password so the client never sees it
CREATE VIEW icloud_sync_accounts_safe
WITH (security_invoker = true)
AS
SELECT id, user_id, label, email, calendar_url, created_at
FROM icloud_sync_accounts;

-- Junction table: which events are synced to which iCloud accounts
CREATE TABLE event_icloud_sync (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES icloud_sync_accounts(id) ON DELETE CASCADE,
  ical_uid TEXT NOT NULL,
  UNIQUE(event_id, account_id)
);

ALTER TABLE event_icloud_sync ENABLE ROW LEVEL SECURITY;

-- RLS via parent event ownership
CREATE POLICY "users_own_via_event" ON event_icloud_sync
  FOR ALL
  USING (EXISTS (SELECT 1 FROM calendar_events WHERE id = event_icloud_sync.event_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM calendar_events WHERE id = event_icloud_sync.event_id AND user_id = auth.uid()));

-- Update calendar events view to include sync account IDs
DROP VIEW IF EXISTS calendar_events_with_person;
CREATE VIEW calendar_events_with_person
WITH (security_invoker = true)
AS
SELECT
  e.*,
  m.name AS person_name,
  m.color AS person_color,
  COALESCE(
    (SELECT array_agg(s.account_id) FROM event_icloud_sync s WHERE s.event_id = e.id),
    ARRAY[]::BIGINT[]
  ) AS sync_account_ids
FROM calendar_events e
LEFT JOIN family_members m ON e.person_id = m.id;
