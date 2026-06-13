-- Drop policy if exists to avoid conflicts on re-run
DROP POLICY IF EXISTS "tech_articles_delete" ON public.tech_articles;

-- Create DELETE policy for authorized users
CREATE POLICY "tech_articles_delete" ON public.tech_articles 
  FOR DELETE TO authenticated
  USING (is_tech_intel_user());
