import React, { useState } from 'react';
import { api, guardarSesion } from './api.js';

function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const datos = await api('/auth/login', {
        method: 'POST',
        publica: true,
        body: JSON.stringify({ usuario: usuario.trim(), password })
      });
      guardarSesion(datos);
      onLogin({ token: datos.token, usuario: datos.usuario, rol: datos.rol });
    } catch (err) {
      setError(err.message === 'Failed to fetch'
        ? 'No se pudo conectar con el servidor.'
        : err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header-institucional">
        <img src="/logo.svg" alt="ESPOL FCSH" className="header-logo" />
      </header>

      <main className="login-wrapper">
        <header className="main-header">
          <h1>Sistema de Préstamo</h1>
          <p>Control de Ingreso y Salida de Alumnos</p>
        </header>

        <div className="content-card-view login-card animate-fade-in">
          <section className="view-active">
            <h2>Iniciar Sesión</h2>
            <img src="/logo.png" alt="Logo Institucional" className="logo-login" />
            <form onSubmit={handleSubmit} className="form-column">
              <div className="form-group">
                <label>Usuario</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ingrese su usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && <div className="mensaje-error">{error}</div>}

              <button type="submit" className="btn btn-entrada" disabled={cargando}>
                {cargando ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Login;
