/** Registra el resolver de alias `@/` para los scripts de mantenimiento. */
import { register } from 'node:module'

register('./alias-resolver.mjs', import.meta.url)
