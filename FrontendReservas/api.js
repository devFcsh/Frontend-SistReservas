// Cliente central de la API.
// Todas las llamadas al backend pasan por aquí para enviar el token
// y manejar de forma uniforme la sesión cerrada (401) y la falta de permisos (403).

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5128') + '/api';

const CLAVES_SESION = ['token', 'usuario', 'rol'];

// Evento que escucha App.jsx para volver al login cuando la sesión deja de ser válida
export const EVENTO_SESION_CERRADA = 'sesion-cerrada';

export function leerSesion() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return {
      token,
      usuario: localStorage.getItem('usuario') || '',
      rol: localStorage.getItem('rol') || ''
    };
  } catch {
    return null;
  }
}

export function guardarSesion({ token, usuario, rol }) {
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', usuario);
  localStorage.setItem('rol', rol);
}

export function limpiarSesion() {
  CLAVES_SESION.forEach(clave => localStorage.removeItem(clave));
}

/**
 * Llama a la API agregando el token.
 * @param {string} ruta  Ruta relativa, por ejemplo "/reporte".
 * @param {object} opciones  Opciones de fetch. `publica: true` evita cerrar la sesión ante un 401
 *                           (se usa en el login, donde 401 significa credenciales incorrectas).
 */
export async function api(ruta, opciones = {}) {
  const { publica = false, headers, ...resto } = opciones;
  const token = localStorage.getItem('token');

  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...resto,
    headers: {
      'Content-Type': 'application/json',
      ...(token && !publica ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  });

  const datos = await respuesta.json().catch(() => null);

  if (respuesta.status === 401 && !publica) {
    limpiarSesion();
    window.dispatchEvent(new Event(EVENTO_SESION_CERRADA));
    throw new Error('Tu sesión se cerró. Vuelve a iniciar sesión.');
  }

  if (!respuesta.ok) {
    if (respuesta.status === 403) throw new Error('No tienes permiso para esta acción.');
    // Algunos endpoints devuelven el error en "error" y otros en "message"
    throw new Error(datos?.error ?? datos?.message ?? 'Error inesperado.');
  }

  return datos;
}
