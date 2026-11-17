import React, { useEffect } from 'react';

// Ventana emergente reutilizable (editar, confirmar eliminación, etc.)
function Modal({ titulo, onCerrar, children }) {
  useEffect(() => {
    const cerrarConEscape = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onCerrar]);

  return (
    <div className="modal-fondo" onMouseDown={onCerrar}>
      <div className="modal-caja animate-fade-in" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-encabezado">
          <h3>{titulo}</h3>
          <button className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
