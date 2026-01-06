#!/bin/bash

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "🔍 BOTBITE - REDIS SETUP VERIFICATION"
echo "========================================="
echo ""

# Función para verificar comando
check_command() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        return 0
    else
        echo -e "${RED}❌ $1${NC}"
        return 1
    fi
}

# 1. Verificar Docker
echo "📦 Checking Docker..."
docker --version > /dev/null 2>&1
check_command "Docker installed"

# 2. Verificar Docker Compose
echo ""
echo "🐳 Checking Docker Compose..."
docker-compose --version > /dev/null 2>&1
check_command "Docker Compose installed"

# 3. Verificar servicios corriendo
echo ""
echo "🚀 Checking running services..."

# PostgreSQL
docker ps | grep botbite-waiter-app > /dev/null 2>&1
check_command "PostgreSQL container running"

# Redis
docker ps | grep botbite-redis > /dev/null 2>&1
check_command "Redis container running"

# 4. Verificar conexión a Redis
echo ""
echo "🔌 Testing Redis connection..."
REDIS_PING=$(docker exec botbite-redis redis-cli ping 2>/dev/null)
if [ "$REDIS_PING" = "PONG" ]; then
    echo -e "${GREEN}✅ Redis responding (PONG)${NC}"
else
    echo -e "${RED}❌ Redis not responding${NC}"
fi

# 5. Verificar variables de entorno necesarias
echo ""
echo "🔧 Checking environment variables..."

if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    
    # Verificar variables críticas
    grep -q "REDIS_URL" .env
    check_command "REDIS_URL defined"
    
    grep -q "QUEUE_PREFIX" .env
    check_command "QUEUE_PREFIX defined"
    
    grep -q "RATE_LIMIT_MAX" .env
    check_command "RATE_LIMIT_MAX defined"
    
    grep -q "CACHE_TTL" .env
    check_command "CACHE_TTL defined"
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo -e "${YELLOW}   Run: cp .env.example .env${NC}"
fi

# 6. Verificar archivos de implementación
echo ""
echo "📄 Checking implementation files..."

files=(
    "src/common/services/cache.service.ts"
    "src/messages/middlewares/rate-limit.middleware.ts"
    "src/health/health.controller.ts"
    "src/health/health.module.ts"
    "src/queue/queue.service.ts"
    "src/worker.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file missing${NC}"
    fi
done

# 7. Verificar dependencias de npm
echo ""
echo "📦 Checking npm dependencies..."

if [ -d node_modules ]; then
    echo -e "${GREEN}✅ node_modules installed${NC}"
    
    # Verificar paquetes específicos
    if [ -d "node_modules/ioredis" ]; then
        echo -e "${GREEN}✅ ioredis installed${NC}"
    else
        echo -e "${RED}❌ ioredis not installed${NC}"
        echo -e "${YELLOW}   Run: npm install${NC}"
    fi
    
    if [ -d "node_modules/bullmq" ]; then
        echo -e "${GREEN}✅ bullmq installed${NC}"
    else
        echo -e "${RED}❌ bullmq not installed${NC}"
        echo -e "${YELLOW}   Run: npm install${NC}"
    fi
else
    echo -e "${RED}❌ node_modules not found${NC}"
    echo -e "${YELLOW}   Run: npm install${NC}"
fi

# 8. Verificar documentación
echo ""
echo "📚 Checking documentation..."

docs=(
    "REDIS-SETUP.md"
    "QUICK-START.md"
    "MONITORING.md"
    "ARCHITECTURE.md"
    "REDIS-IMPLEMENTATION-SUMMARY.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✅ $doc${NC}"
    else
        echo -e "${YELLOW}⚠️  $doc missing${NC}"
    fi
done

# 9. Resumen final
echo ""
echo "========================================="
echo "📊 SUMMARY"
echo "========================================="

# Contar errores
ERRORS=0

docker ps | grep botbite-redis > /dev/null 2>&1 || ((ERRORS++))
[ -f .env ] || ((ERRORS++))
[ -f "src/common/services/cache.service.ts" ] || ((ERRORS++))

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}"
    echo "✅ All checks passed!"
    echo "🚀 Your project is ready for Redis integration"
    echo ""
    echo "Next steps:"
    echo "  1. Start the web server: npm run start:dev"
    echo "  2. Start the worker: npm run start:worker"
    echo "  3. Test health checks: curl http://localhost:3000/v1/health"
    echo -e "${NC}"
else
    echo -e "${YELLOW}"
    echo "⚠️  Found $ERRORS issue(s)"
    echo "Please review the errors above and fix them"
    echo ""
    echo "Common fixes:"
    echo "  - Missing .env: cp .env.example .env"
    echo "  - Redis not running: docker-compose up -d"
    echo "  - Dependencies missing: npm install"
    echo -e "${NC}"
fi

echo "========================================="
