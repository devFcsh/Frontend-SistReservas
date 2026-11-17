import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import Modal from './Modal.jsx';

const ROLES = ['Laboratorio', 'Admin'];
const REGEX_USUARIO = /^[A-Za-z0-9._-]{3,50}$/;

const formatearFecha = (iso) => {
  if (!iso) return '—';
  const [fecha, hora = ''] = iso.split('T');
  return `${fecha} ${hora.slice(0, 5)}`;
};

// Panel de gestión de usuarios (solo Admin)
function PanelUsuarios({ usuarioActual, mostrarToast }) {
  const [usuarios, setUsuarios] = useState([]);
  const [nuevo, setNuevo] = useState({ usuario: '', password: '', rol: ROLES[0] });
  const [modalPassword, setModalPassword] = useState(null); // usuario al que se le cambia la contraseña
  const [passwordNueva, setPasswordNueva] = useState('');
  const [modalEliminar, setModalEliminar] = useState(null);

  const cargarUsuarios = async () => {
    try {
      setUsuarios(await api('/usuarios'));
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  };

  useEffect(() => { cargarUsuarios(); }, []);

  const ejecutar = async (accion, mensajeExito) => {
    try {
      const datos = await accion();
      mostrarToast(datos?.message || mensajeExito, 'entrada-success');
      await cargarUsuarios();
      return true;
    } catch (err) {
      mostrarToast(err.message, 'error');
      return false;
    }
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!REGEX_USUARIO.test(nuevo.usuario)) {
      mostrarToast('El usuario debe tener de 3 a 50 caracteres (letras, números, punto, guion o guion bajo).', 'error');
      return;
    }
    if (nuevo.password.length < 8) {
      mostrarToast('La contraseña debe tener al menos 8 caracteres.', 'error');
      return;
    }
    const ok = await ejecutar(
      () => api('/usuarios', { method: 'POST', body: JSON.stringify(nuevo) }),
      `Usuario "${nuevo.usuario}" creado`
    );
    if (ok) setNuevo({ usuario: '', password: '', rol: nuevo.rol });
  };

  const cambiarRol = (u, rol) => ejecutar(
    () => api(`/usuarios/${u.id}`, { method: 'PUT', body: JSON.stringify({ rol }) }),
    `Rol de "${u.usuario}" actualizado a ${rol}`
  );

  const cambiarActivo = (u) => ejecutar(
    () => api(`/usuarios/${u.id}`, { method: 'PUT', body: JSON.stringify({ activo: !u.activo }) }),
    u.activo ? `Usuario "${u.usuario}" desactivado` : `Usuario "${u.usuario}" activado`
  );

  const cerrarSesiones = (u) => ejecutar(
    () => api(`/usuarios/${u.id}/cerrar-sesiones`, { method: 'POST' }),
    `Sesiones de "${u.usuario}" cerradas`
  );

  const guardarPassword = async (e) => {
    e.preventDefault();
    if (passwordNueva.length < 8) {
      mostrarToast('La contraseña debe tener al menos 8 caracteres.', 'error');
      return;
    }
    const ok = await ejecutar(
      () => api(`/usuarios/${modalPassword.id}/password`, { method: 'PUT', body: JSON.stringify({ password: passwordNueva }) }),
      `Contraseña de "${modalPassword.usuario}" actualizada`
    );
    if (ok) { setModalPassword(null); setPasswordNueva(''); }
  };

  const confirmarEliminar = async () => {
    const ok = await ejecutar(
      () => api(`/usuarios/${modalEliminar.id}`, { method: 'DELETE' }),
      `Usuario "${modalEliminar.usuario}" eliminado`
    );
    if (ok) setModalEliminar(null);
  };

  return (
    <section className="view-active animate-fade-in">
      <h2>Gestión de Usuarios</h2>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '20px' }}>
        Cuentas con acceso al sistema del Laboratorio L002.
      </p>

      <form onSubmit={handleCrear} className="usuarios-crear">
        <div className="form-group">
          <label>Usuario</label>
          <input className="form-input" placeholder="Ej. lab.turno1" value={nuevo.usuario} maxLength={50}
            onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value.trim() })} required />
        </div>
        <div className="form-group">
          <label>Contraseña</label>
          <input type="password" className="form-input" placeholder="Mínimo 8 caracteres" value={nuevo.password}
            onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} autoComplete="new-password" required />
        </div>
        <div className="form-group">
          <label>Rol</label>
          <select className="form-select" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-entrada usuarios-crear-btn">➕ Crear usuario</button>
      </form>

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Sesiones</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay usuarios para mostrar.</td></tr>
            )}
            {usuarios.map(u => {
              const esPropio = u.usuario === usuarioActual;
              return (
                <tr key={u.id}>
                  <td>
                    <strong>{u.usuario}</strong>
                    {esPropio && <span className="status-badge" style={{ marginLeft: '8px' }}>Tú</span>}
                  </td>
                  <td>
                    <select className="form-select select-compacto" value={u.rol} disabled={esPropio}
                      onChange={(e) => cambiarRol(u, e.target.value)}
                      title={esPropio ? 'No puedes cambiar tu propio rol' : ''}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`estado-pill ${u.activo ? 'activo' : 'inactivo'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>{u.sesionesAbiertas ?? 0}</td>
                  <td>{formatearFecha(u.creadoEn)}</td>
                  <td>
                    <div className="acciones-fila">
                      <button className="btn-accion" onClick={() => { setModalPassword(u); setPasswordNueva(''); }}>🔑 Contraseña</button>
                      <button className="btn-accion" onClick={() => cerrarSesiones(u)} disabled={!u.sesionesAbiertas}>🚪 Cerrar sesiones</button>
                      <button className="btn-accion" onClick={() => cambiarActivo(u)} disabled={esPropio}>
                        {u.activo ? '⏸️ Desactivar' : '▶️ Activar'}
                      </button>
                      <button className="btn-accion peligro" onClick={() => setModalEliminar(u)} disabled={esPropio}>🗑️ Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalPassword && (
        <Modal titulo={`Nueva contraseña para "${modalPassword.usuario}"`} onCerrar={() => setModalPassword(null)}>
          <form onSubmit={guardarPassword} className="form-column">
            <div className="form-group">
              <label>Nueva contraseña</label>
              <input type="password" className="form-input" placeholder="Mínimo 8 caracteres" value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)} autoComplete="new-password" autoFocus required />
            </div>
            <p className="modal-nota">Al cambiarla se cerrarán todas las sesiones abiertas de este usuario.</p>
            <div className="modal-acciones">
              <button type="button" className="btn btn-excel" onClick={() => setModalPassword(null)}>Cancelar</button>
              <button type="submit" className="btn btn-entrada" style={{ marginTop: 0 }}>Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {modalEliminar && (
        <Modal titulo="Eliminar usuario" onCerrar={() => setModalEliminar(null)}>
          <p>¿Seguro que deseas eliminar al usuario <strong>{modalEliminar.usuario}</strong>? Esta acción no se puede deshacer.</p>
          <div className="modal-acciones">
            <button className="btn btn-excel" onClick={() => setModalEliminar(null)}>Cancelar</button>
            <button className="btn btn-peligro" onClick={confirmarEliminar}>Eliminar</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default PanelUsuarios;
