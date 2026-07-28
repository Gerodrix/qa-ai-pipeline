// Registration form with hand-written validation (deliberately not relying
// on native HTML5 validation — see project decisions in the qa-ai-pipeline
// skill/memory for why: custom error text gives the QA pipeline
// deterministic, assertable messages instead of browser-dependent tooltips).

const form = document.querySelector<HTMLFormElement>('#register-form')!;
const nameInput = document.querySelector<HTMLInputElement>('#name')!;
const emailInput = document.querySelector<HTMLInputElement>('#email')!;
const passwordInput = document.querySelector<HTMLInputElement>('#password')!;
const confirmInput = document.querySelector<HTMLInputElement>('#confirm-password')!;
const termsInput = document.querySelector<HTMLInputElement>('#terms')!;
const successMessage = document.querySelector<HTMLParagraphElement>('#success-message')!;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setError(fieldId: string, message: string) {
  const el = document.querySelector<HTMLSpanElement>(`#${fieldId}-error`);
  if (el) el.textContent = message;
}

function clearErrors() {
  ['name', 'email', 'password', 'confirm', 'terms'].forEach((id) => setError(id, ''));
}

function validateName(): string {
  const value = nameInput.value.trim();
  if (value.length === 0) return 'El nombre es obligatorio.';
  if (value.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  return '';
}

function validateEmail(): string {
  const value = emailInput.value.trim();
  if (value.length === 0) return 'El email es obligatorio.';
  if (!EMAIL_PATTERN.test(value)) return 'El formato del email no es válido.';
  return '';
}

function validatePassword(): string {
  const value = passwordInput.value;
  if (value.length === 0) return 'La contraseña es obligatoria.';
  if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/\d/.test(value)) return 'La contraseña debe incluir al menos un número.';
  return '';
}

function validateConfirm(): string {
  if (confirmInput.value.length === 0) return 'Confirmá tu contraseña.';
  if (confirmInput.value !== passwordInput.value) return 'Las contraseñas no coinciden.';
  return '';
}

function validateTerms(): string {
  if (!termsInput.checked) return 'Tenés que aceptar los términos y condiciones.';
  return '';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearErrors();
  successMessage.hidden = true;

  const errors = {
    name: validateName(),
    email: validateEmail(),
    password: validatePassword(),
    confirm: validateConfirm(),
    terms: validateTerms(),
  };

  let hasError = false;
  for (const [field, message] of Object.entries(errors)) {
    if (message) {
      setError(field, message);
      hasError = true;
    }
  }

  if (!hasError) {
    form.hidden = true;
    successMessage.hidden = false;
  }
});
