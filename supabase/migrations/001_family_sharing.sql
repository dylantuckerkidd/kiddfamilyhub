-- ============================================
-- Migration: Family Sharing
-- Run this in the Supabase SQL Editor against an existing database
-- ============================================

-- 1. NEW TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_users_user ON family_users(user_id);
CREATE INDEX IF NOT EXISTS idx_family_users_family ON family_users(family_id);

CREATE TABLE IF NOT EXISTS family_invites (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_family_invites_code ON family_invites(invite_code);

-- 2. RLS ON NEW TABLES
-- ============================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_members_access" ON families;
CREATE POLICY "family_members_access" ON families
  FOR ALL
  USING (EXISTS (SELECT 1 FROM family_users WHERE family_id = families.id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM family_users WHERE family_id = families.id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "family_users_access" ON family_users;
CREATE POLICY "family_users_access" ON family_users
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM family_users fu WHERE fu.family_id = family_users.family_id AND fu.user_id = auth.uid()));

DROP POLICY IF EXISTS "family_invites_access" ON family_invites;
CREATE POLICY "family_invites_access" ON family_invites
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM family_users WHERE family_id = family_invites.family_id AND user_id = auth.uid()));

-- 3. HELPER FUNCTION
-- ============================================

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

-- 4. UPDATE RLS POLICIES ON EXISTING TABLES
-- ============================================

-- family_members
DROP POLICY IF EXISTS "users_own_data" ON family_members;
DROP POLICY IF EXISTS "family_access" ON family_members;
CREATE POLICY "family_access" ON family_members
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- calendar_events
DROP POLICY IF EXISTS "users_own_data" ON calendar_events;
DROP POLICY IF EXISTS "family_access" ON calendar_events;
CREATE POLICY "family_access" ON calendar_events
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- grocery_items
DROP POLICY IF EXISTS "users_own_data" ON grocery_items;
DROP POLICY IF EXISTS "family_access" ON grocery_items;
CREATE POLICY "family_access" ON grocery_items
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- grocery_item_history
DROP POLICY IF EXISTS "users_own_and_global" ON grocery_item_history;
DROP POLICY IF EXISTS "family_and_global" ON grocery_item_history;
CREATE POLICY "family_and_global" ON grocery_item_history
  FOR SELECT USING (user_id IN (SELECT get_family_user_ids()) OR user_id IS NULL);

DROP POLICY IF EXISTS "users_insert_own" ON grocery_item_history;
CREATE POLICY "users_insert_own" ON grocery_item_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own" ON grocery_item_history;
DROP POLICY IF EXISTS "family_update" ON grocery_item_history;
CREATE POLICY "family_update" ON grocery_item_history
  FOR UPDATE USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

DROP POLICY IF EXISTS "users_delete_own" ON grocery_item_history;
DROP POLICY IF EXISTS "family_delete" ON grocery_item_history;
CREATE POLICY "family_delete" ON grocery_item_history
  FOR DELETE USING (user_id IN (SELECT get_family_user_ids()));

-- todo_categories
DROP POLICY IF EXISTS "users_own_data" ON todo_categories;
DROP POLICY IF EXISTS "family_access" ON todo_categories;
CREATE POLICY "family_access" ON todo_categories
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- todo_items
DROP POLICY IF EXISTS "users_own_data" ON todo_items;
DROP POLICY IF EXISTS "family_access" ON todo_items;
CREATE POLICY "family_access" ON todo_items
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- todo_subtasks
DROP POLICY IF EXISTS "users_own_via_parent" ON todo_subtasks;
DROP POLICY IF EXISTS "family_access_via_parent" ON todo_subtasks;
CREATE POLICY "family_access_via_parent" ON todo_subtasks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM todo_items WHERE id = todo_subtasks.todo_id AND user_id IN (SELECT get_family_user_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM todo_items WHERE id = todo_subtasks.todo_id AND user_id IN (SELECT get_family_user_ids())));

-- maintenance_categories
DROP POLICY IF EXISTS "users_own_data" ON maintenance_categories;
DROP POLICY IF EXISTS "family_access" ON maintenance_categories;
CREATE POLICY "family_access" ON maintenance_categories
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- maintenance_items
DROP POLICY IF EXISTS "users_own_data" ON maintenance_items;
DROP POLICY IF EXISTS "family_access" ON maintenance_items;
CREATE POLICY "family_access" ON maintenance_items
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- maintenance_history
DROP POLICY IF EXISTS "users_own_via_parent" ON maintenance_history;
DROP POLICY IF EXISTS "family_access_via_parent" ON maintenance_history;
CREATE POLICY "family_access_via_parent" ON maintenance_history
  FOR ALL
  USING (EXISTS (SELECT 1 FROM maintenance_items WHERE id = maintenance_history.item_id AND user_id IN (SELECT get_family_user_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM maintenance_items WHERE id = maintenance_history.item_id AND user_id IN (SELECT get_family_user_ids())));

-- icloud_sync_accounts
DROP POLICY IF EXISTS "users_own_data" ON icloud_sync_accounts;
DROP POLICY IF EXISTS "family_access" ON icloud_sync_accounts;
CREATE POLICY "family_access" ON icloud_sync_accounts
  FOR ALL USING (user_id IN (SELECT get_family_user_ids()))
  WITH CHECK (user_id IN (SELECT get_family_user_ids()));

-- event_icloud_sync
DROP POLICY IF EXISTS "users_own_via_event" ON event_icloud_sync;
DROP POLICY IF EXISTS "family_access_via_event" ON event_icloud_sync;
CREATE POLICY "family_access_via_event" ON event_icloud_sync
  FOR ALL
  USING (EXISTS (SELECT 1 FROM calendar_events WHERE id = event_icloud_sync.event_id AND user_id IN (SELECT get_family_user_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM calendar_events WHERE id = event_icloud_sync.event_id AND user_id IN (SELECT get_family_user_ids())));

-- event_family_members
DROP POLICY IF EXISTS "users_own_via_event" ON event_family_members;
DROP POLICY IF EXISTS "family_access_via_event" ON event_family_members;
CREATE POLICY "family_access_via_event" ON event_family_members
  FOR ALL
  USING (EXISTS (SELECT 1 FROM calendar_events WHERE id = event_family_members.event_id AND user_id IN (SELECT get_family_user_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM calendar_events WHERE id = event_family_members.event_id AND user_id IN (SELECT get_family_user_ids())));

-- recipe_categories (may not exist yet if meal planning migration hasn't run)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_categories') THEN
    EXECUTE 'DROP POLICY IF EXISTS "users_own_data" ON recipe_categories';
    EXECUTE 'DROP POLICY IF EXISTS "family_access" ON recipe_categories';
    EXECUTE 'CREATE POLICY "family_access" ON recipe_categories FOR ALL USING (user_id IN (SELECT get_family_user_ids())) WITH CHECK (user_id IN (SELECT get_family_user_ids()))';
  END IF;
END $$;

-- recipes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "users_own_data" ON recipes';
    EXECUTE 'DROP POLICY IF EXISTS "family_access" ON recipes';
    EXECUTE 'CREATE POLICY "family_access" ON recipes FOR ALL USING (user_id IN (SELECT get_family_user_ids())) WITH CHECK (user_id IN (SELECT get_family_user_ids()))';
  END IF;
END $$;

-- recipe_ingredients
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_ingredients') THEN
    EXECUTE 'DROP POLICY IF EXISTS "users_own_via_parent" ON recipe_ingredients';
    EXECUTE 'DROP POLICY IF EXISTS "family_access_via_parent" ON recipe_ingredients';
    EXECUTE 'CREATE POLICY "family_access_via_parent" ON recipe_ingredients FOR ALL USING (EXISTS (SELECT 1 FROM recipes WHERE id = recipe_ingredients.recipe_id AND user_id IN (SELECT get_family_user_ids()))) WITH CHECK (EXISTS (SELECT 1 FROM recipes WHERE id = recipe_ingredients.recipe_id AND user_id IN (SELECT get_family_user_ids())))';
  END IF;
END $$;

-- meal_plan_entries
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meal_plan_entries') THEN
    EXECUTE 'DROP POLICY IF EXISTS "users_own_data" ON meal_plan_entries';
    EXECUTE 'DROP POLICY IF EXISTS "family_access" ON meal_plan_entries';
    EXECUTE 'CREATE POLICY "family_access" ON meal_plan_entries FOR ALL USING (user_id IN (SELECT get_family_user_ids())) WITH CHECK (user_id IN (SELECT get_family_user_ids()))';
  END IF;
END $$;

-- 5. UPDATE EXISTING RPCs
-- ============================================

-- Get grocery suggestions (family-aware)
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

-- Add grocery item (family-aware lookup, auth.uid() for insert)
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

  INSERT INTO grocery_items (user_id, name, quantity, unit, category, checked)
  VALUES (auth.uid(), p_name, p_quantity, p_unit, resolved_category, FALSE)
  RETURNING * INTO new_item;

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

-- Reorder todos (family-aware)
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

-- Reorder subtasks (family-aware)
CREATE OR REPLACE FUNCTION reorder_subtasks(p_todo_id BIGINT, ids BIGINT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
BEGIN
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

-- Complete maintenance item (family-aware)
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
  SELECT * INTO v_item FROM maintenance_items WHERE id = p_item_id AND user_id IN (SELECT get_family_user_ids());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized or item not found';
  END IF;

  v_completed := COALESCE(p_completed_date::DATE, CURRENT_DATE);

  INSERT INTO maintenance_history (item_id, completed_date, notes, cost, person_id)
  VALUES (p_item_id, COALESCE(p_completed_date, CURRENT_DATE::TEXT), p_notes, p_cost, p_person_id)
  RETURNING * INTO v_history;

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

-- Seed holidays (family-aware duplicate check)
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

-- Migrate event people (family-aware)
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

-- Add meal ingredients to grocery (family-aware, only if meal planning tables exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meal_plan_entries') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION add_meal_ingredients_to_grocery(p_date_start TEXT, p_date_end TEXT)
      RETURNS INTEGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
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
      $fn$';
  END IF;
END $$;

-- 6. NEW FAMILY SHARING RPCs
-- ============================================

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
  IF EXISTS (SELECT 1 FROM family_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already in a family';
  END IF;

  INSERT INTO families (name) VALUES (p_name) RETURNING id INTO v_family_id;
  INSERT INTO family_users (family_id, user_id, role) VALUES (v_family_id, auth.uid(), 'owner');

  v_invite_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO family_invites (family_id, invite_code, invited_by)
  VALUES (v_family_id, v_invite_code, auth.uid());

  RETURN json_build_object(
    'family_id', v_family_id,
    'family_name', p_name,
    'invite_code', v_invite_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION accept_family_invite(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_family_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM family_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already in a family. Leave your current family first.';
  END IF;

  SELECT * INTO v_invite FROM family_invites
  WHERE invite_code = upper(p_code)
    AND accepted_by IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  INSERT INTO family_users (family_id, user_id, role) VALUES (v_invite.family_id, auth.uid(), 'member');
  UPDATE family_invites SET accepted_by = auth.uid(), accepted_at = NOW() WHERE id = v_invite.id;

  -- Delete joining user's holidays that already exist in the family (by title+date)
  DELETE FROM calendar_events
  WHERE user_id = auth.uid()
    AND event_type = 'holiday'
    AND EXISTS (
      SELECT 1 FROM calendar_events ce2
      JOIN family_users fu ON fu.user_id = ce2.user_id AND fu.family_id = v_invite.family_id
      WHERE ce2.event_type = 'holiday'
        AND ce2.title = calendar_events.title
        AND ce2.date = calendar_events.date
        AND ce2.user_id != auth.uid()
    );

  SELECT name INTO v_family_name FROM families WHERE id = v_invite.family_id;

  RETURN json_build_object(
    'family_id', v_invite.family_id,
    'family_name', v_family_name
  );
END;
$$;

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
  SELECT fu.family_id, f.name INTO v_family_id, v_family_name
  FROM family_users fu
  JOIN families f ON f.id = fu.family_id
  WHERE fu.user_id = auth.uid();

  IF v_family_id IS NULL THEN
    RETURN json_build_object('in_family', false);
  END IF;

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

CREATE OR REPLACE FUNCTION create_family_invite()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_invite_code TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT family_id INTO v_family_id FROM family_users WHERE user_id = auth.uid();

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'You are not in a family';
  END IF;

  v_invite_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO family_invites (family_id, invite_code, invited_by)
  VALUES (v_family_id, v_invite_code, auth.uid())
  RETURNING expires_at INTO v_expires_at;

  RETURN json_build_object(
    'invite_code', v_invite_code,
    'expires_at', v_expires_at
  );
END;
$$;

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
  SELECT family_id INTO v_family_id FROM family_users WHERE user_id = auth.uid();

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'You are not in a family';
  END IF;

  DELETE FROM family_users WHERE family_id = v_family_id AND user_id = auth.uid();

  SELECT COUNT(*) INTO v_member_count FROM family_users WHERE family_id = v_family_id;

  IF v_member_count = 0 THEN
    DELETE FROM families WHERE id = v_family_id;
  END IF;
END;
$$;
