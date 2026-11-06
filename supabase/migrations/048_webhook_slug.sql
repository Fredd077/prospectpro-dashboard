-- Las URLs de webhook usaban el nombre de empresa (profiles.company) tal cual,
-- URL-encodeado, como segmento de ruta (ej: /api/webhooks/inbound/M%C3%A9todo%20PULSO).
-- Varios CRMs (confirmado con Pipedrive) rechazan o corrompen esa URL al pegarla
-- en su propio formulario de webhook cuando el nombre de empresa tiene tildes o
-- espacios — bloqueando la conexión para cualquier cliente cuyo nombre de empresa
-- no sea ASCII puro, que es el caso normal en Latinoamérica.
--
-- Esto agrega un identificador opaco y URL-safe por empresa. El código de la app
-- usa este slug para las URLs NUEVAS que se muestran al usuario, pero los
-- endpoints de webhook (inbound y hubspot) siguen aceptando también el esquema
-- viejo (nombre de empresa decodeURIComponent) como respaldo, para no romper
-- ningún webhook que un cliente ya haya configurado en su CRM con la URL anterior.
alter table public.integrations
  add column if not exists webhook_slug text unique default gen_random_uuid()::text;

alter table public.integrations
  alter column webhook_slug set not null;
