#!/usr/bin/env bash
# Desinstala el ejecutor bd-deploy (revierte install.sh). No toca el usuario bddeploy, el proyecto Docker en ejecucion,
# el clon /srv/bydlight-prod ni las imagenes: solo retira wrappers, politica, claves, sudoers y bloque sshd.
#   sudo bash uninstall.sh            # plan
#   sudo bash uninstall.sh --apply
set -Eeuo pipefail
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
[ "$(id -u)" -eq 0 ] || { echo "ejecute como root" >&2; exit 1; }
FILES=(/etc/sudoers.d/bd-deploy /etc/ssh/sshd_config.d/50-bd-deploy.conf /usr/local/sbin/bd-gate /usr/local/sbin/bd-run
       /usr/local/sbin/bd-approve /var/lib/bd-deploy-home/.ssh/authorized_keys)
DIRS=(/usr/local/lib/bd-deploy /etc/bd-deploy)
for f in "${FILES[@]}" "${DIRS[@]}"; do if [ -e "$f" ]; then echo "  - se retira $f"; fi; done
echo "  - se CONSERVAN /var/lib/bd-deploy (estado) y /var/log/bd-deploy (auditoria)"
[ "$APPLY" -eq 1 ] || { echo "(plan) agregue --apply"; exit 0; }
rm -f "${FILES[@]}"; rm -rf "${DIRS[@]}"
if sshd -t; then systemctl reload ssh 2>/dev/null || true; fi
echo "desinstalado"
