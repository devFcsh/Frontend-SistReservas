import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import './App.css'; 

const CARRERAS = [
  "Economía",
  "Administración de empresas",
  "Arqueología",
  "Turismo",
  "Auditoría y gestión",
  "Otra carrera"
];

const EQUIPOS = Array.from({ length: 46 }, (_, index) => `Equipo ${index + 1}`);

function App() {
  const [vistaActiva, setVistaActiva] = useState('entrada'); 
  const [entrada, setEntrada] = useState({ 
    matricula: '', 
    nombre: '', 
    apellido: '', 
    carrera: CARRERAS[0],
    equipo: EQUIPOS[0] 
  });
  const [matriculaSalida, setMatriculaSalida] = useState('');
  const [toast, setToast] = useState({ visible: false, mensaje: '', tipo: '' });

  // NUEVO ESTADO: Para almacenar los datos de la tabla en el panel de admin
  const [datosTabla, setDatosTabla] = useState([]);

  const mostrarToast = (mensaje, tipo) => {
    setToast({ visible: true, mensaje, tipo });
    setTimeout(() => {
      setToast({ visible: false, mensaje: '', tipo: '' });
    }, 5000); 
  };

  const handleInputChange = (e) => {
    setEntrada({ ...entrada, [e.target.name]: e.target.value });
  };

  const handleEntradaSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5128/api/entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entrada)
      });
      const data = await response.json();
      if (response.ok) {
        mostrarToast(data.message, 'entrada-success'); 
        setEntrada({ matricula: '', nombre: '', apellido: '', carrera: CARRERAS[0], equipo: EQUIPOS[0] });
      } else {
        mostrarToast("Error: " + (data.error || "Datos inválidos"), 'error');
      }
    } catch (error) {
      console.error(error);
      mostrarToast("Error al conectar con el servidor", 'error');
    }
  };

  const handleSalidaSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5128/api/salida', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula: matriculaSalida })
      });
      const data = await response.json();
      if (response.ok) {
        mostrarToast(data.message, 'salida-success'); 
        setMatriculaSalida('');
      } else {
        mostrarToast(data.message || "Error al registrar salida", 'error');
      }
    } catch (error) {
      console.error(error);
      mostrarToast("Error al conectar con el servidor", 'error');
    }
  };

  // NUEVA FUNCIÓN: Obtiene los datos del backend para mostrarlos en pantalla
  const consultarDatosTabla = async () => {
    try {
      const response = await fetch('http://localhost:5128/api/reporte');
      const datos = await response.json();

      if (datos.length === 0) {
        mostrarToast("No hay datos disponibles para mostrar", 'error');
        setDatosTabla([]);
        return;
      }

      setDatosTabla(datos);
      mostrarToast("📋 Datos cargados correctamente", 'entrada-success');
    } catch (error) {
      console.error(error);
      mostrarToast("Error al obtener los datos del servidor", 'error');
    }
  };

  const descargarExcel = async () => {
    try {
      const response = await fetch('http://localhost:5128/api/reporte');
      const datos = await response.json();

      if (datos.length === 0) {
        mostrarToast("No hay datos disponibles para exportar", 'error');
        return;
      }

      const datosFormateados = datos.map(row => ({
        'Nombre': row.nombre,
        'Apellido': row.apellido,
        'Matrícula': row.matricula,
        'Carrera': row.carrera,
        'Equipo Asignado': row.equipo || 'N/A',
        'Hora de Inicio': row.hora_inicio,
        'Hora de Salida': row.hora_salida ? row.hora_salida : 'En uso',
        'Tiempo de Uso (Minutos)': row.tiempo_promedio !== null ? `${row.tiempo_promedio}` : 'N/A'
      }));

      const hoja = XLSX.utils.json_to_sheet(datosFormateados);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Reporte Laboratorio");
      
      XLSX.writeFile(libro, "Reporte_Laboratorio_L002.xlsx");
      mostrarToast("📊 Reporte descargado con éxito", 'entrada-success');
    } catch (error) {
      console.error(error);
      mostrarToast("Error al generar el reporte Excel", 'error');
    }
  };

  return (
    <div className="app-container">
      
      {/* BURBUJA POP-UP DINÁMICA */}
      {toast.visible && (
        <div className={`toast-popup ${toast.tipo}`}>
          <span className="toast-text">{toast.mensaje}</span>
          <button className="toast-close-btn" onClick={() => setToast({ ...toast, visible: false })}>
            &times;
          </button>
        </div>
      )}

      {/* MENÚ LATERAL IZQUIERDO */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>FCSH</h2>
          <p>Laboratorio L002</p>
        </div>
        <nav className="sidebar-menu">
          <button 
            className={`sidebar-link ${vistaActiva === 'entrada' ? 'active' : ''}`}
            onClick={() => setVistaActiva('entrada')}
          >
            📥 Registro de Entrada
          </button>
          <button 
            className={`sidebar-link ${vistaActiva === 'salida' ? 'active' : ''}`}
            onClick={() => setVistaActiva('salida')}
          >
            📤 Registro de Salida
          </button>
          <button 
            className={`sidebar-link ${vistaActiva === 'admin' ? 'active' : ''}`}
            onClick={() => setVistaActiva('admin')}
          >
            ⚙️ Panel de Administración
          </button>
        </nav>
      </aside>

      {/* CONTENIDO PRINCIPAL DINÁMICO */}
      <main className="main-content-wrapper">
        <header className="main-header">
          <h1>Sistema de Reservas</h1>
          <p>Control de Ingreso y Salida de Alumnos</p>
        </header>

        <div className="content-card">
          
          {/* MOSTRAR ENTRADA */}
          {vistaActiva === 'entrada' && (
            <section className="column-section section-entrada single-view animate-fade-in">
              <h2>Registro de Entrada</h2>
              <form onSubmit={handleEntradaSubmit} className="form-column">
                <div className="form-group">
                  <label>Matrícula</label>
                  <input 
                    type="text" name="matricula" className="form-input"
                    placeholder="Ej. 202410123" value={entrada.matricula} 
                    onChange={handleInputChange} required 
                  />
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label>Nombre</label>
                    <input 
                      type="text" name="nombre" className="form-input"
                      placeholder="Nombre" value={entrada.nombre} 
                      onChange={handleInputChange} required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Apellido</label>
                    <input 
                      type="text" name="apellido" className="form-input"
                      placeholder="Apellido" value={entrada.apellido} 
                      onChange={handleInputChange} required 
                    />
                  </div>
                </div>
                
                <div className="form-group-row">
                  <div className="form-group">
                    <label>Carrera</label>
                    <select name="carrera" className="form-select" value={entrada.carrera} onChange={handleInputChange}>
                      {CARRERAS.map((c, index) => <option key={index} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Equipo Asignado</label>
                    <select name="equipo" className="form-select" value={entrada.equipo} onChange={handleInputChange}>
                      {EQUIPOS.map((e, index) => <option key={index} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Laboratorio Asignado</label>
                  <input type="text" className="form-input input-disabled" value="L002" disabled />
                </div>

                <button type="submit" className="btn btn-entrada">
                  Confirmar Entrada
                </button>
              </form>
            </section>
          )}

          {/* MOSTRAR SALIDA */}
          {vistaActiva === 'salida' && (
            <section className="column-section section-salida single-view animate-fade-in">
              <h2>Registro de Salida</h2>
              <img src="/logo1.png" alt="Logo Institucional" className="logo-salida" />
              <form onSubmit={handleSalidaSubmit} className="form-column">
                <div className="form-group group-salida-center">
                  <label>Matrícula</label>
                  <input 
                    type="text" className="form-input input-grande"
                    placeholder="Ingrese Matrícula para Salida" 
                    value={matriculaSalida} 
                    onChange={(e) => setMatriculaSalida(e.target.value)} 
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-salida">
                  Registrar Salida
                </button>
              </form>
            </section>
          )}

          {/* MOSTRAR PANEL DE ADMINISTRACIÓN */}
          {vistaActiva === 'admin' && (
            <section className="admin-view-section single-view animate-fade-in">
              <h2>Panel de Administración</h2>
              <p>Generación de reportes detallados del uso del Laboratorio L002.</p>
              
              {/* Contenedor de Botones alineados en fila */}
              <div className="admin-actions-container" style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '25px', flexWrap: 'wrap' }}>
                <button onClick={consultarDatosTabla} className="btn btn-entrada btn-large">
                  📋 Visualizar Tabla
                </button>
                <button onClick={descargarExcel} className="btn btn-excel btn-large">
                  📊 Descargar Reporte (Excel)
                </button>
              </div>

              {/* RENDERIZADO CONDICIONAL DE LA TABLA */}
              {datosTabla.length > 0 && (
                <div className="table-container animate-fade-in">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Apellido</th>
                        <th>Matrícula</th>
                        <th>Carrera</th>
                        <th>Equipo</th>
                        <th>Hora Inicio</th>
                        <th>Hora Salida</th>
                        <th>Tiempo (Min)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosTabla.map((row, index) => (
                        <tr key={index}>
                          <td>{row.nombre}</td>
                          <td>{row.apellido}</td>
                          <td>{row.matricula}</td>
                          <td>{row.carrera}</td>
                          <td>{row.equipo || 'N/A'}</td>
                          <td>{row.hora_inicio}</td>
                          <td>{row.hora_salida ? row.hora_salida : <span className="status-badge">En uso</span>}</td>
                          <td>{row.tiempo_promedio !== null ? `${row.tiempo_promedio}` : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;