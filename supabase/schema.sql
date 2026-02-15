-- Supabase Schema Migration for Family Hub
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- ============================================
-- 1. TABLES
-- ============================================

-- Family Members (people within a household, e.g. kids, parents)
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
-- 1.1 FAMILY SHARING TABLES
-- ============================================

-- Families (a group of Supabase auth users who share data)
CREATE TABLE families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family Users (which auth users belong to which family)
CREATE TABLE family_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

CREATE INDEX idx_family_users_user ON family_users(user_id);
CREATE INDEX idx_family_users_family ON family_users(family_id);

-- Family Invites (invite codes to join a family)
CREATE TABLE family_invites (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_family_invites_code ON family_invites(invite_code);

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
-- 1.6 FAMILY SHARING HELPER FUNCTION
-- ============================================

-- Returns all user_ids in the caller's family, always including auth.uid()
CREATE OR REPLACE FUNCTION get_family_user_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fu2.user_id
  FROM family_users fu1
  JOIN family_users fu2 ON fu2.family_id = fu1.family_id
  WHERE fu1.user_id = auth.uid()
  UNION
  SELECT auth.uid()
$$;

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_item_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

-- Family sharing tables: RLS checks membership directly (not via helper to avoid circular dependency)
CREATE POLICY "family_members_access" ON families
  FOR ALL
  USING (EXISTS (SELECT 1 FROM family_users WHERE family_id = families.id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM family_users WHERE family_id = families.id AND user_id = auth.uid()));

CREATE POLICY "family_users_access" ON family_users
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM family_users fu WHERE fu.family_id = family_users.family_id AND fu.user_id = auth.uid()));

CREATE POLICY "family_invites_access" ON family_invites
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM family_users WHERE family_id = family_invites.family_id AND user_id = auth.uid()));

-- Family-aware policies: users see their own data + data from family members
CREATE POLICY "family_access" ON family_members
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

CREATE POLICY "family_access" ON calendar_events
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

CREATE POLICY "family_access" ON grocery_items
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- Grocery history: users see their own + family + global seed data (user_id IS NULL)
CREATE POLICY "family_and_global" ON grocery_item_history
  FOR SELECT USING (user_id IN (SELECT get_family_user_ids()) OR user_id IS NULL);

CREATE POLICY "users_insert_own" ON grocery_item_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "family_update" ON grocery_item_history
  FOR UPDATE USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

CREATE POLICY "family_delete" ON grocery_item_history
  FOR DELETE USING (user_id IN (SELECT get_family_user_ids()));

CREATE POLICY "family_access" ON todo_categories
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

CREATE POLICY "family_access" ON todo_items
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- Subtasks: RLS via parent todo_item ownership (family-aware)
CREATE POLICY "family_access_via_parent" ON todo_subtasks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM todo_items WHERE id = todo_subtasks.todo_id AND user_id IN (SELECT get_family_user_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM todo_items WHERE id = todo_subtasks.todo_id AND user_id IN (SELECT get_family_user_ids())));

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

-- Get grocery suggestions (ILIKE prefix search, family-aware)
CREATE OR REPLACE FUNCTION get_grocery_suggestions(query TEXT)
RETURNS TABLE(name TEXT, category TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.name, h.category
  FROM grocery_item_history h
  WHERE h.name ILIKE query || '%'
    AND (h.user_id IN (SELECT get_family_user_ids()) OR h.user_id IS NULL)
  ORDER BY
    CASE WHEN h.user_id = auth.uid() THEN 0
         WHEN h.user_id IS NOT NULL THEN 1
         ELSE 2 END,
    h.use_count DESC,
    h.name
  LIMIT 10;
$$;

-- Add grocery item with auto-category from history + upsert history (family-aware lookup, auth.uid() for insert)
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
  -- Resolve category: use provided, or look up from history (family-aware)
  IF p_category IS NOT NULL AND p_category != '' THEN
    resolved_category := p_category;
  ELSE
    SELECT h.category INTO resolved_category
    FROM grocery_item_history h
    WHERE h.name ILIKE p_name
      AND h.category IS NOT NULL
      AND (h.user_id IN (SELECT get_family_user_ids()) OR h.user_id IS NULL)
    ORDER BY
      CASE WHEN h.user_id = auth.uid() THEN 0
           WHEN h.user_id IS NOT NULL THEN 1
           ELSE 2 END,
      h.use_count DESC
    LIMIT 1;
  END IF;

  -- Insert the grocery item (always as current user)
  INSERT INTO grocery_items (user_id, name, quantity, unit, category, checked)
  VALUES (auth.uid(), p_name, p_quantity, p_unit, resolved_category, FALSE)
  RETURNING * INTO new_item;

  -- Upsert history for this user (always auth.uid())
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

-- Reorder todos by ID array (family-aware ownership check)
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
    WHERE id = ids[i] AND user_id IN (SELECT get_family_user_ids());
  END LOOP;
END;
$$;

-- Reorder subtasks by ID array (family-aware ownership check)
CREATE OR REPLACE FUNCTION reorder_subtasks(p_todo_id BIGINT, ids BIGINT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
BEGIN
  -- Verify ownership of parent todo (family-aware)
  IF NOT EXISTS (SELECT 1 FROM todo_items WHERE id = p_todo_id AND user_id IN (SELECT get_family_user_ids())) THEN
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

CREATE POLICY "family_access" ON maintenance_categories
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

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

CREATE POLICY "family_access" ON maintenance_items
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

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

-- RLS via parent item ownership (family-aware)
CREATE POLICY "family_access_via_parent" ON maintenance_history
  FOR ALL
  USING (EXISTS (SELECT 1 FROM maintenance_items WHERE id = maintenance_history.item_id AND user_id IN (SELECT get_family_user_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM maintenance_items WHERE id = maintenance_history.item_id AND user_id IN (SELECT get_family_user_ids())));

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
  -- Verify ownership (family-aware)
  SELECT * INTO v_item FROM maintenance_items WHERE id = p_item_id AND user_id IN (SELECT get_family_user_ids());
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
-- Family-aware: checks if ANY family member already has holidays
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
  -- Skip if user or any family member already has holidays
  IF EXISTS (SELECT 1 FROM calendar_events WHERE user_id IN (SELECT get_family_user_ids()) AND event_type = 'holiday' LIMIT 1) THEN
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

CREATE POLICY "family_access" ON icloud_sync_accounts
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

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

-- RLS via parent event ownership (family-aware)
CREATE POLICY "family_access_via_event" ON event_icloud_sync
  FOR ALL
  USING (EXISTS (SELECT 1 FROM calendar_events WHERE id = event_icloud_sync.event_id AND user_id IN (SELECT get_family_user_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM calendar_events WHERE id = event_icloud_sync.event_id AND user_id IN (SELECT get_family_user_ids())));

-- Update calendar events view to include sync account IDs
DROP VIEW IF EXISTS calendar_events_with_person;

-- Junction table: which family members are assigned to which events
CREATE TABLE event_family_members (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  UNIQUE(event_id, member_id)
);

CREATE INDEX idx_event_family_members_event ON event_family_members(event_id);

ALTER TABLE event_family_members ENABLE ROW LEVEL SECURITY;

-- RLS via parent event ownership (family-aware)
CREATE POLICY "family_access_via_event" ON event_family_members
  FOR ALL
  USING (EXISTS (SELECT 1 FROM calendar_events WHERE id = event_family_members.event_id AND user_id IN (SELECT get_family_user_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM calendar_events WHERE id = event_family_members.event_id AND user_id IN (SELECT get_family_user_ids())));

-- Migration: copy existing person_id values into junction table (family-aware)
CREATE OR REPLACE FUNCTION migrate_event_people()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO event_family_members (event_id, member_id)
  SELECT id, person_id
  FROM calendar_events
  WHERE person_id IS NOT NULL
    AND user_id IN (SELECT get_family_user_ids())
    AND NOT EXISTS (
      SELECT 1 FROM event_family_members efm WHERE efm.event_id = calendar_events.id
    );
END;
$$;

CREATE VIEW calendar_events_with_person
WITH (security_invoker = true)
AS
SELECT
  e.*,
  COALESCE(
    (SELECT json_agg(json_build_object('id', fm.id, 'name', fm.name, 'color', fm.color))
     FROM event_family_members efm
     JOIN family_members fm ON fm.id = efm.member_id
     WHERE efm.event_id = e.id),
    '[]'::json
  ) AS people,
  COALESCE(
    (SELECT array_agg(s.account_id) FROM event_icloud_sync s WHERE s.event_id = e.id),
    ARRAY[]::BIGINT[]
  ) AS sync_account_ids
FROM calendar_events e;

-- ============================================
-- 8. MEAL PLANNING
-- ============================================

-- Recipe Categories
CREATE TABLE recipe_categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recipe_categories_user ON recipe_categories(user_id);
CREATE TRIGGER set_user_id_recipe_categories BEFORE INSERT ON recipe_categories FOR EACH ROW EXECUTE FUNCTION set_user_id();
ALTER TABLE recipe_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_access" ON recipe_categories
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- Recipes
CREATE TABLE recipes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category_id BIGINT REFERENCES recipe_categories(id) ON DELETE SET NULL,
  servings INTEGER,
  prep_time INTEGER,
  cook_time INTEGER,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recipes_user ON recipes(user_id);
CREATE TRIGGER set_user_id_recipes BEFORE INSERT ON recipes FOR EACH ROW EXECUTE FUNCTION set_user_id();
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_access" ON recipes
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- Recipe Ingredients (child of recipes, CASCADE delete)
CREATE TABLE recipe_ingredients (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_access_via_parent" ON recipe_ingredients
  FOR ALL
  USING (EXISTS (SELECT 1 FROM recipes WHERE id = recipe_ingredients.recipe_id AND user_id IN (SELECT get_family_user_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM recipes WHERE id = recipe_ingredients.recipe_id AND user_id IN (SELECT get_family_user_ids())));

-- Meal Plan Entries
CREATE TABLE meal_plan_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  recipe_id BIGINT REFERENCES recipes(id) ON DELETE SET NULL,
  custom_title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meal_plan_entries_user ON meal_plan_entries(user_id);
CREATE INDEX idx_meal_plan_entries_date ON meal_plan_entries(date);
CREATE TRIGGER set_user_id_meal_plan_entries BEFORE INSERT ON meal_plan_entries FOR EACH ROW EXECUTE FUNCTION set_user_id();
ALTER TABLE meal_plan_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_access" ON meal_plan_entries
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- View: Recipes with category info and usage count
CREATE VIEW recipes_full
WITH (security_invoker = true)
AS
SELECT
  r.*,
  c.name AS category_name,
  c.icon AS category_icon,
  COALESCE((SELECT COUNT(*) FROM meal_plan_entries m WHERE m.recipe_id = r.id), 0) AS usage_count
FROM recipes r
LEFT JOIN recipe_categories c ON r.category_id = c.id;

-- View: Meal plan entries with recipe details
CREATE VIEW meal_plan_entries_full
WITH (security_invoker = true)
AS
SELECT
  m.*,
  r.title AS recipe_title,
  r.description AS recipe_description,
  r.prep_time AS recipe_prep_time,
  r.cook_time AS recipe_cook_time,
  r.servings AS recipe_servings,
  rc.name AS recipe_category_name,
  rc.icon AS recipe_category_icon
FROM meal_plan_entries m
LEFT JOIN recipes r ON m.recipe_id = r.id
LEFT JOIN recipe_categories rc ON r.category_id = rc.id;

-- RPC: Add meal ingredients to grocery list for a date range (family-aware)
CREATE OR REPLACE FUNCTION add_meal_ingredients_to_grocery(p_date_start TEXT, p_date_end TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agg RECORD;
  item_count INTEGER := 0;
BEGIN
  FOR agg IN
    SELECT
      ri.name,
      SUM(ri.quantity) AS total_quantity,
      ri.unit
    FROM meal_plan_entries mpe
    JOIN recipe_ingredients ri ON ri.recipe_id = mpe.recipe_id
    WHERE mpe.user_id IN (SELECT get_family_user_ids())
      AND mpe.date >= p_date_start
      AND mpe.date <= p_date_end
      AND mpe.recipe_id IS NOT NULL
    GROUP BY ri.name, ri.unit
  LOOP
    PERFORM add_grocery_item(
      p_name := agg.name,
      p_quantity := agg.total_quantity,
      p_unit := agg.unit,
      p_category := NULL
    );
    item_count := item_count + 1;
  END LOOP;

  RETURN item_count;
END;
$$;

-- ============================================
-- 9. FAMILY SHARING RPCs
-- ============================================

-- Create a new family and generate an invite code
CREATE OR REPLACE FUNCTION create_family_and_invite(p_name TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_invite_code TEXT;
BEGIN
  -- Check if user is already in a family
  IF EXISTS (SELECT 1 FROM family_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already in a family';
  END IF;

  -- Create family
  INSERT INTO families (name) VALUES (p_name) RETURNING id INTO v_family_id;

  -- Add creator as owner
  INSERT INTO family_users (family_id, user_id, role) VALUES (v_family_id, auth.uid(), 'owner');

  -- Generate 8-char invite code
  v_invite_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  -- Create invite
  INSERT INTO family_invites (family_id, invite_code, invited_by)
  VALUES (v_family_id, v_invite_code, auth.uid());

  RETURN json_build_object(
    'family_id', v_family_id,
    'family_name', p_name,
    'invite_code', v_invite_code
  );
END;
$$;

-- Accept a family invite
CREATE OR REPLACE FUNCTION accept_family_invite(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite family_invites;
  v_family_name TEXT;
BEGIN
  -- Check if user is already in a family
  IF EXISTS (SELECT 1 FROM family_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already in a family. Leave your current family first.';
  END IF;

  -- Find valid invite
  SELECT * INTO v_invite FROM family_invites
  WHERE invite_code = upper(p_code)
    AND accepted_by IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  -- Add user to family
  INSERT INTO family_users (family_id, user_id, role) VALUES (v_invite.family_id, auth.uid(), 'member');

  -- Mark invite as accepted
  UPDATE family_invites SET accepted_by = auth.uid(), accepted_at = NOW() WHERE id = v_invite.id;

  -- Get family name
  SELECT name INTO v_family_name FROM families WHERE id = v_invite.family_id;

  RETURN json_build_object(
    'family_id', v_invite.family_id,
    'family_name', v_family_name
  );
END;
$$;

-- Get family info for the current user
CREATE OR REPLACE FUNCTION get_family_info()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_family_name TEXT;
  v_members JSON;
  v_pending_invites JSON;
BEGIN
  -- Find user's family
  SELECT fu.family_id, f.name INTO v_family_id, v_family_name
  FROM family_users fu
  JOIN families f ON f.id = fu.family_id
  WHERE fu.user_id = auth.uid();

  IF v_family_id IS NULL THEN
    RETURN json_build_object('in_family', false);
  END IF;

  -- Get members
  SELECT json_agg(json_build_object(
    'user_id', fu.user_id,
    'email', u.email,
    'role', fu.role,
    'joined_at', fu.joined_at
  ) ORDER BY fu.joined_at)
  INTO v_members
  FROM family_users fu
  JOIN auth.users u ON u.id = fu.user_id
  WHERE fu.family_id = v_family_id;

  -- Get pending invites
  SELECT json_agg(json_build_object(
    'id', fi.id,
    'invite_code', fi.invite_code,
    'expires_at', fi.expires_at
  ) ORDER BY fi.expires_at DESC)
  INTO v_pending_invites
  FROM family_invites fi
  WHERE fi.family_id = v_family_id
    AND fi.accepted_by IS NULL
    AND fi.expires_at > NOW();

  RETURN json_build_object(
    'in_family', true,
    'family_id', v_family_id,
    'family_name', v_family_name,
    'members', COALESCE(v_members, '[]'::json),
    'pending_invites', COALESCE(v_pending_invites, '[]'::json)
  );
END;
$$;

-- Generate a new invite code for existing family
CREATE OR REPLACE FUNCTION create_family_invite()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_invite_code TEXT;
  v_invite family_invites;
BEGIN
  -- Find user's family
  SELECT family_id INTO v_family_id FROM family_users WHERE user_id = auth.uid();

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'You are not in a family';
  END IF;

  -- Generate 8-char invite code
  v_invite_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  -- Create invite
  INSERT INTO family_invites (family_id, invite_code, invited_by)
  VALUES (v_family_id, v_invite_code, auth.uid())
  RETURNING * INTO v_invite;

  RETURN json_build_object(
    'invite_code', v_invite_code,
    'expires_at', v_invite.expires_at
  );
END;
$$;

-- Leave the current family
CREATE OR REPLACE FUNCTION leave_family()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_member_count INTEGER;
BEGIN
  -- Find user's family
  SELECT family_id INTO v_family_id FROM family_users WHERE user_id = auth.uid();

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'You are not in a family';
  END IF;

  -- Remove user from family
  DELETE FROM family_users WHERE family_id = v_family_id AND user_id = auth.uid();

  -- Check if family is now empty
  SELECT COUNT(*) INTO v_member_count FROM family_users WHERE family_id = v_family_id;

  IF v_member_count = 0 THEN
    -- Delete the family (cascades to invites)
    DELETE FROM families WHERE id = v_family_id;
  END IF;
END;
$$;
