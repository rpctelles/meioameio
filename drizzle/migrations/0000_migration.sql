CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Nossa casa',
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text),1,6)),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.household_members (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id),
  UNIQUE (user_id)
);
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'Outros',
  expense_date date NOT NULL DEFAULT current_date,
  due_date date,
  is_paid boolean NOT NULL DEFAULT true,
  paid_by uuid NOT NULL,
  payer_share numeric(5,2) NOT NULL DEFAULT 50 CHECK (payer_share >= 0 AND payer_share <= 100),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  settled_on date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households, public.household_members, public.expenses, public.settlements TO authenticated;
GRANT ALL ON public.households, public.household_members, public.expenses, public.settlements TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member(_hid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM household_members WHERE household_id = _hid AND user_id = auth.uid())
$$;

CREATE POLICY "members read household" ON public.households FOR SELECT TO authenticated USING (public.is_member(id));
CREATE POLICY "members update household" ON public.households FOR UPDATE TO authenticated USING (public.is_member(id));
CREATE POLICY "members read members" ON public.household_members FOR SELECT TO authenticated USING (public.is_member(household_id));
CREATE POLICY "update own member" ON public.household_members FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "members all expenses" ON public.expenses FOR ALL TO authenticated USING (public.is_member(household_id)) WITH CHECK (public.is_member(household_id) AND public.is_member(household_id));
CREATE POLICY "members all settlements" ON public.settlements FOR ALL TO authenticated USING (public.is_member(household_id)) WITH CHECK (public.is_member(household_id));

CREATE OR REPLACE FUNCTION public.create_household(_name text, _display_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM household_members WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'Você já participa de uma casa'; END IF;
  INSERT INTO households(name, created_by) VALUES (coalesce(nullif(_name,''),'Nossa casa'), auth.uid()) RETURNING id INTO hid;
  INSERT INTO household_members(household_id, user_id, display_name) VALUES (hid, auth.uid(), _display_name);
  RETURN hid;
END $$;

CREATE OR REPLACE FUNCTION public.join_household(_code text, _display_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM household_members WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'Você já participa de uma casa'; END IF;
  SELECT id INTO hid FROM households WHERE invite_code = upper(trim(_code));
  IF hid IS NULL THEN RAISE EXCEPTION 'Código inválido'; END IF;
  IF (SELECT count(*) FROM household_members WHERE household_id = hid) >= 2 THEN RAISE EXCEPTION 'Essa casa já tem duas pessoas'; END IF;
  INSERT INTO household_members(household_id, user_id, display_name) VALUES (hid, auth.uid(), _display_name);
  RETURN hid;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_household(text,text), public.join_household(text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_household(text,text), public.join_household(text,text), public.is_member(uuid) TO authenticated;