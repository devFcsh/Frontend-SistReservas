import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import './App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

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

const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const soloNumeros = (valor, maxLen) => valor.replace(/[^0-9]/g, '').slice(0, maxLen);
const soloLetras = (valor) => valor.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, '');

const ESTADO_EQUIPO_STYLES = {
  'Disponible':    { bg: '#dcfce7', color: '#15803d' },
  'Ocupado':       { bg: '#fee2e2', color: '#b91c1c' },
  'No disponible': { bg: '#ede9fe', color: '#5b21b6' },
  'No colocado':   { bg: '#f3f4f6', color: '#6b7280' },
};

const obtenerMinutosDeUso = (row) => {
  const tiempoProp = Number(row.tiempoPromedio ?? row.TiempoPromedio);
  if (!isNaN(tiempoProp) && tiempoProp > 0) {
    return tiempoProp;
  }

  if (row.horaInicio && row.horaSalida && row.horaSalida !== 'En uso') {
    const parseTime = (tStr) => {
      const partes = tStr.split(':');
      if (partes.length >= 2) {
        return parseInt(partes[0], 10) * 60 + parseInt(partes[1], 10);
      }
      return null;
    };

    const inicioMin = parseTime(row.horaInicio);
    const salidaMin = parseTime(row.horaSalida);

    if (inicioMin !== null && salidaMin !== null && salidaMin >= inicioMin) {
      return salidaMin - inicioMin;
    }
  }
  return 0;
};

// Opciones globales para mantener los gráficos responsivos dentro de las tarjetas
const chartOptionsBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  }
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

  const [filtroAnio, setFiltroAnio] = useState('TODOS');
  const [filtroMes, setFiltroMes] = useState('TODOS');

  const [equiposDisponibles, setEquiposDisponibles] = useState([]);
  const [equiposPanel, setEquiposPanel] = useState([]);
  const [advertenciaPanel, setAdvertenciaPanel] = useState('');
  const [equiposRed, setEquiposRed] = useState([]);

  const dashboardRef = useRef(null);

  const mostrarToast = (mensaje, tipo) => {
    setToast({ visible: true, mensaje, tipo });
    setTimeout(() => {
      setToast({ visible: false, mensaje: '', tipo: '' });
    }, 5000);
  };

  const handleInputChange = (e) => {
    setEntrada({ ...entrada, [e.target.name]: e.target.value });
  };

  const handleMatriculaChange = (e) => {
    setEntrada({ ...entrada, matricula: soloNumeros(e.target.value, 9) });
  };

  const handleNombreChange = (e) => {
    setEntrada({ ...entrada, nombre: soloLetras(e.target.value) });
  };

  const handleApellidoChange = (e) => {
    setEntrada({ ...entrada, apellido: soloLetras(e.target.value) });
  };

  const handleMatriculaSalidaChange = (e) => {
    setMatriculaSalida(soloNumeros(e.target.value, 9));
  };

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
              mostrarToast("✨ Alumno encontrado en el historial.", 'entrada-success');
            }
          }
        } catch (error) {
          console.error("Error al consultar historial:", error);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      buscarHistorialAlumno();
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [entrada.matricula]);

  useEffect(() => {
    if (vistaActiva !== 'entrada') return;

    const cargarDisponibles = () => {
      fetch('http://localhost:5128/api/equipos/disponibles')
        .then(res => res.json())
        .then(payload => {
          const data = Array.isArray(payload) ? payload : payload.equipos ?? [];
          setEquiposDisponibles(data);
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

  useEffect(() => {
    if (vistaActiva !== 'equipos') return;

    const cargarPanel = () => {
      fetch('http://localhost:5128/api/equipos')
        .then(res => res.json())
        .then(payload => {
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

  useEffect(() => {
    if (vistaActiva !== 'equipos') return;

    const cargarEstadoRed = () => {
      fetch('http://localhost:5128/api/equipos-estado-red')
        .then(res => res.json())
        .then(data => {
          const lista = Array.isArray(data) ? data : data.equipos ?? [];
          setEquiposRed(lista);
        })
        .catch(err => console.error("Error al cargar estado de red", err));
    };

    cargarEstadoRed();
    const intervalo = setInterval(cargarEstadoRed, 5000);
    return () => clearInterval(intervalo);
  }, [vistaActiva]);

  useEffect(() => {
    if (vistaActiva === 'estadistica' || vistaActiva === 'admin') {
      consultarDatosTabla(false);
    }
  }, [vistaActiva]);

  const obtenerColorRed = (nombreEquipo) => {
    const info = equiposRed.find(e => e.equipo === nombreEquipo);
    if (!info) return null;
    return info.estado === 'Encendida' ? 'naranja' : 'morado';
  };

  const handleEntradaSubmit = async (e) => {
    e.preventDefault();
    if (!entrada.equipo) {
      mostrarToast("No hay ningún equipo disponible.", 'error');
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
      mostrarToast("Error al conectar con el servidor", 'error');
    }
  };

  const manejarEnClase = async () => {
    try {
      const res = await fetch('http://localhost:5128/api/equipos-estado');
      const ocupados = await res.json();

      if (ocupados.length > 0) {
        mostrarToast("⚠️ Registre la salida de estudiantes antes de iniciar clase", 'error');
        return;
      }

      const response = await fetch('http://localhost:5128/api/en-clase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Docente: entrada.docente, Periodo: entrada.periodo })
      });
      if (response.ok) {
        setClaseEnCurso(true);
        mostrarToast("Equipos disponibles marcados como ocupados", 'entrada-success');
      } else {
        mostrarToast("Error al procesar el estado en clase", 'error');
      }
    } catch (error) {
      mostrarToast("Error de conexión", 'error');
    }
  };

  const manejarFinalizarClase = async () => {
    try {
      const response = await fetch('http://localhost:5128/api/finalizar-clase', { method: 'PUT' });
      if (response.ok) {
        setClaseEnCurso(false);
        mostrarToast("Clase finalizada, equipos liberados", 'salida-success');
      } else {
        mostrarToast("Error al finalizar clase", 'error');
      }
    } catch (error) {
      mostrarToast("Error de conexión", 'error');
    }
  };

  const handleSalidaSubmit = async (e) => {
    e.preventDefault();
    if (!/^[12][0-9]{0,8}$/.test(matriculaSalida)) {
      mostrarToast("Matrícula inválida", 'error');
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
      mostrarToast("Error al conectar con el servidor", 'error');
    }
  };

  const consultarDatosTabla = async (notificar = true) => {
    try {
      const response = await fetch('http://localhost:5128/api/reporte');
      const datos = await response.json();

      if (datos.length === 0) {
        if (notificar) mostrarToast("No hay datos disponibles", 'error');
        setDatosTabla([]);
        return;
      }

      setDatosTabla(datos);
      if (notificar) mostrarToast("📋 Datos cargados correctamente", 'entrada-success');
    } catch (error) {
      if (notificar) mostrarToast("Error al obtener los datos", 'error');
    }
  };

  const descargarExcel = async () => {
    try {
      const response = await fetch('http://localhost:5128/api/reporte');
      const datos = await response.json();

      if (datos.length === 0) {
        mostrarToast("No hay datos para exportar", 'error');
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
        'Tiempo de Uso (Minutos)': obtenerMinutosDeUso(row),
        'Año': row.Año || (row.fecha ? row.fecha.split('-')[0] : 'N/A')
      }));

      const hoja = XLSX.utils.json_to_sheet(datosFormateados);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Reporte Laboratorio");
      XLSX.writeFile(libro, "Reporte_Laboratorio_L002.xlsx");
      mostrarToast("📊 Reporte descargado con éxito", 'entrada-success');
    } catch (error) {
      mostrarToast("Error al generar reporte Excel", 'error');
    }
  };

  const descargarPDF = () => {
    const elemento = dashboardRef.current;
    if (!elemento) return;

    const opt = {
      margin:       0.2,
      filename:     'Reporte_Estadistico_L002.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(elemento).save();
    mostrarToast("📄 PDF generado correctamente", 'entrada-success');
  };

  // Estilo reutilizable para los recuadros/tarjetas de gráficos
  const cardStyle = {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
    boxSizing: 'border-box',
    minWidth: 0
  };

  const cardTitleStyle = {
    textAlign: 'center',
    margin: '0 0 16px 0',
    fontSize: '1.05rem',
    fontWeight: '600',
    color: '#1e293b'
  };

  const chartWrapperStyle = {
    height: '280px',
    position: 'relative'
  };

  return (
    <div className="app-container">
      {/* FRANJA / HEADER INSTITUCIONAL */}
      <header className="header-institucional">
        <img src="/logo.svg" alt="ESPOL FCSH" className="header-logo" />
      </header>

      {toast.visible && (
        <div className={`toast-popup ${toast.tipo}`}>
          <span className="toast-text">{toast.mensaje}</span>
          <button className="toast-close-btn" onClick={() => setToast({ ...toast, visible: false })}>&times;</button>
        </div>
      )}

      <div className="app-layout">
        <aside className="sidebar">
          <nav className="sidebar-menu">
            <button className={`sidebar-link ${vistaActiva === 'entrada' ? 'active' : ''}`} onClick={() => setVistaActiva('entrada')}>📥 Registro de Entrada</button>
            <button className={`sidebar-link ${vistaActiva === 'salida' ? 'active' : ''}`} onClick={() => setVistaActiva('salida')}>📤 Registro de Salida</button>
            <button className={`sidebar-link ${vistaActiva === 'admin' ? 'active' : ''}`} onClick={() => setVistaActiva('admin')}>⚙️ Panel de Administración</button>
            <button className={`sidebar-link ${vistaActiva === 'estadistica' ? 'active' : ''}`} onClick={() => setVistaActiva('estadistica')}>📊 Panel Estadística</button>
            <button className={`sidebar-link ${vistaActiva === 'reservaClases' ? 'active' : ''}`} onClick={() => setVistaActiva('reservaClases')}>📅 Reserva para Clases</button>
            <button className={`sidebar-link ${vistaActiva === 'equipos' ? 'active' : ''}`} onClick={() => setVistaActiva('equipos')}>💻 Panel de Equipos</button>
          </nav>
        </aside>

        <main className="main-content-wrapper">
          <header className="main-header">
            <h1>Sistema de Préstamo</h1>
            <p>Control de Ingreso y Salida de Alumnos</p>
          </header>

          <div className={(vistaActiva === 'admin' || vistaActiva === 'equipos' || vistaActiva === 'estadistica') ? "content-card-view wide-view" : "content-card-view"}>

            {vistaActiva === 'entrada' && (
              <section className="view-active section-entrada animate-fade-in">
                <h2>Registro de Entrada</h2>
                <form onSubmit={handleEntradaSubmit} className="form-column">
                  <div className="form-group">
                    <label>Matrícula</label>
                    <input type="text" name="matricula" className="form-input" placeholder="Ej. 202410123" value={entrada.matricula} onChange={handleMatriculaChange} inputMode="numeric" maxLength={9} required />
                  </div>
                  <div className="form-group-row">
                    <div className="form-group">
                      <label>Nombres</label>
                      <input type="text" name="nombre" className={`form-input ${entrada.nombre ? 'auto-filled' : ''}`} placeholder="Nombre" value={entrada.nombre} onChange={handleNombreChange} required />
                    </div>
                    <div className="form-group">
                      <label>Apellidos</label>
                      <input type="text" name="apellido" className="form-input" placeholder="Apellido" value={entrada.apellido} onChange={handleApellidoChange} required />
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
                        <input type="text" className="form-input input-disabled" value="No hay equipos disponibles" disabled />
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

            {vistaActiva === 'salida' && (
              <section className="view-active section-salida animate-fade-in">
                <h2>Registro de Salida</h2>
                <img src="/logo.png" alt="Logo Institucional" className="logo-salida" />
                <form onSubmit={handleSalidaSubmit} className="form-column">
                  <div className="form-group group-salida-center">
                    <label>Matrícula</label>
                    <input type="text" className="form-input input-grande" placeholder="Ingrese Matrícula para Salida" value={matriculaSalida} onChange={handleMatriculaSalidaChange} maxLength={9} required />
                  </div>
                  <button type="submit" className="btn btn-salida">Registrar Salida</button>
                </form>
              </section>
            )}

            {vistaActiva === 'admin' && (
              <section className="view-active admin-view-section animate-fade-in">
                <h2>Panel de Administración</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Generación de reportes detallados del uso del Laboratorio L002.
                </p>
                <div className="admin-actions-container" style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '25px', flexWrap: 'wrap' }}>
                  <button onClick={() => consultarDatosTabla(true)} className="btn btn-entrada btn-large">📋 Visualizar Tabla</button>
                  <button onClick={descargarExcel} className="btn btn-excel btn-large">📊 Descargar Reporte (Excel)</button>
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
                        {datosTabla.map((row, index) => {
                          const mins = obtenerMinutosDeUso(row);
                          const anio = row.Año || (row.fecha ? row.fecha.split('-')[0] : 'N/A');
                          return (
                            <tr key={index}>
                              <td>{row.nombre}</td>
                              <td>{row.apellido}</td>
                              <td>{row.matricula}</td>
                              <td>{row.carrera}</td>
                              <td>{row.equipo || 'N/A'}</td>
                              <td>{row.fecha}</td>
                              <td>{row.horaInicio}</td>
                              <td>{row.horaSalida ? row.horaSalida : <span className="status-badge">En uso</span>}</td>
                              <td>{mins > 0 ? `${mins} min` : 'En uso'}</td>
                              <td>{row.periodo !== null ? `${row.periodo}` : 'N/A'}</td>
                              <td>{anio}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {vistaActiva === 'estadistica' && (() => {
              const aniosDisponibles = Array.from(new Set(
                datosTabla.map(d => d.Año || (d.fecha ? d.fecha.split('-')[0] : null)).filter(Boolean)
              )).sort((a, b) => b - a);

              const datosFiltrados = datosTabla.filter(d => {
                if (!d.fecha) return true;
                const partesFecha = d.fecha.split('-');
                const anioReg = d.Año || partesFecha[0];
                const mesReg = partesFecha[1] ? parseInt(partesFecha[1], 10) : null;

                if (filtroAnio !== 'TODOS' && String(anioReg) !== String(filtroAnio)) return false;
                if (filtroMes !== 'TODOS' && String(mesReg) !== String(filtroMes)) return false;

                return true;
              });

              const totalUsos = datosFiltrados.length;

              const tiemposValidos = datosFiltrados
                .map(d => obtenerMinutosDeUso(d))
                .filter(t => t > 0);

              const promedioMinutos = tiemposValidos.length > 0
                ? tiemposValidos.reduce((a, b) => a + b, 0) / tiemposValidos.length
                : 0;
              const horasPromedioSesion = (promedioMinutos / 60).toFixed(1);

              const pcsPorFecha = datosFiltrados.reduce((acc, curr) => {
                if (curr.fecha && curr.equipo) {
                  if (!acc[curr.fecha]) acc[curr.fecha] = new Set();
                  acc[curr.fecha].add(curr.equipo);
                }
                return acc;
              }, {});

              const diasConUso = Object.keys(pcsPorFecha).length;
              const totalPcsUnicasUsadas = Object.values(pcsPorFecha).reduce((sum, set) => sum + set.size, 0);
              const promedioEquiposPorDia = diasConUso > 0
                ? (totalPcsUnicasUsadas / diasConUso).toFixed(1)
                : 0;

              const horasCount = datosFiltrados.reduce((acc, curr) => {
                if (curr.horaInicio) {
                  const horaNum = parseInt(curr.horaInicio.split(':')[0], 10);
                  if (!isNaN(horaNum)) {
                    acc[horaNum] = (acc[horaNum] || 0) + 1;
                  }
                }
                return acc;
              }, {});

              let horaPicoTexto = "N/A";
              let maxUsosHora = 0;

              Object.entries(horasCount).forEach(([hora, count]) => {
                if (count > maxUsosHora) {
                  maxUsosHora = count;
                  const hStart = String(hora).padStart(2, '0');
                  const hEnd = String(Number(hora) + 1).padStart(2, '0');
                  horaPicoTexto = `${hStart}:00 - ${hEnd}:00`;
                }
              });

              const datosAlumnos = datosFiltrados.filter(d => !d.carrera || !d.carrera.toLowerCase().startsWith('reservado por'));
              const datosDocentes = datosFiltrados.filter(d => d.carrera && d.carrera.toLowerCase().startsWith('reservado por'));

              const carrerasCount = datosAlumnos.reduce((acc, curr) => {
                const key = curr.carrera || 'Otra';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {});

              const dataCarreras = {
                labels: Object.keys(carrerasCount),
                datasets: [{
                  label: 'N° de Estudiantes',
                  data: Object.values(carrerasCount),
                  backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b']
                }]
              };

              const docentesCount = datosDocentes.reduce((acc, curr) => {
                let nombreDocente = curr.carrera.replace(/Reservado por\s*/i, '').trim();
                if (!nombreDocente) nombreDocente = "Docente General";
                acc[nombreDocente] = (acc[nombreDocente] || 0) + 1;
                return acc;
              }, {});

              const dataDocentes = {
                labels: Object.keys(docentesCount).length > 0 ? Object.keys(docentesCount) : ['Sin reservas'],
                datasets: [{
                  label: 'Frecuencia de Reservas',
                  data: Object.keys(docentesCount).length > 0 ? Object.values(docentesCount) : [0],
                  backgroundColor: '#ec4899'
                }]
              };

              const equiposCount = datosFiltrados.reduce((acc, curr) => {
                const key = curr.equipo || 'N/A';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {});

              const dataEquipos = {
                labels: Object.keys(equiposCount),
                datasets: [{
                  label: 'Cantidad de Usos',
                  data: Object.values(equiposCount),
                  backgroundColor: '#0ea5e9'
                }]
              };

              const horasPicoCount = datosFiltrados.reduce((acc, curr) => {
                if (curr.horaInicio) {
                  const hora = curr.horaInicio.split(':')[0] + ':00';
                  acc[hora] = (acc[hora] || 0) + 1;
                }
                return acc;
              }, {});

              const horasOrdenadas = Object.keys(horasPicoCount).sort();

              const dataHorasPico = {
                labels: horasOrdenadas,
                datasets: [{
                  label: 'Préstamos por Hora',
                  data: horasOrdenadas.map(h => horasPicoCount[h]),
                  borderColor: '#f59e0b',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  fill: true
                }]
              };

              const periodoCount = datosFiltrados.reduce((acc, curr) => {
                const key = curr.periodo || 'Sin definir';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {});

              const dataComparativaPeriodo = {
                labels: Object.keys(periodoCount),
                datasets: [{
                  label: 'Total de Préstamos',
                  data: Object.values(periodoCount),
                  backgroundColor: ['#4f46e5', '#db2777', '#0d9488']
                }]
              };

              const rangosTiempo = { '< 30 min': 0, '30-60 min': 0, '1-2 horas': 0, '> 2 horas': 0 };
              tiemposValidos.forEach(t => {
                if (t < 30) rangosTiempo['< 30 min']++;
                else if (t <= 60) rangosTiempo['30-60 min']++;
                else if (t <= 120) rangosTiempo['1-2 horas']++;
                else rangosTiempo['> 2 horas']++;
              });

              const dataPermanencia = {
                labels: Object.keys(rangosTiempo),
                datasets: [{
                  label: 'Cantidad de Estudiantes',
                  data: Object.values(rangosTiempo),
                  backgroundColor: '#8b5cf6'
                }]
              };

              return (
                <section className="view-active animate-fade-in">
                  <h2>Panel Estadística</h2>
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '15px' }}>
                    Indicadores clave del Laboratorio L002.
                  </p>

                  <div style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    background: '#f1f5f9',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    gap: '15px'
                  }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <strong>Filtros:</strong>
                      <div>
                        <label style={{ fontSize: '0.85rem', marginRight: '5px' }}>Año:</label>
                        <select
                          className="form-select"
                          value={filtroAnio}
                          onChange={(e) => setFiltroAnio(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        >
                          <option value="TODOS">Todos los años</option>
                          {aniosDisponibles.map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.85rem', marginRight: '5px' }}>Mes:</label>
                        <select
                          className="form-select"
                          value={filtroMes}
                          onChange={(e) => setFiltroMes(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        >
                          <option value="TODOS">Todos los meses</option>
                          {MESES_NOMBRES.map((nombreMes, index) => (
                            <option key={index + 1} value={index + 1}>{nombreMes}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button onClick={descargarPDF} className="btn btn-entrada" style={{ padding: '8px 16px' }}>
                      📄 Descargar Reporte (PDF)
                    </button>
                  </div>

                  <div ref={dashboardRef} style={{ padding: '5px' }}>
                    
                    <div className="kpi-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                      
                      <div className="kpi-card" style={{ background: '#f8fafc', borderLeft: '5px solid #3b82f6', padding: '15px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Uso Promedio por Sesión</span>
                        <h3 style={{ fontSize: '1.8rem', margin: '5px 0 0 0', color: '#1e293b' }}>
                          {horasPromedioSesion} <span style={{ fontSize: '1rem' }}>hrs</span>
                          <small style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>({promedioMinutos.toFixed(0)} mins/estudiante)</small>
                        </h3>
                      </div>

                      <div className="kpi-card" style={{ background: '#f8fafc', borderLeft: '5px solid #10b981', padding: '15px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Promedio PCs Usadas / Día</span>
                        <h3 style={{ fontSize: '1.8rem', margin: '5px 0 0 0', color: '#1e293b' }}>
                          {promedioEquiposPorDia} <span style={{ fontSize: '1rem' }}>PCs/día</span>
                        </h3>
                      </div>

                      <div className="kpi-card" style={{ background: '#f8fafc', borderLeft: '5px solid #8b5cf6', padding: '15px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Hora Pico de Mayor Uso</span>
                        <h3 style={{ fontSize: '1.4rem', margin: '5px 0 0 0', color: '#1e293b' }}>
                          {horaPicoTexto}
                          <small style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                            {maxUsosHora > 0 ? `(${maxUsosHora} préstamos registrados)` : 'Sin datos'}
                          </small>
                        </h3>
                      </div>

                      <div className="kpi-card" style={{ background: '#f8fafc', borderLeft: '5px solid #f59e0b', padding: '15px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Total de Registros</span>
                        <h3 style={{ fontSize: '1.8rem', margin: '5px 0 0 0', color: '#1e293b' }}>{totalUsos}</h3>
                      </div>

                    </div>

                    {/* SECCIÓN DE GRÁFICOS CON TARJETAS RECUADRADAS Y SEPARADAS */}
                    <div className="charts-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                      gap: '24px',
                      width: '100%',
                      marginTop: '20px'
                    }}>
                      
                      {/* Tarjeta 1: Uso por Carrera */}
                      <div style={cardStyle}>
                        <h3 style={cardTitleStyle}>Uso por Carrera (Solo Alumnos)</h3>
                        <div style={chartWrapperStyle}>
                          <Bar data={dataCarreras} options={chartOptionsBase} />
                        </div>
                      </div>

                      {/* Tarjeta 2: Reservas por Docente (Horizontal) */}
                      <div style={cardStyle}>
                        <h3 style={cardTitleStyle}>Reservas por Docente</h3>
                        <div style={chartWrapperStyle}>
                          <Bar
                            data={dataDocentes}
                            options={{
                              ...chartOptionsBase,
                              indexAxis: 'y',
                              scales: {
                                x: { beginAtZero: true, ticks: { precision: 0 } },
                                y: { ticks: { font: { size: 10 } } }
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Tarjeta 3: Uso de Computadoras */}
                      <div style={cardStyle}>
                        <h3 style={cardTitleStyle}>Uso de Computadoras</h3>
                        <div style={chartWrapperStyle}>
                          <Bar data={dataEquipos} options={chartOptionsBase} />
                        </div>
                      </div>

                      {/* Tarjeta 4: Horas Pico */}
                      <div style={cardStyle}>
                        <h3 style={cardTitleStyle}>Horas Pico (Mayor Demanda)</h3>
                        <div style={chartWrapperStyle}>
                          <Line data={dataHorasPico} options={chartOptionsBase} />
                        </div>
                      </div>

                      {/* Tarjeta 5: Préstamos por Periodo */}
                      <div style={cardStyle}>
                        <h3 style={cardTitleStyle}>Préstamos por Periodo</h3>
                        <div style={chartWrapperStyle}>
                          <Bar data={dataComparativaPeriodo} options={chartOptionsBase} />
                        </div>
                      </div>

                      {/* Tarjeta 6: Tiempo de Permanencia */}
                      <div style={cardStyle}>
                        <h3 style={cardTitleStyle}>Tiempo de Permanencia</h3>
                        <div style={chartWrapperStyle}>
                          <Bar data={dataPermanencia} options={chartOptionsBase} />
                        </div>
                      </div>

                    </div>

                  </div>
                </section>
              );
            })()}

            {vistaActiva === 'reservaClases' && (
              <section className="view-active animate-fade-in">
                <h2>Reserva de Equipos para Clases</h2>
                <div className="equipos-header-container" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <select className="form-select" value={entrada.docente || DOCENTES[0]} onChange={handleInputChange} name="docente">
                      {DOCENTES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select className="form-select" value={entrada.periodo || PERIODOS[0]} onChange={handleInputChange} name="periodo">
                      {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="botones-container" style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={manejarEnClase} className="btn btn-entrada">💻 En Clase</button>
                    <button onClick={manejarFinalizarClase} className="btn btn-finalizar-clase">🔓 Fin Clase</button>
                  </div>
                </div>
              </section>
            )}

            {vistaActiva === 'equipos' && (
              <section className="view-active animate-fade-in">
                <h2 style={{ marginTop: '25px', color: 'var(--text-main)' }}>Panel de Equipos</h2>
                {advertenciaPanel && (
                  <div style={{ background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', borderRadius: '6px', padding: '10px 15px', marginBottom: '15px', fontSize: '0.85rem', textAlign: 'center' }}>
                    ⚠️ {advertenciaPanel}
                  </div>
                )}
                {equiposPanel.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aún no hay equipos registrados.</p>
                )}
                <div className="equipos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                  {equiposPanel.map((eq) => {
                    const estilo = ESTADO_EQUIPO_STYLES[eq.estado] || ESTADO_EQUIPO_STYLES['No disponible'];
                    const colorRed = obtenerColorRed(eq.nombre);
                    return (
                      <div key={eq.id} className={`equipo-card ${eq.ocupado ? 'ocupado' : ''}`} style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center', position: 'relative' }}>
                        {colorRed && (
                          <span style={{ position: 'absolute', top: '6px', right: '6px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: colorRed === 'naranja' ? '#FF8C00' : '#7B2FF7', boxShadow: `0 0 6px ${colorRed === 'naranja' ? '#FF8C00' : '#7B2FF7'}` }} />
                        )}
                        {eq.nombre}
                        <div style={{ fontSize: '0.7rem', marginTop: '5px', color: estilo.color, background: estilo.bg, padding: '2px 6px', borderRadius: '4px' }}>
                          {eq.estado}
                        </div>
                        {colorRed && (
                          <div style={{ fontSize: '0.65rem', marginTop: '4px', color: colorRed === 'naranja' ? '#9a5b00' : '#5b21b6', background: colorRed === 'naranja' ? '#fff3e0' : '#ede9fe', padding: '2px 6px', borderRadius: '4px' }}>
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
    </div>
  );
}

export default App;