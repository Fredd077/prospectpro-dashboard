-- ══════════════════════════════════════════════════════════════════════
-- 038_trial_readonly_rls.sql
-- Modo SOLO LECTURA para usuarios con período de prueba vencido.
--
-- Regla de negocio: cuando termina el trial el usuario debe poder ENTRAR y VER
-- sus datos, pero NO modificar nada. Las escrituras (check-in, recetario,
-- actividades, pipeline) ocurren tanto por server actions como directamente desde
-- el navegador (cliente anon), así que la única capa que las bloquea todas por
-- igual es RLS.
--
-- Estrategia: separar las políticas en LECTURA (activo o admin) y ESCRITURA
-- (admin, o activo con trial vigente / sin trial). is_active_writer() es la
-- condición de escritura.
-- ══════════════════════════════════════════════════════════════════════

-- ─── Helper: ¿puede escribir? (admin, o activo con trial vigente o sin trial) ──
CREATE OR REPLACE FUNCTION is_active_writer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  id = auth.uid()
    AND (
      role = 'admin'
      OR (role = 'active' AND (trial_ends_at IS NULL OR trial_ends_at >= now()))
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Para cada tabla de datos del usuario: una política de LECTURA (activo/admin) y
-- una de ESCRITURA (is_active_writer). Las permissive se combinan con OR, por lo
-- que un trial vencido conserva SELECT pero pierde INSERT/UPDATE/DELETE.

-- ─── activities ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "activities_own" ON activities;
CREATE POLICY "activities_read" ON activities
  FOR SELECT USING (user_id = auth.uid() AND is_active_or_admin());
CREATE POLICY "activities_write" ON activities
  FOR ALL
  USING      (user_id = auth.uid() AND is_active_writer())
  WITH CHECK (user_id = auth.uid() AND is_active_writer());

-- ─── activity_logs ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "activity_logs_own" ON activity_logs;
CREATE POLICY "activity_logs_read" ON activity_logs
  FOR SELECT USING (user_id = auth.uid() AND is_active_or_admin());
CREATE POLICY "activity_logs_write" ON activity_logs
  FOR ALL
  USING      (user_id = auth.uid() AND is_active_writer())
  WITH CHECK (user_id = auth.uid() AND is_active_writer());

-- ─── recipe_scenarios ────────────────────────────────────────────────
DROP POLICY IF EXISTS "recipe_scenarios_own" ON recipe_scenarios;
CREATE POLICY "recipe_scenarios_read" ON recipe_scenarios
  FOR SELECT USING (user_id = auth.uid() AND is_active_or_admin());
CREATE POLICY "recipe_scenarios_write" ON recipe_scenarios
  FOR ALL
  USING      (user_id = auth.uid() AND is_active_writer())
  WITH CHECK (user_id = auth.uid() AND is_active_writer());

-- ─── pipeline_simple ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "pipeline_simple_own" ON pipeline_simple;
CREATE POLICY "pipeline_simple_read" ON pipeline_simple
  FOR SELECT USING (user_id = auth.uid() AND is_active_or_admin());
CREATE POLICY "pipeline_simple_write" ON pipeline_simple
  FOR ALL
  USING      (user_id = auth.uid() AND is_active_writer())
  WITH CHECK (user_id = auth.uid() AND is_active_writer());
