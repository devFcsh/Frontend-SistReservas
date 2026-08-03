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

const DOCENTES = [
  "Juan José Rizzo Rodríguez",
  "Oscar Emigdio Mendoza Macias",
  "José Martin Bustamante León",
  "Washington Asdrual Macias Rendon",
  "Katia Lorena Rodriguez Morales"
];

// ==========================================================================
// Validaciones de formulario (mismas reglas que el backend, aquí solo para
// mejorar la experiencia de uso filtrando mientras se escribe). El backend
// sigue siendo la fuente de verdad: rechaza cualquier valor inválido aunque
// llegue una petición manipulada directo a la API.
// ==========================================================================
const soloNumeros = (valor, maxLen) => valor.replace(/[^0-9]/g, '').slice(0, maxLen);
const soloLetras = (valor) => valor.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, '');

// Colores/etiquetas para cada estado de equipo devuelto por el backend
// (GET /api/equipos). Ver EquipoEstadoHelper.cs en el backend para la
// definición exacta de cada estado.
const ESTADO_EQUIPO_STYLES = {
  'Disponible':    { bg: '#dcfce7', color: '#15803d' },
  'Ocupado':       { bg: '#fee2e2', color: '#b91c1c' },
  'No disponible': { bg: '#ede9fe', color: '#5b21b6' },
  'No colocado':   { bg: '#f3f4f6', color: '#6b7280' },
};

function App() {
  const [claseEnCurso, setClaseEnCurso] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('entrada');
  const [entrada, setEntrada] = useState({
    matricula: '',
    nombre: '',
    apellido: '',
    carrera: CARRERAS[0],
    periodo: PERIODOS[0],
    equipo: '',
    docente: DOCENTES[0]
  });
  const [matriculaSalida, setMatriculaSalida] = useState('');
  const [toast, setToast] = useState({ visible: false, mensaje: '', tipo: '' });
  const [datosTabla, setDatosTabla] = useState([]);

  // Equipos que pueden reservarse AHORA MISMO (colocados + con IP + encendidos
  // + libres), para llenar el <select> del formulario de entrada. Viene de
  // GET /api/equipos/disponibles.
  const [equiposDisponibles, setEquiposDisponibles] = useState([]);

  // Catálogo completo de equipos con su estado calculado por el backend
  // (Disponible / Ocupado / No disponible / No colocado), para el Panel de
  // Equipos. Viene de GET /api/equipos.
  const [equiposPanel, setEquiposPanel] = useState([]);
  const [advertenciaPanel, setAdvertenciaPanel] = useState('');

  // Semáforo de red (punto naranja/morado) — estado crudo del ping por
  // equipo, tal como estaba en la versión original. Viene de
  // GET /api/equipos-estado-red. Se mantiene EXPLÍCITO y sin modificar a
  // pedido, además del badge de estado del Panel de Equipos.
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

  // Filtra mientras el usuario escribe: matrícula solo dígitos (máx. 9)
  const handleMatriculaChange = (e) => {
    setEntrada({ ...entrada, matricula: soloNumeros(e.target.value, 9) });
  };

  // Filtra mientras el usuario escribe: nombre/apellido solo letras y espacios
  const handleNombreChange = (e) => {
    setEntrada({ ...entrada, nombre: soloLetras(e.target.value) });
  };
  const handleApellidoChange = (e) => {
    setEntrada({ ...entrada, apellido: soloLetras(e.target.value) });
  };

  // Filtra mientras el usuario escribe: matrícula de salida solo dígitos y hasta 9 caracteres.
  const handleMatriculaSalidaChange = (e) => {
    setMatriculaSalida(soloNumeros(e.target.value, 9));
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

  // ==========================================================================
  // Cargar equipos DISPONIBLES para el formulario de entrada. Se refresca
  // periódicamente mientras esa vista está activa, para reflejar cambios de
  // estado (ping, cierre automático, otro usuario reservando) casi en vivo.
  // ==========================================================================
  useEffect(() => {
    if (vistaActiva !== 'entrada') return;

    const cargarDisponibles = () => {
      fetch('http://localhost:5128/api/equipos/disponibles')
        .then(res => res.json())
        .then(payload => {
          // El backend puede responder un array directo, o
          // { advertencia, equipos: [] } si hubo un problema consultando la
          // base de datos (ver EquiposController.ObtenerDisponibles).
          const data = Array.isArray(payload) ? payload : payload.equipos ?? [];
          if (payload.advertencia) {
            console.warn("Aviso del backend (equipos/disponibles):", payload.advertencia);
          }
          setEquiposDisponibles(data);
          // Si el equipo seleccionado ya no está disponible, o no hay
          // selección todavía, se ajusta automáticamente al primero libre.
          setEntrada(prev => {
            const sigueDisponible = data.some(eq => eq.nombre === prev.equipo);
            if (sigueDisponible) return prev;
            return { ...prev, equipo: data.length > 0 ? data[0].nombre : '' };
          });
        })
        .catch(err => console.error("Error al cargar equipos disponibles", err));
    };

    cargarDisponibles();
    const intervalo = setInterval(cargarDisponibles, 10000);
    return () => clearInterval(intervalo);
  }, [vistaActiva]);

  // ==========================================================================
  // Cargar el catálogo completo de equipos (con estado) para el Panel de
  // Equipos. Se refresca cada 5s mientras esa vista está activa.
  // ==========================================================================
  useEffect(() => {
    if (vistaActiva !== 'equipos') return;

    const cargarPanel = () => {
      fetch('http://localhost:5128/api/equipos')
        .then(res => res.json())
        .then(payload => {
          // El backend puede responder un array directo, o
          // { advertencia, equipos: [] } si no pudo confirmar ocupación
          // contra la base de datos (ver EquiposController.ObtenerEquipos).
          const data = Array.isArray(payload) ? payload : payload.equipos ?? [];
          setEquiposPanel(data);
          setAdvertenciaPanel(payload.advertencia || '');
        })
        .catch(err => console.error("Error al cargar el panel de equipos", err));
    };

    cargarPanel();
    const intervalo = setInterval(cargarPanel, 5000);
    return () => clearInterval(intervalo);
  }, [vistaActiva]);

  // ==========================================================================
  // Semáforo de red: carga y refresca el estado de ping (equipos-estado-red)
  // exactamente como en la versión original. Solo corre mientras la vista
  // "equipos" está activa, y se repite cada 5s.
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

  // ==========================================================================
  // Helper para obtener el color del semáforo de red de un equipo dado
  // (idéntico al original: "naranja" | "morado" | null). Si el equipo no
  // aparece en equiposRed (sin IP configurada), no se muestra semáforo.
  // ==========================================================================
  const obtenerColorRed = (nombreEquipo) => {
    const info = equiposRed.find(e => e.equipo === nombreEquipo);
    if (!info) return null;
    return info.estado === 'Encendida' ? 'naranja' : 'morado';
  };

  const handleEntradaSubmit = async (e) => {
    e.preventDefault();

    if (!entrada.equipo) {
      mostrarToast("No hay ningún equipo disponible para reservar en este momento.", 'error');
      return;
    }

    try {
      const response = await fetch('http://localhost:5128/api/entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entrada)
      });
      const data = await response.json();
      if (response.ok) {
        mostrarToast(data.message, 'entrada-success');
        setEntrada(prev => ({
          matricula: '', nombre: '', apellido: '',
          carrera: CARRERAS[0], periodo: prev.periodo,
          equipo: '', docente: prev.docente
        }));
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
        mostrarToast("Todos los equipos disponibles marcados como ocupados", 'entrada-success');
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
      } else {
        mostrarToast("Error al finalizar la clase", 'error');
      }
    } catch (error) {
      mostrarToast("Error de conexión", 'error');
    }
  };

  const handleSalidaSubmit = async (e) => {
    e.preventDefault();

    const matriculaValida = /^[12][0-9]{0,8}$/.test(matriculaSalida);
    if (!matriculaValida) {
      mostrarToast("La matrícula debe contener solo números y comenzar con 1 o 2", 'error');
      return;
    }

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
                    onChange={handleMatriculaChange}
                    inputMode="numeric" maxLength={9}
                    required
                  />
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label>Nombres</label>
                    <input
                      type="text" name="nombre"
                      className={`form-input ${entrada.nombre ? 'auto-filled' : ''}`}
                      placeholder="Nombre" value={entrada.nombre}
                      onChange={handleNombreChange} required
                    />
                  </div>
                  <div className="form-group">
                    <label>Apellidos</label>
                    <input
                      type="text" name="apellido" className="form-input"
                      placeholder="Apellido" value={entrada.apellido}
                      onChange={handleApellidoChange} required
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
                    {equiposDisponibles.length > 0 ? (
                      <select name="equipo" className="form-select" value={entrada.equipo} onChange={handleInputChange}>
                        {equiposDisponibles.map((e) => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text" className="form-input input-disabled"
                        value="No hay equipos disponibles" disabled
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Laboratorio Asignado</label>
                  <input type="text" className="form-input input-disabled" value="L002" disabled />
                </div>

                <button type="submit" className="btn btn-entrada" disabled={equiposDisponibles.length === 0}>
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
                    onChange={handleMatriculaSalidaChange}
                    maxLength={9}
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

              {advertenciaPanel && (
                <div style={{
                  background: '#fff3cd',
                  color: '#856404',
                  border: '1px solid #ffeeba',
                  borderRadius: '6px',
                  padding: '10px 15px',
                  marginBottom: '15px',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}>
                  ⚠️ {advertenciaPanel}
                </div>
              )}

              {equiposPanel.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  Aún no hay equipos registrados en el catálogo.
                </p>
              )}

              {/* Grid de equipos */}
              <div className="equipos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                {equiposPanel.map((eq) => {
                  const estilo = ESTADO_EQUIPO_STYLES[eq.estado] || ESTADO_EQUIPO_STYLES['No disponible'];
                  const colorRed = obtenerColorRed(eq.nombre); // "naranja" | "morado" | null

                  return (
                    <div key={eq.id} className={`equipo-card ${eq.ocupado ? 'ocupado' : ''}`}
                      style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center', position: 'relative' }}>

                      {/* Semáforo de red - punto de color en la esquina superior derecha */}
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

                      {eq.nombre}
                      <div style={{
                        fontSize: '0.7rem',
                        marginTop: '5px',
                        color: estilo.color,
                        background: estilo.bg,
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {eq.estado}
                      </div>

                      {/* Etiqueta textual del estado de red, debajo del badge de estado */}
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
