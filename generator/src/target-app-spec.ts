// generator/src/target-app-spec.ts
//
// The generator never looks at the real DOM (that's deliberate — see the
// project README for why we're not using an autonomous browser agent).
// Instead, it reasons over this hand-written description. If target-app's
// form ever changes, this is the one file that needs updating to keep the
// generator accurate.

export const TARGET_APP_SPEC = `
Formulario de registro en http://localhost:5173 (target-app). Campos:

1. Nombre — selector "#name"
   - Obligatorio, mínimo 2 caracteres.
   - Error se muestra en "#name-error".

2. Email — selector "#email"
   - Obligatorio, debe tener formato "algo@algo.algo".
   - Error se muestra en "#email-error".

3. Contraseña — selector "#password"
   - Obligatoria, mínimo 8 caracteres, debe incluir al menos un número.
   - Error se muestra en "#password-error".

4. Confirmar contraseña — selector "#confirm-password"
   - Obligatoria, debe coincidir exactamente con "#password".
   - Error se muestra en "#confirm-error".

5. Términos y condiciones — checkbox, selector "#terms"
   - Debe estar tildado para poder enviar el formulario.

Botón de envío: selector "#submit-btn".

Si TODOS los campos son válidos: se oculta el formulario y aparece
"#success-message".

Si algún campo es inválido: aparece el mensaje de error correspondiente a
ESE campo (ver selectores arriba), el formulario NO se envía.
`.trim();
