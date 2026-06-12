-- ══════════════════════════════════════════════════════════════════════
-- 036_pending_user_rls.sql
-- Segunda cerradura: los usuarios en estado 'pending' no pueden leer
-- ni escribir datos de las tablas principales, aunque el middleware
-- sea eludido de alguna manera.
--
-- Estrategia: añadir la función helper is_active_or_admin() y extender
-- las políticas existentes con un AND sobre el role del usuario.
--
-- Tablas afectadas:
--   activities          → policy "activities_own"
--   activity_logs       → policy "activity_logs_own"
--   recipe_scenarios    → policy "recipe_scenarios_own"
--   pipeline_simple     → policy "Users can manage their own pipeline_simple"
--
-- Lo que NO se toca:
--   profiles → el usuario pending necesita leer su propia fila para que
--              el middleware y la pantalla de espera lean su state.
--   Políticas de service_role (admin/manager) → usan el cliente service,
--   que bypasea RLS por completo; estas políticas no los afectan.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Helper: comprueba que el usuario tenga role active o admin ───────
-- SECURITY DEFINER → corre como owner (postgres), que bypasea RLS en
-- profiles. Así la función siempre lee el role real sin recurrsión.
CREATE OR REPLACE FUNCTION is_active_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  id   = auth.uid()
    AND    role IN ('active', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ─── activities ──────────────────────────────────────────────────────
-- Antes: user_id = auth.uid()
-- Ahora: user_id = auth.uid() AND is_active_or_admin()
DROP POLICY IF EXISTS "activities_own" ON activities;
CREATE POLICY "activities_own" ON activities
  FOR ALL
  USING (user_id = auth.uid() AND is_active_or_admin());

-- ─── activity_logs ───────────────────────────────────────────────────
-- Antes: user_id = auth.uid()
-- Ahora: user_id = auth.uid() AND is_active_or_admin()
DROP POLICY IF EXISTS "activity_logs_own" ON activity_logs;
CREATE POLICY "activity_logs_own" ON activity_logs
  FOR ALL
  USING (user_id = auth.uid() AND is_active_or_admin());

-- ─── recipe_scenarios ────────────────────────────────────────────────
-- Antes: user_id = auth.uid()
-- Ahora: user_id = auth.uid() AND is_active_or_admin()
DROP POLICY IF EXISTS "recipe_scenarios_own" ON recipe_scenarios;
CREATE POLICY "recipe_scenarios_own" ON recipe_scenarios
  FOR ALL
  USING (user_id = auth.uid() AND is_active_or_admin());

-- ─── pipeline_simple ─────────────────────────────────────────────────
-- Antes: auth.uid() = user_id (USING y WITH CHECK)
-- Ahora: idem + is_active_or_admin()
DROP POLICY IF EXISTS "Users can manage their own pipeline_simple" ON pipeline_simple;
CREATE POLICY "pipeline_simple_own" ON pipeline_simple
  FOR ALL
  USING      (user_id = auth.uid() AND is_active_or_admin())
  WITH CHECK (user_id = auth.uid() AND is_active_or_admin());
