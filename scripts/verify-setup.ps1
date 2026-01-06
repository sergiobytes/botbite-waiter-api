# Colores
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🔍 BOTBITE - REDIS SETUP VERIFICATION" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Función para verificar
function Check-Item {
    param(
        [bool]$Condition,
        [string]$Message
    )
    if ($Condition) {
        Write-Host "✅ $Message" -ForegroundColor $Green
        return $true
    } else {
        Write-Host "❌ $Message" -ForegroundColor $Red
        return $false
    }
}

$errors = 0

# 1. Verificar Docker
Write-Host "📦 Checking Docker..." -ForegroundColor White
try {
    $dockerVersion = docker --version 2>$null
    Check-Item -Condition ($null -ne $dockerVersion) -Message "Docker installed"
} catch {
    Check-Item -Condition $false -Message "Docker installed"
    $errors++
}

# 2. Verificar Docker Compose
Write-Host "`n🐳 Checking Docker Compose..." -ForegroundColor White
try {
    $composeVersion = docker-compose --version 2>$null
    Check-Item -Condition ($null -ne $composeVersion) -Message "Docker Compose installed"
} catch {
    Check-Item -Condition $false -Message "Docker Compose installed"
    $errors++
}

# 3. Verificar servicios corriendo
Write-Host "`n🚀 Checking running services..." -ForegroundColor White

# PostgreSQL
$pgRunning = docker ps | Select-String "botbite-waiter-app"
Check-Item -Condition ($null -ne $pgRunning) -Message "PostgreSQL container running"
if ($null -eq $pgRunning) { $errors++ }

# Redis
$redisRunning = docker ps | Select-String "botbite-redis"
Check-Item -Condition ($null -ne $redisRunning) -Message "Redis container running"
if ($null -eq $redisRunning) { $errors++ }

# 4. Verificar conexión a Redis
Write-Host "`n🔌 Testing Redis connection..." -ForegroundColor White
try {
    $redisPing = docker exec botbite-redis redis-cli ping 2>$null
    if ($redisPing -eq "PONG") {
        Write-Host "✅ Redis responding (PONG)" -ForegroundColor $Green
    } else {
        Write-Host "❌ Redis not responding" -ForegroundColor $Red
        $errors++
    }
} catch {
    Write-Host "❌ Redis not responding" -ForegroundColor $Red
    $errors++
}

# 5. Verificar variables de entorno
Write-Host "`n🔧 Checking environment variables..." -ForegroundColor White

if (Test-Path .env) {
    Write-Host "✅ .env file exists" -ForegroundColor $Green
    
    $envContent = Get-Content .env -Raw
    
    Check-Item -Condition ($envContent -match "REDIS_URL") -Message "REDIS_URL defined"
    Check-Item -Condition ($envContent -match "QUEUE_PREFIX") -Message "QUEUE_PREFIX defined"
    Check-Item -Condition ($envContent -match "RATE_LIMIT_MAX") -Message "RATE_LIMIT_MAX defined"
    Check-Item -Condition ($envContent -match "CACHE_TTL") -Message "CACHE_TTL defined"
} else {
    Write-Host "❌ .env file not found" -ForegroundColor $Red
    Write-Host "   Run: Copy-Item .env.example .env" -ForegroundColor $Yellow
    $errors++
}

# 6. Verificar archivos de implementación
Write-Host "`n📄 Checking implementation files..." -ForegroundColor White

$files = @(
    "src/common/services/cache.service.ts",
    "src/messages/middlewares/rate-limit.middleware.ts",
    "src/health/health.controller.ts",
    "src/health/health.module.ts",
    "src/queue/queue.service.ts",
    "src/worker.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor $Green
    } else {
        Write-Host "❌ $file missing" -ForegroundColor $Red
        $errors++
    }
}

# 7. Verificar dependencias de npm
Write-Host "`n📦 Checking npm dependencies..." -ForegroundColor White

if (Test-Path node_modules) {
    Write-Host "✅ node_modules installed" -ForegroundColor $Green
    
    if (Test-Path "node_modules/ioredis") {
        Write-Host "✅ ioredis installed" -ForegroundColor $Green
    } else {
        Write-Host "❌ ioredis not installed" -ForegroundColor $Red
        Write-Host "   Run: npm install" -ForegroundColor $Yellow
        $errors++
    }
    
    if (Test-Path "node_modules/bullmq") {
        Write-Host "✅ bullmq installed" -ForegroundColor $Green
    } else {
        Write-Host "❌ bullmq not installed" -ForegroundColor $Red
        Write-Host "   Run: npm install" -ForegroundColor $Yellow
        $errors++
    }
} else {
    Write-Host "❌ node_modules not found" -ForegroundColor $Red
    Write-Host "   Run: npm install" -ForegroundColor $Yellow
    $errors++
}

# 8. Verificar documentación
Write-Host "`n📚 Checking documentation..." -ForegroundColor White

$docs = @(
    "REDIS-SETUP.md",
    "QUICK-START.md",
    "MONITORING.md",
    "ARCHITECTURE.md",
    "REDIS-IMPLEMENTATION-SUMMARY.md"
)

foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Host "✅ $doc" -ForegroundColor $Green
    } else {
        Write-Host "⚠️  $doc missing" -ForegroundColor $Yellow
    }
}

# 9. Resumen final
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "📊 SUMMARY" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

if ($errors -eq 0) {
    Write-Host "`n✅ All checks passed!" -ForegroundColor $Green
    Write-Host "🚀 Your project is ready for Redis integration" -ForegroundColor $Green
    Write-Host "`nNext steps:" -ForegroundColor White
    Write-Host "  1. Start the web server: npm run start:dev" -ForegroundColor White
    Write-Host "  2. Start the worker: npm run start:worker" -ForegroundColor White
    Write-Host "  3. Test health checks: curl http://localhost:3000/v1/health" -ForegroundColor White
} else {
    Write-Host "`n⚠️  Found $errors issue(s)" -ForegroundColor $Yellow
    Write-Host "Please review the errors above and fix them" -ForegroundColor $Yellow
    Write-Host "`nCommon fixes:" -ForegroundColor White
    Write-Host "  - Missing .env: Copy-Item .env.example .env" -ForegroundColor White
    Write-Host "  - Redis not running: docker-compose up -d" -ForegroundColor White
    Write-Host "  - Dependencies missing: npm install" -ForegroundColor White
}

Write-Host "`n=========================================" -ForegroundColor Cyan
