# carregar_dados.ps1
# Cria o banco hospital_indicadores e carrega todos os dados sinteticos.
# Execute no PowerShell: .\carregar_dados.ps1

$MYSQL = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$DIR   = $PSScriptRoot

# ── credenciais ──────────────────────────────────────────────────────────────
$usuario = Read-Host "Usuario MySQL (Enter para 'root')"
if ([string]::IsNullOrWhiteSpace($usuario)) { $usuario = "root" }

$secSenha = Read-Host "Senha do MySQL" -AsSecureString
$senha    = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR(
                [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secSenha))

# ── funcao helper ─────────────────────────────────────────────────────────────
function Rodar-SQL {
    param([string]$Arquivo, [string]$Descricao)
    Write-Host "`n>> $Descricao" -ForegroundColor Cyan
    $result = cmd /c "`"$MYSQL`" -u$usuario -p`"$senha`" --default-character-set=utf8mb4 < `"$Arquivo`"" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ERRO:" -ForegroundColor Red
        $result | ForEach-Object { Write-Host "   $_" }
        return $false
    }
    Write-Host "   OK" -ForegroundColor Green
    return $true
}

# ── execucao em ordem ─────────────────────────────────────────────────────────
Write-Host "`n=====================================================" -ForegroundColor Yellow
Write-Host "  Hospital Indicadores -- Carga do Banco de Dados"    -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Yellow

$passos = @(
    @{ Arquivo = "$DIR\schema.sql";                       Desc = "[1/7] Schema + dados de dominio" },
    @{ Arquivo = "$DIR\data\inserts_pacientes.sql";       Desc = "[2/7] Pacientes (400 registros)" },
    @{ Arquivo = "$DIR\data\inserts_leitos.sql";          Desc = "[3/7] Leitos (150 registros)" },
    @{ Arquivo = "$DIR\data\inserts_profissionais.sql";   Desc = "[4/7] Profissionais (110 registros)" },
    @{ Arquivo = "$DIR\data\inserts_plantoes.sql";        Desc = "[5/7] Plantoes (~1.654 registros)" },
    @{ Arquivo = "$DIR\data\inserts_internacoes.sql";     Desc = "[6/7] Internacoes (500 registros)" },
    @{ Arquivo = "$DIR\data\inserts_fila_espera.sql";     Desc = "[7/7] Fila de espera (~4.872 registros)" }
)

$ok = $true
foreach ($passo in $passos) {
    $ok = Rodar-SQL -Arquivo $passo.Arquivo -Descricao $passo.Desc
    if (-not $ok) {
        Write-Host "`nCarga interrompida. Corrija o erro acima e execute novamente." -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n=====================================================" -ForegroundColor Yellow
Write-Host "  Concluido! Banco 'hospital_indicadores' pronto."     -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Yellow
