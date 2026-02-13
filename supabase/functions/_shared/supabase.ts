import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

/** Admin client — bypasses RLS, used to read app_password */
export const adminClient = createClient(supabaseUrl, supabaseServiceKey)

/** Build a user-scoped client from the Authorization header */
export function getUserClient(req: Request) {
  const authHeader = req.headers.get("Authorization")!
  return createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  })
}

/** Verify the caller is authenticated and return their user id */
export async function getAuthUserId(req: Request): Promise<string> {
  const client = getUserClient(req)
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error("Unauthorized")
  return user.id
}
