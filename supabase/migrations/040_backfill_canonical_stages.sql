-- ══════════════════════════════════════════════════════════════════════
-- 040_backfill_canonical_stages.sql
-- Garantiza que TODO usuario existente tenga las 5 etapas canónicas en
-- pipeline_stages, además de las etapas propias que ya tuviera.
--
-- Por qué hace falta: el seed de la migración 039 creó, para cada usuario, solo
-- las etapas que ese usuario YA HABÍA USADO en su historial. Un usuario que
-- nunca registró una "Reagendar", por ejemplo, se quedó sin esa etapa; y los
-- usuarios sin historial alguno quedaron con cero etapas.
--
-- Comportamiento:
--   - NO duplica: solo inserta la canónica que falte (comparación por nombre exacto).
--   - NO reordena: las existentes conservan su sort_order.
--   - Las faltantes se agregan AL FINAL, continuando desde el máximo actual.
--   - Idempotente: correrla de nuevo no inserta nada.
--
-- OJO con los nombres: "Cita agenda.", "1ra Reunión", "Prop. Presentada" y
-- "Por facturar" son solo etiquetas cortas de la UI. Los nombres almacenados son
-- los de abajo; usar los cortos crearía etapas duplicadas.
-- ══════════════════════════════════════════════════════════════════════

WITH canon(name, ord) AS (
  VALUES
    ('Cita agendada',                                  0),
    ('Reagendar',                                      1),
    ('Primera reu ejecutada/Propuesta en preparación', 2),
    ('Propuesta Presentada',                           3),
    ('Por facturar/cobrar',                            4)
),
-- Punto de partida del sort_order de cada usuario: su máximo actual (o -1 si no
-- tiene ninguna etapa todavía).
base AS (
  SELECT u.id AS user_id,
         COALESCE(MAX(ps.sort_order), -1) AS max_order
    FROM auth.users u
    LEFT JOIN pipeline_stages ps ON ps.user_id = u.id
   GROUP BY u.id
),
missing AS (
  SELECT b.user_id,
         c.name,
         b.max_order + row_number() OVER (PARTITION BY b.user_id ORDER BY c.ord) AS sort_order
    FROM base b
    CROSS JOIN canon c
   WHERE NOT EXISTS (
     SELECT 1
       FROM pipeline_stages ps
      WHERE ps.user_id = b.user_id
        AND ps.name    = c.name
   )
)
INSERT INTO pipeline_stages (user_id, name, sort_order, source)
SELECT user_id, name, sort_order, 'manual'
  FROM missing;
