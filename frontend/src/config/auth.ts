// ⚠️ CONFIGURACIÓN DE SEGURIDAD
// Este archivo contiene configuraciones sensibles que deben ser cambiadas en producción

export const AUTH_PIN = "1234"; // CAMBIAR ESTO EN PRODUCCIÓN - Mínimo 4 dígitos
export const SESSION_KEY = "sunass_authenticated";
export const SESSION_TIME_KEY = "sunass_login_time";

// Validación de PIN
export const validatePin = (pin: string): boolean => {
  return pin === AUTH_PIN;
};

// Limpiar sesión
export const clearSession = (): void => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TIME_KEY);
};

// Obtener estado de autenticación
export const isAuthenticated = (): boolean => {
  return localStorage.getItem(SESSION_KEY) === "true";
};

// Establecer sesión
export const setSession = (): void => {
  localStorage.setItem(SESSION_KEY, "true");
  localStorage.setItem(SESSION_TIME_KEY, new Date().toISOString());
};
