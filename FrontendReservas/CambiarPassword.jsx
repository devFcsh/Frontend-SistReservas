import React, { useState } from 'react';
import { api } from './api.js';

// Cambio de contraseña del usuario que tiene la sesión abierta (ambos roles)
function CambiarPassword({ mostrarToast }) {
  const [form, setForm] = useState({ passwordActual: '', passwordNueva: '', confirmar: '' });
  const [guardando, setGuardando] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.passwordNueva.length < 8) {
      mostrarToast('La nueva contraseña debe tener al menos 8 caracteres.', 'error');
      return;
    }
    if (form.passwordNueva !== form.confirmar) {
      mostrarToast('La confirmación no coincide con la nueva contraseña.', 'error');
      return;
    }
    setGuardando(true);
    try {
      const datos = await api('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ passwordActual: form.passwordActual, passwordNueva: form.passwordNueva })
      });
      mostrarToast(datos?.message || '🔑 Contraseña actualizada. Se cerraron tus otras sesiones.', 'salida-success');
      setForm({ passwordActual: '', passwordNueva: '', confirmar: '' });
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="view-active animate-fade-in">
      <h2>Cambiar mi Contraseña</h2>
      <form onSubmit={handleSubmit} className="form-column">
        <div className="form-group">
          <label>Contraseña actual</label>
          <input type="password" name="passwordActual" className="form-input" value={form.passwordActual}
            onChange={handleChange} autoComplete="current-password" required />
        </div>
        <div className="form-group">
          <label>Nueva contraseña</label>
          <input type="password" name="passwordNueva" className="form-input" placeholder="Mínimo 8 caracteres"
            value={form.passwordNueva} onChange={handleChange} autoComplete="new-password" required />
        </div>
        <div className="form-group">
          <label>Confirmar nueva contraseña</label>
          <input type="password" name="confirmar" className="form-input" value={form.confirmar}
            onChange={handleChange} autoComplete="new-password" required />
        </div>
        <p className="modal-nota">Tu sesión actual seguirá abierta; las demás sesiones de tu usuario se cerrarán.</p>
        <button type="submit" className="btn btn-entrada" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Actualizar Contraseña'}
        </button>
      </form>
    </section>
  );
}

export default CambiarPassword;
