# Portal de Control Interno v2.0

Una aplicación web integral y robusta diseñada para la gestión de personal, control de horarios, y registro de novedades de turno. Construida con un enfoque **"Offline-First"**, la aplicación garantiza funcionalidad completa sin necesidad de una conexión a internet constante, almacenando todos los datos de forma segura en el navegador del cliente.

La versión 2.0 introduce un dashboard rediseñado con paneles de información proactivos, un sistema de calendario de turnos dedicado y mejoras significativas en la usabilidad y la gestión de datos.

## ✨ Características Principales

### 🏗️ Offline-First & Sincronización con Backend

Esta aplicación está construida con una arquitectura **"Offline-First"**, lo que significa que es completamente funcional sin una conexión a internet. La sincronización con un servidor backend se maneja de manera inteligente y transparente para el usuario.

-   **Base de Datos Local (IndexedDB):** Todas las operaciones (crear, leer, actualizar, eliminar) se realizan instantáneamente contra la base de datos del navegador, garantizando velocidad y disponibilidad offline.
-   **Sincronización Automática y Manual:**
    -   La aplicación detecta automáticamente cuando recupera la conexión a internet y ejecuta un proceso de sincronización.
    -   El usuario puede iniciar una sincronización manual en cualquier momento a través del icono de estado en la cabecera.
-   **Feedback Visual Claro:**
    -   Un **icono de estado de sincronización** en la cabecera informa al usuario del estado actual: inactivo, sincronizando, éxito, error o sin conexión.
    -   En caso de errores de sincronización, el usuario puede hacer clic en el icono para ver un **modal con los detalles de cada error**, lo que le permite corregir los datos si es necesario.
-   **Resolución de Conflictos:** La estrategia principal es "el último guardado gana" (*last write wins*), basada en el timestamp `lastModified` de cada registro para asegurar la consistencia de los datos.
-   **API de Sincronización Definida:** La comunicación con el backend se realiza a través de endpoints bien definidos (`/api/bootstrap`, `/api/sync`) que manejan la carga inicial de datos y la sincronización de cambios incrementales (deltas).

### 🛠️ Herramientas de Desarrollo (Modo Desarrollador)

Para facilitar la depuración y las pruebas, la aplicación incluye un **Panel de Desarrollador** accesible solo para usuarios con rol de **Administrador**.

-   **Acceso:** Un botón flotante con el icono `</>` activa el panel.
-   **Estadísticas de Sincronización:** Muestra el `lastSyncTimestamp` y contadores en tiempo real de registros `pending` y `error`.
-   **Registro de Conflictos:** Lista los conflictos resueltos por el servidor en la última sincronización, con opción de exportarlos a CSV.
-   **Simulador de Errores:** Un botón para "Simular Error de Sync" crea un registro de empleado que está diseñado para ser rechazado por el backend, permitiendo probar fácilmente todo el flujo de manejo de errores de la UI.

### Dashboard Principal
- **Panel de Bienvenida:** Saludo personalizado y visualización del estado de marcaje actual del usuario (Presente/Ausente).
- **Acciones Rápidas:** Cuadrícula de botones para acceso inmediato a `Marcar Horario`, `Libro de Novedades`, `Calendario de Turnos` y `Gestionar Personal`.
- **Próximos a Entrar (Admin/Supervisor):** Un panel proactivo que muestra los empleados programados para entrar, con alertas de colores para atrasos (amarillo para advertencia, naranja para alerta, rojo para ausente). Genera automáticamente entradas en el libro de novedades para atrasos significativos.
- **Salidas Faltantes (Admin/Supervisor):** Alerta visual (parpadeante) para empleados que no han marcado su salida después de finalizado su turno. Un doble clic en la alerta lleva directamente al registro para su gestión.
- **Estado del Equipo y Novedades (Admin/Supervisor):** Resumen visual de la asistencia del equipo y un feed con las últimas novedades del turno activo.

### ⏰ Control Horario
- **Marcaje Inteligente:** Registro de entradas y salidas con un solo clic.
- **Manejo de Anomalías:** Lógica para gestionar y proponer soluciones a marcajes olvidados (ej. crear una entrada "SIN REGISTRO" al marcar una salida sin una entrada previa).
- **Tabla de Registros Avanzada:** Búsqueda, filtros por nombre/área/fecha, paginación, y ordenamiento dinámico.
- **Edición y Exportación:** Permite editar o eliminar cualquier marcaje y exportar la vista actual a formatos CSV, Excel y PDF.

### 📖 Libro de Novedades (Bitácora)
- **Gestión de Turnos:** Sistema para iniciar y cerrar turnos, asociando un responsable. El cierre de sesión es automático tras cerrar un turno para asegurar el relevo.
- **Registro Dual:** Permite registrar "Novedades" generales y "Ingresos de Proveedores" con campos específicos (patente, conductor, etc.).
- **Edición en Vivo:** Las entradas del turno activo se pueden editar o eliminar.
- **Historial de Reportes:** Visualiza reportes cerrados.

### 📅 Gestión de Turnos (Admin/Supervisor)
- **Patrones Flexibles:** Creación de patrones con ciclos de N días, definiendo horarios, días libres y descansos.
- **Cálculo y Validación Automática:** Calcula horas netas y promedio semanal, validando contra el máximo legal.
- **Asignación de Turnos:** Asigna patrones a empleados con fechas de inicio y fin.
- **Interfaz de Gestión Integrada:** Formularios para crear y editar están integrados en la misma vista de lista.

### 🗓️ Calendario de Turnos (Todos los Roles)
- **Página Dedicada con Múltiples Vistas:** Calendario completo con vistas por Mes, Semana y Día.
- **Navegación Intuitiva:** Botón "Actual" para volver rápidamente a la fecha presente.
- **Filtros Avanzados y Exportación:** Filtra por Área, Cargo o Empleado y exporta la vista actual a PDF.
- **Vista Detallada:** Ofrece una vista clara de los turnos (individual o de equipo) con códigos de color.

### ⚙️ Organización de la Configuración
Las tareas administrativas están divididas en dos secciones claras:
- **Página de Configuración (Acceso General):**
  - **Gestión de Empleados:** Módulo para agregar, editar y cambiar el estado (Activo/Inactivo) de empleados con validación de RUT. Incluye ordenamiento avanzado y un botón de **eliminación permanente** (solo para admin) con chequeos de dependencia.
  - **Log de Auditoría:** Registro detallado de acciones importantes, con buscador y paginación. El borrado de logs está restringido al administrador.
- **Página de Administración (Solo Admin):**
  - **Gestión de Usuarios:** Creación, edición y eliminación de usuarios. Permite vincular una cuenta de usuario a un registro de empleado.
  - **Variables Globales:** Configuración de parámetros como las horas máximas semanales y la lista de Áreas de la empresa.

## 🚀 Características Técnicas

- **Stack Principal:** **React 19**, **TypeScript**, **Vite** y **Tailwind CSS**.
- **Offline-First:** Toda la información (empleados, registros, turnos, usuarios, etc.) se almacena localmente en **IndexedDB**, permitiendo un funcionamiento 100% offline.
- **Sincronización Robusta:** Lógica completa para la sincronización de datos con un backend, incluyendo manejo de estado (online/offline), resolución de conflictos y feedback de errores al usuario.
- **Gestión de Estado:** Arquitectura basada en **React Context API** y **hooks personalizados** para una gestión de estado limpia, modular y desacoplada.
- **Enrutamiento:** **React Router** (`HashRouter`) para una navegación fluida del lado del cliente.
- **UI/UX:**
  - Diseño responsivo y moderno, optimizado para escritorio y dispositivos móviles.
  - Soporte para temas **Claro**, **Oscuro** y de **Sistema**.
  - Componentes de UI reutilizables (Botones, Inputs, Cards, etc.).
  - Notificaciones (Toasts) para un feedback claro y consistente al usuario.
  - Modales para formularios y confirmaciones, mejorando la experiencia de usuario.

## 🧑‍🤝‍🧑 Roles de Usuario

1.  **Administrador:** Acceso completo a todas las funcionalidades, incluyendo configuración, gestión de usuarios y gestión de turnos.
2.  **Supervisor:** Acceso a la "Gestión de Turnos" para crear y asignar patrones, además de las funcionalidades de usuario.
3.  **Usuario:** Acceso básico para marcar horario, registrar novedades y consultar el calendario de turnos.

## 🛠️ Cómo Ejecutar

Esta aplicación ahora utiliza un sistema de build moderno con Vite.

1.  Asegúrate de tener Node.js instalado (versión 18+ recomendada).
2.  Abre una terminal en el directorio raíz del proyecto e instala las dependencias:
    ```bash
    npm install
    ```
3.  Una vez finalizada la instalación, inicia el servidor de desarrollo:
    ```bash
    npm run dev
    ```
4.  Abre tu navegador y ve a la dirección proporcionada (usualmente `http://localhost:5173`).

## 📁 Estructura del Proyecto

```
/
├── public/             # Activos estáticos
├── src/                # Código fuente de la aplicación
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── router/
│   ├── utils/
│   ├── App.tsx
│   ├── index.tsx
│   └── ...
├── .gitignore
├── index.html          # Punto de entrada HTML
├── package.json        # Dependencias y scripts
├── tailwind.config.js  # Configuración de Tailwind
├── tsconfig.json       # Configuración de TypeScript
└── vite.config.ts      # Configuración de Vite
```

---

Desarrollado por **Jaime O. Mella V.**