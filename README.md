<p align="center">
  <img src="/assets/logo-removebg-preview.png" width="180" alt="BotBite Logo" />
</p>

# BotBite API

API para gestión de restaurantes, sucursales, productos, usuarios y catálogos globales.

## Instalación

```bash
npm install
```

## Estructura del proyecto

La carpeta principal del código fuente es `src/` y está organizada en módulos funcionales:

| Carpeta          | Descripción                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| **auth/**        | Autenticación y autorización JWT, guards, decoradores y estrategias                                 |
| **branches/**    | Sucursales de restaurantes: CRUD, activación, carga masiva CSV, QR, relación con restaurante        |
| **categories/**  | Catálogo global de categorías: CRUD, solo admin/super                                               |
| **common/**      | Entidades base, paginación, traducción, decoradores y utilidades compartidas                        |
| **customers/**   | Clientes: CRUD, validación de unicidad, relación con órdenes                                        |
| **menus/**       | Menús de sucursal: CRUD de menús y items, relación con productos y categorías                       |
| **orders/**      | Órdenes: CRUD, relación con clientes, sucursales y productos, gestión de items de orden            |
| **products/**    | Productos de restaurante: CRUD, carga masiva CSV, activación, relación con restaurante y categorías |
| **restaurants/** | Restaurantes: CRUD, activación, relación con usuario y sucursales                                   |
| **users/**       | Usuarios: registro, login, roles, CRUD, relación con restaurantes                                   |

## Migraciones de base de datos

El proyecto utiliza TypeORM para la gestión de migraciones. Las migraciones se encuentran en `src/database/migrations/`.

### Crear una nueva migración

```bash
npm run migration:generate src/database/migrations/NombreDeLaMigracion
```

### Aplicar las migraciones pendientes

```bash
npm run migration:run
```

### Revertir la última migración

```bash
npm run migration:revert
```

> **Nota:** Asegúrate de tener configuradas las variables de entorno de la base de datos antes de ejecutar migraciones.

## Ejecutar el proyecto

```bash
# desarrollo
npm run start

# modo watch
npm run start:dev

# producción
npm run start:prod
```

## Pruebas

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## ¿Cómo hacer merge de una rama feature a main?

Sigue estos pasos para fusionar tu rama de desarrollo (feature) a `main`:

```bash
# 1. Guarda tus cambios y haz commit (si falta)
git add .
git commit -m "feat: describe tu cambio principal"

# 2. Cambia a la rama main
git checkout main

# 3. Trae los últimos cambios de remoto
git pull origin main

# 4. Haz el merge de tu rama feature (ajusta el nombre si es diferente)
git merge nombre-de-tu-rama

# 5. Sube los cambios a remoto
git push origin main

# 6. Borra la rama local y remota (opcional)
git branch -d nombre-de-tu-rama
git push origin --delete nombre-de-tu-rama
```

> **Recuerda:** Resuelve cualquier conflicto que aparezca durante el merge antes de hacer push.

## Licencia

BotBite API es un proyecto open source bajo licencia MIT.
