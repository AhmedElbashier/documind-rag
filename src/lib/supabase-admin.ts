import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service role bypasses RLS. Import this module only from server actions,
// route handlers, and server components — never from client components.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
