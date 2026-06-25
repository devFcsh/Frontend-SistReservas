import React, { useState, useEffect } from 'react';
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
const PERIODOS = ["I PAO", "II PAO", "PAE"];
const EQUIPOS = Array.from({ length: 46 }, (_, index) => `Equipo ${index + 1}`);

const DOCENTES = [
  "Juan José Rizzo Rodríguez",
  "Oscar Emigdio Mendoza Macias",
  "José Martin Bustamante León",
  "Washington Asdrual Macias Rendon",
  "Katia Lorena Rodriguez Morales"
];

function App() {
  const [claseEnCurso, setClaseEnCurso] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('entrada');
  const [entrada, setEntrada] = useState({
    matricula: '',
    nombre: '',
    apellido: '',
    carrera: CARRERAS[0],
    periodo: PERIODOS[0],
    equipo: EQUIPOS[0],
    docente: DOCENTES[0]
  });
  const [matriculaSalida, setMatriculaSalida] = useState('');
  const [toast, setToast] = useState({ visible: false, mensaje: '', tipo: '' });
  const [datosTabla, setDatosTabla] = useState([]);

  // estado para los equipos ocupados
  const [equiposOcupados, setEquiposOcupados] = useState([]);

  // ==========================================================================
  // NUEVO: estado para el semáforo de RED (ping a cada PC: encendida/apagada)
  // Es independiente de equiposOcupados (que viene de la base de datos/reservas)
  // ==========================================================================
  const [equiposRed, setEquiposRed] = useState([]);

  const mostrarToast = (mensaje, tipo) => {
    setToast({ visible: true, mensaje, tipo });
    setTimeout(() => {
      setToast({ visible: false, mensaje: '', tipo: '' });
    }, 5000);
  };

  const handleInputChange = (e) => {
    setEntrada({ ...entrada, [e.target.name]: e.target.value });
  };

  // ==========================================================================
  // EFECTO DE AUTOCOMPLETADO AUTOMÁTICO AL ESCRIBIR LA MATRÍCULA
  // ==========================================================================
  useEffect(() => {
    const buscarHistorialAlumno = async () => {
      if (entrada.matricula.trim().length >= 9) {
        try {
          const response = await fetch(`http://localhost:5128/api/alumno/${entrada.matricula.trim()}`);
          if (response.ok) {
            const data = await response.json();
            if (data.encontrado) {
              setEntrada(prev => ({
                ...prev,
                nombre: data.nombre || data.Nombre || '',
                apellido: data.apellido || data.Apellido || ''
              }));
              mostrarToast("✨ Alumno encontrado en el historial. Campos rellenados.", 'entrada-success');
            }
          }
        } catch (error) {
          console.error("Error al consultar el historial del alumno:", error);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      buscarHistorialAlumno();
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [entrada.matricula]);

  // efecto para cargar el estado de los equipos
  useEffect(() => {
    if (vistaActiva === 'equipos') {
      fetch('http://localhost:5128/api/equipos-estado')
        .then(res => res.json())
        .then(data => setEquiposOcupados(data))
        .catch(err => console.error("Error al cargar estado de equipos", err));
    }
  }, [vistaActiva]);

  // ==========================================================================
  // NUEVO: efecto para cargar y refrescar el estado de RED (ping) de los equipos
  // Solo corre mientras la vista "equipos" está activa, y se repite cada 5s
  // para que el semáforo se mantenga actualizado sin recargar la página.
  // ==========================================================================
  useEffect(() => {
    if (vistaActiva !== 'equipos') return;

    const cargarEstadoRed = () => {
      fetch('http://localhost:5128/api/equipos-estado-red')
        .then(res => res.json())
        .then(data => {
          // El backend devuelve { mensaje, equipos: [] } si aún no hay IPs configuradas,
          // o directamente un array si ya hay datos.
          const lista = Array.isArray(data) ? data : data.equipos ?? [];
          setEquiposRed(lista);
        })
        .catch(err => console.error("Error al cargar estado de red de equipos", err));
    };

    cargarEstadoRed(); // primera carga inmediata
    const intervalo = setInterval(cargarEstadoRed, 5000);

    return () => clearInterval(intervalo);
  }, [vistaActiva]);

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

  // funcion para manejar los equipos cuando hay clases
  const manejarEnClase = async () => {
    try {
      const res = await fetch('http://localhost:5128/api/equipos-estado');
      const ocupados = await res.json();

      if (ocupados.length > 0) {
        mostrarToast("⚠️ Registre la salida del estudiante antes de iniciar clase", 'error');
        return;
      }

      const payload = {
        Docente: entrada.docente,
        Periodo: entrada.periodo
      };

      const response = await fetch('http://localhost:5128/api/en-clase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setClaseEnCurso(true);
        mostrarToast("Todos los equipos marcados como ocupados", 'entrada-success');
        fetch('http://localhost:5128/api/equipos-estado')
          .then(res => res.json())
          .then(data => setEquiposOcupados(data));
      } else {
        mostrarToast("Error al procesar el estado en clase", 'error');
      }
    } catch (error) {
      mostrarToast("Error de conexión", 'error');
    }
  };

  //funcion para manejar los equipos cuando se acabaron las clases
  const manejarFinalizarClase = async () => {
    try {
      const response = await fetch('http://localhost:5128/api/finalizar-clase', { method: 'PUT' });
      if (response.ok) {
        setClaseEnCurso(false);
        mostrarToast("Clase finalizada, equipos liberados", 'salida-success');
        const res = await fetch('http://localhost:5128/api/equipos-estado');
        const data = await res.json();
        setEquiposOcupados(data);
      } else {
        mostrarToast("Error al finalizar la clase", 'error');
      }
    } catch (error) {
      mostrarToast("Error de conexión", 'error');
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
        'Periodo': row.periodo || 'N/A',
        'Equipo Asignado': row.equipo || 'N/A',
        'Fecha': row.fecha,
        'Hora de Inicio': row.horaInicio,
        'Hora de Salida': row.horaSalida ? row.horaSalida : 'En uso',
        'Tiempo de Uso (Minutos)': row.tiempoPromedio !== null ? `${row.tiempoPromedio}` : 'N/A',
        'Año': row.Año
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

  // ==========================================================================
  // NUEVO: helper para obtener el color del semáforo de red de un equipo dado
  // Si el equipo no tiene IP configurada en el backend, no aparece en equiposRed
  // y se devuelve null (no se muestra semáforo para ese equipo).
  // ==========================================================================
  const obtenerColorRed = (nombreEquipo) => {
    const info = equiposRed.find(e => e.equipo === nombreEquipo);
    return info ? info.color : null; // "naranja" | "morado" | null
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

          {/* Panel de reserva clases*/}
          <button
            className={`sidebar-link ${vistaActiva === 'reservaClases' ? 'active' : ''}`}
            onClick={() => setVistaActiva('reservaClases')}
          >
            📅 Reserva para Clases
          </button>

          {/* Paenel de Equipos */}
          <button
            className={`sidebar-link ${vistaActiva === 'equipos' ? 'active' : ''}`}
            onClick={() => setVistaActiva('equipos')}
          >
            💻 Panel de Equipos
          </button>

        </nav>
      </aside>

      {/* CONTENIDO PRINCIPAL DINÁMICO */}
      <main className="main-content-wrapper">
        <header className="main-header">
          <h1>Sistema de Préstamo</h1>
          <p>Control de Ingreso y Salida de Alumnos</p>
        </header>

        <div className={(vistaActiva === 'admin' || vistaActiva === 'equipos') ? "content-card-view wide-view" : "content-card-view"}>

          {/* MOSTRAR ENTRADA */}
          {vistaActiva === 'entrada' && (
            <section className="view-active section-entrada animate-fade-in">
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
                    <label>Nombres</label>
                    <input
                      type="text" name="nombre"
                      className={`form-input ${entrada.nombre ? 'auto-filled' : ''}`}
                      placeholder="Nombre" value={entrada.nombre}
                      onChange={handleInputChange} required
                    />
                  </div>
                  <div className="form-group">
                    <label>Apellidos</label>
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
                    <label>Periodo</label>
                    <select name="periodo" className="form-select" value={entrada.periodo} onChange={handleInputChange}>
                      {PERIODOS.map((p, index) => <option key={index} value={p}>{p}</option>)}
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
                  Registrar Entrada
                </button>
              </form>
            </section>
          )}

          {/* MOSTRAR SALIDA */}
          {vistaActiva === 'salida' && (
            <section className="view-active section-salida animate-fade-in">
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
            <section className="view-active admin-view-section animate-fade-in">
              <h2>Panel de Administración</h2>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Generación de reportes detallados del uso del Laboratorio L002.
              </p>

              <div className="admin-actions-container" style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '25px', flexWrap: 'wrap' }}>
                <button onClick={consultarDatosTabla} className="btn btn-entrada btn-large">
                  📋 Visualizar Tabla
                </button>
                <button onClick={descargarExcel} className="btn btn-excel btn-large">
                  📊 Descargar Reporte (Excel)
                </button>
              </div>

              {datosTabla.length > 0 && (
                <div className="table-container animate-fade-in">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nombres</th>
                        <th>Apellidos</th>
                        <th>Matrícula</th>
                        <th>Carrera</th>
                        <th>Equipo</th>
                        <th>Fecha</th>
                        <th>Hora Inicio</th>
                        <th>Hora Salida</th>
                        <th>Tiempo</th>
                        <th>Periodo</th>
                        <th>Año</th>
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
                          <td>{row.fecha}</td>
                          <td>{row.horaInicio}</td>
                          <td>{row.horaSalida ? row.horaSalida : <span className="status-badge">En uso</span>}</td>
                          <td>{row.tiempoPromedio !== null ? `${row.tiempoPromedio} ` : 'N/A'}</td>
                          <td>{row.periodo !== null ? `${row.periodo} ` : 'N/A'}</td>
                          <td>{row.fecha ? row.fecha.split('-')[0] : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/*SECCION DE REGISTRO PARA CLASES */}
          {vistaActiva === 'reservaClases' && (
            <section className="view-active animate-fade-in">
              <h2>Reserva de Equipos para Clases</h2>

              <div className="equipos-header-container" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <select
                    className="form-select"
                    value={entrada.docente || DOCENTES[0]}
                    onChange={handleInputChange}
                    name="docente"
                  >
                    {DOCENTES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>

                  <select
                    className="form-select"
                    value={entrada.periodo || PERIODOS[0]}
                    onChange={handleInputChange}
                    name="periodo"
                  >
                    {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="botones-container" style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={manejarEnClase} className="btn btn-entrada">
                    💻 En Clase
                  </button>
                  <button onClick={manejarFinalizarClase} className="btn btn-finalizar-clase">
                    🔓 Fin Clase
                  </button>
                </div>
              </div>
            </section>
          )}

          {/*  SECCIÓN DE EQUIPOS/PANEL DE EQUIPOS */}
          {vistaActiva === 'equipos' && (
            <section className="view-active animate-fade-in">

              <h2 style={{ marginTop: '25px', color: 'var(--text-main)' }}>Panel de Equipos</h2>

              {/* Grid de equipos */}
              <div className="equipos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                {EQUIPOS.map((equipo, index) => {
                  const esOcupado = equiposOcupados.includes(equipo);
                  const colorRed = obtenerColorRed(equipo); // "naranja" | "morado" | null

                  return (
                    <div key={index} className={`equipo-card ${esOcupado ? 'ocupado' : ''}`}
                      style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center', position: 'relative' }}>

                      {/* NUEVO: semáforo de red - punto de color en la esquina superior derecha */}
                      {colorRed && (
                        <span
                          title={colorRed === 'naranja' ? 'PC encendida (responde ping)' : 'PC apagada (no responde ping)'}
                          style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: colorRed === 'naranja' ? '#FF8C00' : '#7B2FF7',
                            boxShadow: `0 0 6px ${colorRed === 'naranja' ? '#FF8C00' : '#7B2FF7'}`,
                          }}
                        />
                      )}

                      {equipo}
                      <div style={{
                        fontSize: '0.7rem',
                        marginTop: '5px',
                        color: esOcupado ? '#b91c1c' : '#15803d',
                        background: esOcupado ? '#fee2e2' : '#dcfce7',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {esOcupado ? 'Ocupado' : 'Disponible'}
                      </div>

                      {/* NUEVO: etiqueta textual del estado de red, debajo de Ocupado/Disponible */}
                      {colorRed && (
                        <div style={{
                          fontSize: '0.65rem',
                          marginTop: '4px',
                          color: colorRed === 'naranja' ? '#9a5b00' : '#5b21b6',
                          background: colorRed === 'naranja' ? '#fff3e0' : '#ede9fe',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {colorRed === 'naranja' ? 'PC Encendida' : 'PC Apagada'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
