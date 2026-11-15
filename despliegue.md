# Despliegue de CERES en Azure

Actualizado el 15 de noviembre de 2026 (UTC). Este documento distingue infraestructura, publicación de la aplicación y validaciones. Todo lo marcado como comprobado se ejecutó de verdad contra `ceres-vm`; nada es simulado.

## Estado actual

**Aplicación publicada:** <https://ceres-f7ctifta45nnk.northcentralus.cloudapp.azure.com>

| Elemento | Estado comprobado |
|---|---|
| Versión en servicio | `fc41b2ccac330f6574d432681723d7f617d0c937` (anterior registrada: `19ec89e…`) |
| HTTPS | Certificado Let's Encrypt (emisor YE2) para el FQDN, válido hasta el 12-feb-2027, renovación automática por Caddy. HTTP → HTTPS 308; HSTS. |
| Puertos públicos | Solo 80/443. Desde Internet: 22, 3000, 5432 y 8000 **cerrados** (comprobado desde GitHub y desde fuera). |
| Base de datos | PostgreSQL 16.15 en red interna Docker, volumen con nombre fijo `ceres_pgdata`; datos conservados entre 4 despliegues y un rollback. |
| Datos | Seed aplicado: 23 fuentes, instantánea NASA `nasa-power-6182bcf32295` (SHA-256 `6182bcf3…`), caso demo. |
| Asistente IA | **IA conectada** con Google Gemini `gemini-4-hydrogen` (secret `GEMINI_API_KEY` y variable `GEMINI_MODEL` en el entorno `production`, cargados el 15-nov 01:14 UTC). `check-llm` ejecutado dentro del contenedor API en la VM: **conectado**, respuesta JSON según esquema. Las 4 preguntas de la demo (incluida una inyección) se validaron con el proveedor real en local; en producción no se hicieron preguntas con cuentas reales. |
| Mapa base | Teselas OSM cargando en producción (comprobado en navegador el 15-nov). El 403 «Access blocked» se debía a `Referrer-Policy: same-origin`, que impedía enviar el Referer que exige la política de OSM; ahora `strict-origin-when-cross-origin` (solo el origen, nunca rutas con IDs). No tenía relación con los certificados. |
| Memoria | Reposo: ~165 MiB entre los 4 contenedores; tras 200 peticiones concurrentes: api 115, web 48, caddy 23, db 21 MiB; 457 MiB disponibles de 887. Carga ligera: 200/200 OK, p50 0,76 s, p95 1,46 s (medido desde Perú). No es una prueba de capacidad; el chat con LLM y varios usuarios simultáneos no se han medido. |

Infraestructura (creada antes por este chat, sin cambios en esta fase): suscripción **Azure for Students** con límite de gasto **On**; `rodrygo-resource-group`; `ceres-vm` `Standard_B2ats_v2` en `northcentralus`, Ubuntu 24.04, Docker 29.1.3, Compose 2.40.3, swap 2 GiB; IP `64.236.243.209`; NSG solo 80/443. `vm-inti-ley` y demás recursos de otros proyectos no se han tocado.

## Arquitectura en la VM

```text
Internet ──443/80──▶ caddy (TLS, cabeceras) ──/api/*──▶ api (FastAPI, 1 worker) ──red interna──▶ db (PostgreSQL)
                                          └──resto───▶ web (Next.js standalone)
```

- Archivos en `/opt/ceres`: `compose.yml`, `Caddyfile`, `ceres.sh`, `.env` (600, solo en el servidor), `state/`, `backups/`, `deployments.log`.
- `.env` contiene `POSTGRES_PASSWORD` (generada en la VM con `openssl rand`, nunca salió de ella), `CERES_DOMAIN`, `CERES_REGISTRY` y, si se configuran, `GEMINI_API_KEY`/`GEMINI_MODEL` (u `OPENAI_API_KEY`/`OPENAI_MODEL` como alternativa).
- Límites: db 256 MiB, api 384 MiB, web 256 MiB, caddy 128 MiB; logs `json-file` 10 MiB × 3; PostgreSQL con `shared_buffers=48MB`, `max_connections=25`.
- La red `internal` no tiene salida; la API también está en `egress` para llamar a NASA/SERFOR/OpenAI y recibir de Caddy.

## CI/CD

| Workflow | Disparo | Qué hace |
|---|---|---|
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Pull requests (y llamado por Deploy) | 65 pruebas pytest con PostgreSQL real + `alembic check`; `tsc` + build Next.js; E2E Playwright del recorrido de aceptación; en PR, build de ambas imágenes sin publicar. |
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | `push` a `main` (excepto cambios solo `.md`) y manual | CI → build `linux/amd64` en GitHub → `ghcr.io/rodrigoalexander7/ceres-{api,web}:<SHA>` → despliegue en `ceres-vm` → verificación pública HTTPS. Manual: `deploy` (opcional `tag`), `rollback`, `backup`, `verify-backup`, `restore`, `status`. |

Flujo de despliegue en la VM (`deploy/ceres.sh deploy <sha>`): login temporal en GHCR → `pull` → arranca db → **respaldo previo** si hay esquema → `alembic upgrade head` → seed idempotente → arranca api/web/caddy → espera healthchecks Docker → comprueba `https://<dominio>/api/v1/health` con la **revisión esperada** y certificado válido → registra versión actual/anterior. Si falla, **rollback automático** a la versión anterior.

### Seguridad del canal

- **GitHub → Azure por OIDC**, sin secretos de larga duración: app `ceres-github-deploy` (appId `7d0b29be-df44-412f-a03d-520082e8c33a`), credencial federada solo para `repo:RodrigoAlexander7@213828389/C.E.R.E.S@1457934727:environment:production` (IDs inmutables). El entorno `production` de GitHub solo acepta la rama `main`.
- **Permisos mínimos:** rol personalizado `CERES VM Run Command Operator` (`infra/azure/role-ceres-runcommand.json`): leer la VM y crear/leer/borrar Run Commands; **asignado solo sobre `ceres-vm`**. No puede tocar otros recursos del grupo.
- **Sin SSH:** el despliegue usa Azure Run Command administrado. Los valores sensibles (`GITHUB_TOKEN` efímero del job para leer GHCR, `OPENAI_API_KEY`) viajan como **parámetros protegidos**, que Azure no devuelve al consultar el recurso; el Run Command se borra al terminar. Se comprobó que los logs de Actions no contienen tokens.
- **Registro:** GHCR con el `GITHUB_TOKEN` del job (`packages:write` para publicar, `packages:read` para que la VM descargue). Las credenciales del registro se guardan en un `DOCKER_CONFIG` aislado y se borran tras el `pull`. Los paquetes son **públicos** porque heredan la visibilidad del repositorio público; contienen código y datos públicos, sin secretos. Si el repositorio pasa a privado, poner también los paquetes como privados: el despliegue ya descarga con token y seguirá funcionando.
- Variables no secretas del entorno `production`: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_VM_NAME`, `AZURE_LOCATION`, `CERES_DOMAIN`.
- Las imágenes no contienen secretos; cookies `Secure` + `HttpOnly`, CSRF con comprobación de origen (verificado en producción: registro sin origen → 403).

## Verificaciones realizadas (todas reales)

| Fecha (UTC) | Run | Resultado |
|---|---|---|
| 15-nov 00:17 | Deploy `57ced9b` (primer despliegue) | Base vacía → migración → seed → healthy → HTTPS OK con certificado nuevo. El primer intento falló en OIDC (subject con IDs inmutables); se corrigió la credencial federada y se relanzó el job. |
| 15-nov 00:24 | Deploy `7e2efbf` | Respaldo previo automático, migración (sin cambios), HTTPS OK. |
| 15-nov 00:27 | `verify-backup` | **Falló**: el script no definía `CERES_TAG` fuera de deploy. Corregido en `5687357`. |
| 15-nov 00:33 | Deploy `5687357` | OK, con respaldo previo. |
| 15-nov 00:35 | `verify-backup` | Respaldo restaurado en base temporal: conteos idénticos a la base viva (users 1, parcels 1, revisions 1, runs 1, sources 23, messages 0). |
| 15-nov 00:37 | `rollback` | `5687357` → `7e2efbf` en ~35 s, healthchecks y HTTPS OK con la revisión anterior. |
| 15-nov 00:41 | `deploy` con `tag=5687357…` | Vuelta a la última versión sin reconstruir imágenes. |
| 15-nov 00:43–00:45 | `backup` + `restore` (confirmado) | Restauración completa de la base viva desde `ceres-20261115T004255Z-manual.dump` (con respaldo `pre-restore` automático); API healthy y demo servida después. |
| 15-nov 00:47 | Carga ligera + `status` | 200/200 OK; memoria registrada arriba. |
| 15-nov 01:05 | Deploy `19ec89e` (Gemini + Referer) | OK, pero la cabecera seguía en `same-origin`: Caddy no recargaba el `Caddyfile` montado. **Bug corregido** en `fc41b2c`: el despliegue reinicia Caddy si cambia el hash del archivo. |
| 15-nov 01:10 | Deploy `fc41b2c` | Caddy reiniciado, `Referrer-Policy: strict-origin-when-cross-origin`, mismo certificado conservado; teselas OSM visibles en el navegador. |
| 15-nov 01:16 | Deploy `fc41b2c` con `GEMINI_API_KEY` | `llm_configured: true`, «IA conectada»; `check-llm` desde el contenedor API en la VM: conectado con `gemini-4-hydrogen`. |

No se crearon cuentas de usuario en producción: el login, el aislamiento y el recorrido completo se validan con la suite E2E en CI (PostgreSQL real) antes de cada despliegue.

## Rollback y operación

Desde GitHub → Actions → **Deploy** → *Run workflow* (rama `main`):

- **Volver a la versión anterior:** `action = rollback`, `tag` vacío. Usa la versión registrada en `/opt/ceres/state/previous`.
- **Ir a una versión concreta:** `action = rollback` (o `deploy`) con `tag = <SHA completo>` de una imagen publicada (ver los tags en GHCR o en `deployments.log`).
- **Re-desplegar la última:** `action = deploy` con `tag = <SHA>`; sin `tag` construye y despliega el commit de `main`.

Equivalente por CLI:

```bash
gh workflow run deploy.yml -R RodrigoAlexander7/C.E.R.E.S -f action=rollback
```

```bash
gh workflow run deploy.yml -R RodrigoAlexander7/C.E.R.E.S -f action=deploy -f tag=5687357637f27c0c29290ab1d8ea826b021aa4a6
```

**Migraciones:** son solo hacia adelante. El rollback cambia imágenes sin revertir el esquema; funciona mientras las migraciones sean compatibles con la versión anterior (aditivas). Si una migración rompe la compatibilidad, restaurar el respaldo `pre-<sha>` que el despliegue crea automáticamente:

```bash
gh workflow run deploy.yml -R RodrigoAlexander7/C.E.R.E.S -f action=restore -f backup_file=<archivo.dump> -f confirm=RESTAURAR
```

`restore` detiene api/web, hace antes un respaldo `pre-restore`, ejecuta `pg_restore --clean` y vuelve a arrancar. `verify-backup` restaura el respaldo más reciente en una base temporal y compara conteos sin tocar la base viva. Se conservan los 14 respaldos más recientes en `/opt/ceres/backups`.

## Pendiente (requiere al usuario)

1. **Asistente IA (Gemini): configurado.** Para rotar la clave: actualizar el secret `GEMINI_API_KEY` del entorno `production` y ejecutar Deploy con `action = deploy` y `tag` = SHA en servicio (la clave llega a `/opt/ceres/.env` como parámetro protegido). Las llamadas a Gemini se facturan/limitan según la cuenta de Google AI, no con el crédito Azure. El modelo devolvió 503 por alta demanda en una prueba con razonamiento activado; por eso `GEMINI_THINKING_BUDGET=0` y reintentos ante 429/503. Si la demanda persiste, cambiar `GEMINI_MODEL` (p. ej. a un modelo *flash*) y redesplegar.
2. **Copia de respaldos fuera de la VM.** Hoy los respaldos están solo en el disco de `ceres-vm`. No hay un destino externo autorizado (crear una cuenta de Storage tendría costo). Indicar un destino para automatizar la copia.
3. **Revisión agronómica local** y medición de capacidad con usuarios reales (ver `data/catalog/REVISION.md`).

## Costos y límites

La oferta pública de estudiante incluye cantidades mensuales de B1s, B2ats v2 y B2pts v2 durante el periodo aplicable. Esto no garantiza la cobertura concreta de esta cuenta, región o componentes asociados. [Azure for Students](https://azure.microsoft.com/en-us/free/students/), [seguimiento del beneficio](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/check-free-service-usage).

Precios minoristas de referencia consultados para `northcentralus`, USD, sin descuentos, impuestos ni cobertura gratuita:

| Componente | Referencia observada | Equivalente orientativo |
|---|---|---|
| B2ats v2 Linux, consumo normal | US$0,0094/h | US$6,86 por 730 h si no se aplica el beneficio |
| IPv4 pública Standard regional | US$0,005/h | US$3,65 por 730 h |
| SSD Standard E4 LRS, 32 GiB | US$2,40/mes | Más medidores de operaciones y montaje cuando apliquen |

IP y disco representan aproximadamente **US$6–7/mes**, más operaciones/tráfico. Si el cómputo no queda cubierto, el conjunto base se aproxima a **US$13–14/mes**. Son estimaciones, no cotización final. Fuente: [Azure Retail Prices API](https://prices.azure.com/api/retail/prices); [precios de IP](https://azure.microsoft.com/en-us/pricing/details/ip-addresses/).

El CI/CD no añade costos Azure: GitHub Actions y GHCR para repositorios públicos no se facturan; Run Command, la app de Entra ID y el rol personalizado no tienen costo. No se creó registro de pago, Bastion, NAT Gateway, balanceador ni servicios administrados. Se mantiene `spendingLimit: On`; un consumo fuera de las cantidades gratuitas descuenta crédito y agotarlo puede deshabilitar la suscripción, afectando también a otros proyectos. [Condiciones de estudiante](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/azurestudents-subscription-disabled).

## Infraestructura y aprovisionamiento

Despliegue incremental dentro del grupo existente (plantilla `infra/azure/vm.arm.json`, bootstrap `infra/azure/cloud-init.yaml`): `ceres-vm` con clave SSH pública y sin contraseña; `ceres-osdisk` SSD 32 GiB con `deleteOption: Detach`; `ceres-vnet`, `ceres-nsg`, `ceres-nic`, `ceres-pip` con etiqueta DNS. SSH cerrado por defecto; si hiciera falta, habilitarlo solo para un CIDR de administración verificado. Validación, what-if y aprovisionamiento `ceres-mvp` registrados como **Succeeded** antes de esta fase.

Recursos añadidos en esta fase, todos limitados a CERES: app de Entra ID `ceres-github-deploy` + service principal, credencial federada, rol personalizado `CERES VM Run Command Operator` (ámbito asignable: el grupo; asignación: solo la VM) y el entorno `production` del repositorio con sus variables.

## Operación, datos y apagado

- Cada publicación queda en `/opt/ceres/deployments.log` (versión, anterior, rollback) y en el historial de GitHub Actions.
- Para dejar de consumir cómputo, **desasignar** la VM desde Azure; apagar solo el sistema invitado no equivale a desasignarla. Disco e IP siguen costando con la VM desasignada.
- **Nunca eliminar `rodrygo-resource-group` para limpiar CERES**: aloja otros proyectos. Para retirar CERES, respaldar datos y borrar solo los recursos CERES enumerados, la app `ceres-github-deploy` y el rol personalizado.
