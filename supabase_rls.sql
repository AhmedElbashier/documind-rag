-- RLS and privilege lockdown for the DocuMind demo database.
-- Already applied on the live ai_rag_system project. Safe to re-run only on a
-- fresh database after supabase_schema.sql and supabase_schema_stripe.sql.
--
-- The app's document, embedding, chat, and billing writes all use
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS. The anon key is used only
-- for auth (middleware and Stripe checkout). middleware.ts also uses the
-- cookie/anon client to SELECT the signed-in user's subscriptions and
-- documents if they hit /api/upload.

ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_own
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY documents_select_own
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY documents_bucket_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'documents');

REVOKE ALL ON TABLE
  public._prisma_migrations,
  public.users,
  public.workspaces,
  public.workspace_members,
  public.projects,
  public.boards,
  public.columns,
  public.tasks,
  public.comments,
  public.task_activities,
  public.documents,
  public.embeddings,
  public.subscriptions
FROM anon, authenticated;

GRANT SELECT ON TABLE public.documents TO authenticated;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;

REVOKE ALL ON FUNCTION public.match_embeddings(vector, integer, uuid) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.match_embeddings(vector, integer, uuid) SET search_path = public, extensions;
