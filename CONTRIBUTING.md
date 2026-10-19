# Guía de contribución

## Cambios pequeños y verificables

Partí de una rama actualizada y usá una rama por objetivo, por ejemplo `fix/server-build-assets` o `docs/local-setup`. Revisá `git status` y `git diff` antes de agregar archivos. Agregá rutas explícitas con `git add <ruta>` para evitar incluir trabajo ajeno o temporal.

No versionés secretos, `node_modules`, builds, reportes generados ni estado del editor. Conservá los lockfiles. Para instalar las versiones registradas, usá `npm ci`. Las actualizaciones de dependencias deben revisar el manifiesto y el lockfile juntos.

## Mensajes de commit

Usá un mensaje breve que describa el cambio. Convención para cambios nuevos:

```text
<tipo>(<área opcional>): <acción y resultado>

fix(server): include paytable in compiled build
docs: explain local setup and known limitations
ci: validate builds on pull requests
```

Tipos habituales: `feat`, `fix`, `docs`, `test`, `refactor`, `chore` y `ci`. Español o inglés son válidos; mantené consistencia dentro del cambio. Evitá mensajes como `update`, `cosas` o `final final`. El cuerpo puede explicar el motivo y la validación cuando haga falta.

El historial publicado se conserva. No uses force push sobre ramas compartidas para cambiar mensajes antiguos. En una rama propia todavía no compartida, podés ordenar commits antes de abrir el PR.

## Validación

Node.js 22; la versión de referencia está en `.nvmrc`. Desde la raíz:

```sh
npm --prefix generator ci
npm --prefix notifier ci
npm --prefix runner ci
npm --prefix target-app ci
npm --prefix generator run typecheck
npm --prefix notifier run typecheck
npm --prefix runner run typecheck
npm --prefix target-app run typecheck
npm --prefix target-app run build
# Chromium: ver README.md para validar y ejecutar los casos de control.
```

Cada PR debe explicar el problema, la solución y qué se probó realmente. Un build correcto no equivale a una revisión visual o a una prueba integral del producto. Documentá los pendientes; no declares mediciones o pruebas que no realizaste.

La integración de cambios y cualquier publicación se revisan por separado. No agregues un despliegue como efecto secundario de una tarea de mantenimiento.
