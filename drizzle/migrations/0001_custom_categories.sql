CREATE TABLE public.custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  emoji text NOT NULL DEFAULT '🏷️',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_categories TO authenticated;
GRANT ALL ON public.custom_categories TO service_role;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members all categories" ON public.custom_categories FOR ALL TO authenticated USING (public.is_member(household_id)) WITH CHECK (public.is_member(household_id));