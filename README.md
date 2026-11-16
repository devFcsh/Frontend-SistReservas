# Frontend-SistPréstamos

Requisitos Previos

Antes de ejecutar el proyecto, asegúrese de tener instalado:

----Frontend----
React
Node.js versión 18 o superior. (Probado con: Node v22 y Node v24)
npm (incluido con Node.js)
----Backend----
ASP.NET
.NET SDK 9.0

Instalación y Ejecución
Frontend---------------------------------------------------------------------
1. Ingresar a la carpeta del frontend
cd FrontendReservas
2. Instalar dependencias (incluye xlsx, chart.js, react-chartjs-2, recharts, html2pdf.js, jspdf y html2canvas)
npm install
3. Ejecutar el proyecto
npm run dev
Backend---------------------------------------------------------------------
1. Ingresar a la carpeta del backend
cd BackendReservas
2. Restaurar paquetes del proyecto
dotnet restore
3. Ejecutar el backend
dotnet run

Trabajo en la rama develop
---------------------------------------------------------------------
Los cambios en curso se realizan en la rama develop (creada a partir de produccion).
La carpeta node_modules ya NO se guarda en el repositorio (está en .gitignore),
por lo que es obligatorio instalar las dependencias después de cambiarse de rama.

1. Descargar y cambiarse a la rama develop
git fetch
git switch develop
2. Instalar dependencias
cd FrontendReservas
npm install
3. Ejecutar el proyecto
npm run dev

Nota: cada vez que hagas git pull y alguien haya agregado o actualizado una librería
(cambios en package.json o package-lock.json), vuelve a ejecutar npm install.