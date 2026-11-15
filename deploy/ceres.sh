#!/usr/bin/env bash
# Operación de CERES en ceres-vm. Se instala en /opt/ceres/ceres.sh y se ejecuta como root
# (vía Azure Run Command desde GitHub Actions, sin SSH).
#
#   ceres.sh deploy <tag>        respaldo → migraciones → seed → arranque → healthchecks; si falla, vuelve atrás
#   ceres.sh rollback [tag]      vuelve a la versión anterior (o a <tag>) sin migrar
#   ceres.sh backup [etiqueta]   pg_dump -Fc en /opt/ceres/backups
#   ceres.sh verify-backup [f]   restaura un respaldo en una base temporal y compara conteos
#   ceres.sh restore <archivo>   restaura la base desde un respaldo (detiene api/web mientras tanto)
#   ceres.sh status              versión, contenedores, memoria y salud
#
# Secretos: /opt/ceres/.env (modo 600). GHCR_TOKEN/OPENAI_API_KEY llegan como variables de entorno
# protegidas del Run Command; nunca se imprimen.
set -Eeuo pipefail

ROOT=/opt/ceres
ENV_FILE=$ROOT/.env
STATE=$ROOT/state
BACKUPS=$ROOT/backups
LOG=$ROOT/deployments.log
export DOCKER_CONFIG=$ROOT/.docker   # credenciales del registro aisladas y borradas al terminar
cd "$ROOT"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

dc() { docker compose --env-file "$ENV_FILE" -f "$ROOT/compose.yml" "$@"; }

ensure_env() {
  umask 077
  mkdir -p "$STATE" "$BACKUPS" "$DOCKER_CONFIG"
  if [[ ! -f $ENV_FILE ]]; then
    log "Creando $ENV_FILE con contraseña PostgreSQL aleatoria (solo en este servidor)"
    printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > "$ENV_FILE"
  fi
  set_env CERES_DOMAIN "${CERES_DOMAIN:-}"
  set_env CERES_REGISTRY "${CERES_REGISTRY:-}"
  # Las claves del asistente solo se actualizan si el workflow las envía (parámetros protegidos).
  if [[ -n ${GEMINI_API_KEY:-} ]]; then set_env GEMINI_API_KEY "$GEMINI_API_KEY"; fi
  if [[ -n ${GEMINI_MODEL:-} ]]; then set_env GEMINI_MODEL "$GEMINI_MODEL"; fi
  if [[ -n ${OPENAI_API_KEY:-} ]]; then set_env OPENAI_API_KEY "$OPENAI_API_KEY"; fi
  if [[ -n ${OPENAI_MODEL:-} ]]; then set_env OPENAI_MODEL "$OPENAI_MODEL"; fi
  chmod 600 "$ENV_FILE"
}

set_env() {
  local key=$1 value=$2
  [[ -z $value ]] && return 0
  if grep -q "^${key}=" "$ENV_FILE"; then
    local tmp; tmp=$(mktemp "$ROOT/.env.XXXX")
    grep -v "^${key}=" "$ENV_FILE" > "$tmp" || true
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

registry_login() {
  if [[ -n ${GHCR_TOKEN:-} ]]; then
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-github-actions}" --password-stdin >/dev/null
    log "Sesión temporal en ghcr.io iniciada"
  fi
}
registry_logout() { docker logout ghcr.io >/dev/null 2>&1 || true; rm -f "$DOCKER_CONFIG/config.json"; }

current_tag() { cat "$STATE/current" 2>/dev/null || true; }
previous_tag() { cat "$STATE/previous" 2>/dev/null || true; }

db_has_schema() {
  dc exec -T db psql -U ceres -d ceres -tAc "SELECT to_regclass('public.alembic_version') IS NOT NULL" 2>/dev/null | grep -q t
}

wait_healthy() {
  local service=$1 timeout=${2:-180} id state
  for ((i = 0; i < timeout; i += 5)); do
    id=$(dc ps -q "$service")
    state=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo missing)
    [[ $state == healthy ]] && { log "$service: healthy"; return 0; }
    sleep 5
  done
  log "$service no quedó healthy (estado: $state)"
  dc logs --tail 40 "$service" || true
  return 1
}

public_check() {
  local domain; domain=$(grep '^CERES_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)
  local expect_rev=$1
  for ((i = 0; i < 36; i++)); do
    # --resolve evita depender del DNS; el certificado sí se valida.
    if out=$(curl -fsS --max-time 10 --resolve "$domain:443:127.0.0.1" "https://$domain/api/v1/health" 2>/dev/null); then
      if [[ $out == *"\"revision\":\"$expect_rev\""* ]]; then
        log "HTTPS OK en https://$domain (revisión $expect_rev)"
        curl -fsS --max-time 10 --resolve "$domain:443:127.0.0.1" -o /dev/null "https://$domain/" && return 0
      fi
    fi
    sleep 5
  done
  log "HTTPS no respondió con la revisión esperada"
  return 1
}

start_version() {
  local tag=$1
  export CERES_TAG=$tag
  dc up -d --remove-orphans db
  wait_healthy db 120
  dc up -d --remove-orphans api web caddy
  reload_caddy_if_changed
  wait_healthy api 180 && wait_healthy web 120 && public_check "$tag"
}

# El Caddyfile se monta como archivo y Caddy (admin off) no recarga solo: si cambió, reiniciar.
# Los certificados viven en el volumen ceres_caddy_data y se conservan.
reload_caddy_if_changed() {
  local new old
  new=$(sha256sum "$ROOT/Caddyfile" | cut -d' ' -f1)
  old=$(cat "$STATE/caddyfile.sha256" 2>/dev/null || true)
  if [[ $new != "$old" ]]; then
    log "Caddyfile cambió: reiniciando caddy"
    dc restart caddy >/dev/null
    echo "$new" > "$STATE/caddyfile.sha256"
  fi
}

cmd_backup() {
  local label=${1:-manual}
  ensure_env
  mkdir -p "$BACKUPS"
  local f="$BACKUPS/ceres-$(date -u +%Y%m%dT%H%M%SZ)-$label.dump"
  dc exec -T db pg_dump -U ceres -d ceres -Fc > "$f"
  chmod 600 "$f"
  [[ -s $f ]] || die "respaldo vacío"
  log "Respaldo creado: $f ($(du -h "$f" | cut -f1))"
  # Retención local: 14 respaldos más recientes.
  ls -1t "$BACKUPS"/*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
  echo "$f"
}

counts_sql="SELECT 'users',count(*) FROM users UNION ALL SELECT 'parcels',count(*) FROM parcels UNION ALL SELECT 'revisions',count(*) FROM parcel_profile_revisions UNION ALL SELECT 'runs',count(*) FROM recommendation_runs UNION ALL SELECT 'messages',count(*) FROM messages UNION ALL SELECT 'sources',count(*) FROM sources ORDER BY 1"

cmd_verify_backup() {
  ensure_env
  local f=${1:-$(ls -1t "$BACKUPS"/*.dump 2>/dev/null | head -1)}
  [[ -f $f ]] || die "no hay respaldo para verificar"
  log "Verificando restauración de $f en base temporal ceres_restore_check"
  dc exec -T db psql -U ceres -d postgres -qc "DROP DATABASE IF EXISTS ceres_restore_check" >/dev/null
  dc exec -T db psql -U ceres -d postgres -qc "CREATE DATABASE ceres_restore_check" >/dev/null
  dc exec -T db pg_restore -U ceres -d ceres_restore_check --no-owner < "$f"
  local live restored
  restored=$(dc exec -T db psql -U ceres -d ceres_restore_check -tAc "$counts_sql")
  live=$(dc exec -T db psql -U ceres -d ceres -tAc "$counts_sql")
  dc exec -T db psql -U ceres -d postgres -qc "DROP DATABASE ceres_restore_check" >/dev/null
  log "Conteos restaurados: $(echo $restored)"
  log "Conteos en vivo:     $(echo $live)"
  [[ $restored == "$live" ]] && log "VERIFICACIÓN OK: el respaldo restaura los mismos conteos" || log "AVISO: los conteos difieren (puede haber escrituras posteriores al respaldo)"
}

cmd_restore() {
  local f=${1:?indica el archivo de respaldo}
  [[ -f $f ]] || die "no existe $f"
  ensure_env
  export CERES_TAG=$(current_tag)
  cmd_backup pre-restore >/dev/null
  log "Restaurando $f (api/web detenidos durante la operación)"
  dc stop api web
  dc exec -T db pg_restore -U ceres -d ceres --clean --if-exists --no-owner < "$f"
  dc start api web
  wait_healthy api 180
  log "Restauración terminada"
}

cmd_deploy() {
  local tag=${1:?indica la etiqueta (SHA) de la imagen}
  ensure_env
  local prev; prev=$(current_tag)
  log "Desplegando $tag (versión actual: ${prev:-ninguna})"
  registry_login
  export CERES_TAG=$tag
  dc pull --quiet api web db caddy || { registry_logout; die "no se pudieron descargar las imágenes $tag"; }
  registry_logout

  dc up -d db
  wait_healthy db 120 || die "PostgreSQL no arrancó"
  if db_has_schema; then cmd_backup "pre-$tag" >/dev/null; else log "Base vacía: primer despliegue, sin respaldo previo"; fi

  log "Migraciones (alembic upgrade head)"
  dc run --rm --no-deps api alembic upgrade head
  log "Carga reproducible de fuentes, instantánea NASA y caso demo"
  dc run --rm --no-deps api python -m ceres.cli seed >/dev/null

  if start_version "$tag"; then
    [[ -n $prev && $prev != "$tag" ]] && echo "$prev" > "$STATE/previous"
    echo "$tag" > "$STATE/current"
    printf '%s deploy %s (anterior: %s)\n' "$(date -u +%FT%TZ)" "$tag" "${prev:-ninguna}" >> "$LOG"
    docker image prune -f >/dev/null
    log "DESPLIEGUE OK: $tag"
    cmd_status
  else
    log "La versión $tag no pasó los healthchecks"
    if [[ -n $prev && $prev != "$tag" ]]; then
      log "Rollback automático a $prev (las migraciones no se revierten; ver despliegue.md)"
      start_version "$prev" || log "El rollback tampoco quedó sano: revisar manualmente"
      printf '%s deploy-fallido %s → rollback %s\n' "$(date -u +%FT%TZ)" "$tag" "$prev" >> "$LOG"
    fi
    exit 1
  fi
}

cmd_rollback() {
  ensure_env
  local target=${1:-$(previous_tag)}
  [[ -n $target ]] || die "no hay versión anterior registrada"
  local cur; cur=$(current_tag)
  log "Rollback de ${cur:-?} a $target (sin migrar; si el esquema no es compatible, usar restore)"
  registry_login
  export CERES_TAG=$target
  dc pull --quiet api web || { registry_logout; die "no se pudieron descargar las imágenes $target"; }
  registry_logout
  if start_version "$target"; then
    echo "$target" > "$STATE/current"
    [[ -n $cur ]] && echo "$cur" > "$STATE/previous"
    printf '%s rollback %s → %s\n' "$(date -u +%FT%TZ)" "${cur:-?}" "$target" >> "$LOG"
    log "ROLLBACK OK: $target"
    cmd_status
  else
    die "el rollback a $target no pasó los healthchecks"
  fi
}

cmd_status() {
  export CERES_TAG=${CERES_TAG:-$(current_tag)}
  log "Versión actual: $(current_tag) · anterior: $(previous_tag)"
  dc ps --format 'table {{.Service}}\t{{.Status}}'
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' | grep -E 'NAME|ceres' || true
  free -m | head -2
  tail -n 5 "$LOG" 2>/dev/null || true
}

# Compose exige CERES_TAG para interpolar las imágenes: por defecto, la versión en servicio.
export CERES_TAG=${CERES_TAG:-$(current_tag)}

case ${1:-} in
  deploy) shift; cmd_deploy "$@" ;;
  rollback) shift; cmd_rollback "$@" ;;
  backup) shift; cmd_backup "$@" ;;
  verify-backup) shift; cmd_verify_backup "$@" ;;
  restore) shift; cmd_restore "$@" ;;
  status) cmd_status ;;
  *) echo "uso: $0 {deploy <tag>|rollback [tag]|backup|verify-backup [f]|restore <f>|status}"; exit 2 ;;
esac
