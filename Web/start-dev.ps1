# Script PowerShell de démarrage TIA INFO BUILD Web (Backend + Frontend)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  TIA INFO BUILD - Demarrage Web (XAMPP MySQL)   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Vérifier si XAMPP MySQL ou un port 3306 est actif
$mysqlActive = Get-NetTCPConnection -LocalPort 3306 -ErrorAction SilentlyContinue
if (-not $mysqlActive) {
    Write-Host "  ATTENTION : MySQL ne semble pas etre actif sur le port 3306." -ForegroundColor Yellow
    Write-Host " Assurez-vous d'avoir demarre MySQL dans XAMPP Control Panel !" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host " MySQL detecte sur le port 3306." -ForegroundColor Green
}

# 2. Appliquer les migrations Alembic (garde-fou : synchro du schema MySQL avec
#    les modèles SQLAlchemy pour eviter les erreurs 500 au login apres une mise a jour du code)
Write-Host " Application des migrations Alembic (alembic upgrade head)..." -ForegroundColor Green
Push-Location "$PSScriptRoot\backend"
try {
    if (Test-Path 'env\Scripts\Activate.ps1') { .\env\Scripts\Activate.ps1 }
    alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        Write-Host " ATTENTION : echec de la migration Alembic. Verifier le schema avec compare_schema.py." -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

# 2bis. Seed des donnees de base (roles, comptes de test, entreprise demo, abonnement).
# Idempotent : sans effet si les donnees existent deja. Garantit que les comptes de
# test (admin@tia.mg, demo@btppro.mg, client@btppro.mg, etc.) sont presents apres
# une creation de base / refonte des migrations, sinon login 401.
Write-Host " Initialisation des donnees de base (seed idempotent)..." -ForegroundColor Green
Push-Location "$PSScriptRoot\backend"
try {
    if (Test-Path 'env\Scripts\Activate.ps1') { .\env\Scripts\Activate.ps1 }
    python -m app.scripts.init_db
    if ($LASTEXITCODE -ne 0) {
        Write-Host " ATTENTION : echec du seed. Les comptes de test peuvent etre absents." -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

# 3. Démarrer Backend FastAPI
Write-Host " Lancement du Backend FastAPI (Port 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; if (Test-Path 'env\Scripts\Activate.ps1') { .\env\Scripts\Activate.ps1 }; uvicorn app.main:app --reload --port 8000"

# 4. Attendre 2 secondes puis démarrer Frontend React
Start-Sleep -Seconds 2
Write-Host " Lancement du Frontend React (Port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Les serveurs sont en cours de démarrage !" -ForegroundColor Green
Write-Host "   - Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "   - Backend  : http://localhost:8000/docs" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Cyan
