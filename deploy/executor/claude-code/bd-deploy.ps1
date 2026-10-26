<#
.SYNOPSIS
  Cliente restringido del ejecutor de despliegue de bydlight2 (bd-deploy). Es lo UNICO que Claude Code puede invocar
  hacia el servidor para este proyecto: no abre shell, no acepta comandos libres y valida cada parametro antes de conectar.

.EXAMPLE
  powershell -NoProfile -File bd-deploy.ps1 -Op status
  powershell -NoProfile -File bd-deploy.ps1 -Op build -OpArgs <sha40>

  La validacion definitiva la hace el servidor (bd-gate/bd-run con la politica de root); esta es la primera capa.
  Requiere la entrada `Host bd-deploy` (ver ssh-config.example) con una clave EXCLUSIVA para la cuenta `bddeploy`.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidateSet(
        'status', 'preflight', 'verify', 'compose-diff', 'list-releases', 'job-status', 'logs',
        'fetch', 'build', 'up', 'rollback', 'accept-compose')][string]$Op,
    [ValidatePattern('(?-i)\A[a-z0-9][a-z0-9,-]{0,127}\z')][string[]]$OpArgs = @()
)
$ErrorActionPreference = 'Stop'
# Anclas estrictas (\A ... \z) y comparacion sensible a mayusculas: '$' de .NET acepta un salto de linea final y
# -notmatch ignora mayusculas. El servidor valida de nuevo con la misma gramatica.
$OpArgs = @($OpArgs | ForEach-Object { $_ -split ',' })
foreach ($a in $OpArgs) { if ($a -cnotmatch '\A[a-z0-9][a-z0-9-]{0,63}\z') { throw 'Argumento con formato invalido.' } }

# Numero de argumentos esperado por operacion (espejo de bd_lib.OPS; una prueba verifica que no diverjan).
$Arity = @{
    'status' = 0; 'preflight' = 0; 'verify' = 0; 'compose-diff' = 0; 'list-releases' = 0; 'job-status' = 1; 'logs' = 1
    'fetch' = 1; 'build' = 1; 'up' = 1; 'rollback' = 0; 'accept-compose' = 1
}
if ($OpArgs.Count -ne $Arity[$Op]) { throw "Operacion '$Op': se esperaban $($Arity[$Op]) argumento(s)." }

$request = (@($Op) + $OpArgs) -join ' '
if ($request.Length -gt 100 -or $request -cnotmatch '\A[a-z0-9-]+( [a-z0-9-]+){0,2}\z') { throw 'Peticion con formato invalido.' }

$cfg = Join-Path $HOME '.ssh\bd-deploy.config'
if (-not (Test-Path -LiteralPath $cfg)) { throw "Falta $cfg (copie ssh-config.example y ajuste las rutas)." }

# Argumentos FIJOS: sin pty, sin agente, sin reenvio, sin comandos libres, solo la clave dedicada.
& ssh.exe -F $cfg -o BatchMode=yes -o ConnectTimeout=30 -o IdentitiesOnly=yes -o ForwardAgent=no -o ForwardX11=no `
    -o RequestTTY=no -o ClearAllForwardings=yes bd-deploy $request
exit $LASTEXITCODE
