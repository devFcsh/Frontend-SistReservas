import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import './App.css'; 



const CARRERAS = [
  "Economia",
  "Administracion de empresas",
  "Arqueologia",
  "Auditoria y gestion"
];

function App() {
  // Estados para los formularios
  const [entrada, setEntrada] = useState({ matricula: '', nombre: '', apellido: '', carrera: CARRERAS[0] });
  const [matriculaSalida, setMatriculaSalida] = useState('');

  // Estado para la burbuja de notificación pop-up (Toast)
  const [toast, setToast] = useState({ visible: false, mensaje: '', tipo: '' });

  // Función para mostrar la burbuja y cerrarla automáticamente a los 5 segundos
  const mostrarToast = (mensaje, tipo) => {
    setToast({ visible: true, mensaje, tipo });
    setTimeout(() => {
      setToast({ visible: false, mensaje: '', tipo: '' });
    }, 5000); 
  };

  const handleInputChange = (e) => {
    setEntrada({ ...entrada, [e.target.name]: e.target.value });
  };

  // Petición de Entrada al Backend (Puerto 5128)
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
        setEntrada({ matricula: '', nombre: '', apellido: '', carrera: CARRERAS[0] });
      } else {
        mostrarToast("Error: " + (data.error || "Datos inválidos"), 'error');
      }
    } catch (error) {
      console.error(error);
      mostrarToast("Error al conectar con el servidor", 'error');
    }
  };

  // Petición de Salida al Backend (Puerto 5128)
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

  // Función para extraer datos de MySQL y generar el archivo Excel
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
        'Hora de Inicio': row.hora_inicio,
        'Hora de Salida': row.hora_salida ? row.hora_salida : 'En uso',
        'Tiempo de Uso (Minutos)': row.tiempo_promedio !== null ? `${row.tiempo_promedio} min` : 'N/A'
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

      <div className="card main-layout">
        <header className="main-header">
          <h1>Sistema de Reservas</h1>
          <p>Control de Ingreso y Salida de Alumnos</p>
        </header>

        <div className="flex-sections-container">
          
          {/* SECCIÓN IZQUIERDA: REGISTRO DE ENTRADA */}
          <section className="column-section section-entrada">
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
              
              <div className="form-group">
                <label>Carrera</label>
                <select name="carrera" className="form-select" value={entrada.carrera} onChange={handleInputChange}>
                  {CARRERAS.map((c, index) => <option key={index} value={c}>{c}</option>)}
                </select>
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

          {/* SECCIÓN DERECHA: REGISTRO DE SALIDA */}
          <section className="column-section section-salida">
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
        </div>

        {/* PANEL DE ADMINISTRACIÓN INFERIOR */}
        <footer className="admin-footer">
          <hr className="divider" />
          <h2>Panel de Administración</h2>
          <button onClick={descargarExcel} className="btn btn-excel btn-large">
            📊 Descargar Reporte Completo (Excel)
          </button>
        </footer>
      </div>
    </div>
  );
}

export default App;