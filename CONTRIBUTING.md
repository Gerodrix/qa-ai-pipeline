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

## Controles automáticos para cambios nuevos

Para activar los avisos antes de cada commit en este clon (solo requiere Node.js y Git):

```sh
node scripts/install-git-hooks.mjs
```

El instalador conserva cualquier configuración de hooks existente y se detiene si detecta una diferente. Los hooks revisan el contenido que agregaste al índice y el mensaje del commit. Un mensaje debe usar `tipo(área opcional): descripción`, con una acción de al menos dos palabras y diez caracteres; el título completo puede tener hasta 100 caracteres. Se admiten español, inglés y los mensajes de merge o revert generados por Git. No se revisan ni se reescriben mensajes históricos.

`Repository policy` comprueba además el título del PR y los commits nuevos de la rama, rechaza credenciales locales y carpetas generadas versionadas y exige dependencias exactas con un lockfile coherente. Cambiar el título del PR vuelve a ejecutar el control. Los hooks son una ayuda local; el workflow funciona aunque no los instales. Estos controles detectan problemas concretos y no garantizan por sí solos la calidad del código.

```sh
node scripts/check-repository.mjs --repository
node --test scripts/repository-policy.test.mjs
```

Para integrar, el método previsto es squash con el título validado del PR como mensaje de commit. Las protecciones de `main` y las opciones de merge son configuración de GitHub y deben verificarse por separado; la presencia de este archivo no significa que ya estén activas.
