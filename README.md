# ⚡ APOLO 

Plataforma de gestión integral del estilo de vida: entrenamientos, nutrición, hábitos, progreso y más.

---

## Instalación y Uso 

```bash
# 1. Instalar dependencias Node.js
npm install

# 2. Instalar dependencias Python (para las gráficas)
pip3 install matplotlib numpy

# 3. Configurar base de datos (MySQL/Clever Cloud)
#    Ejecutar setup.sql en tu gestor de BD
#    (ya configurado en conexion.bd/db.js)

# 4. Iniciar el servidor
node app.js

# Modo desarrollo (con recarga automática)
npm run dev
```

Abrir en el navegador: **http://localhost:3000**

---

## Descripción

Apolo es una aplicación web de gestión personal enfocada en la transformación física y mental. Va más allá de un simple seguidor de rutinas: integra nutrición, hábitos diarios, estadísticas avanzadas y una agenda de entrenamiento para acompañar al usuario en su día a día.

---

## Funcionalidades

### Dashboard
- Saludo personalizado con nombre del usuario
- **Tu Enfoque Hoy**: muestra la categoría de tu última rutina
- **Próximo Entrenamiento**: el próximo ejercicio agendado con fecha y hora
- **Racha Activa**: días consecutivos de entrenamiento calculados en tiempo real
- Navegación rápida a todas las secciones

### Rutinas de Entrenamiento
- Catálogo personal de rutinas (CRUD completo)
- Creación y edición de rutinas con tipo, nivel y duración
- Gestión de ejercicios dentro de cada rutina (series, reps, descanso)
- Botón para **marcar rutina como completada** → registra la racha
- Vista detallada de cada rutina

### Nutrición
- **Resumen diario** con barra de progreso de calorías y macros (proteína, carbos, grasas)
- **Objetivos personalizados** por usuario (ajustables)
- Catálogo de comidas recomendadas filtradas por objetivo del usuario
- Añadir comidas al plan del día con porción
- Filtro por tipo de comida (desayuno, almuerzo, cena, snack, pre/post entrenamiento)
- Historial de comidas del día con botón de eliminar

### Hábitos Saludables
- **Hábitos de hoy**: lista de hábitos activos con estado (completado / pendiente)
- Toggle interactivo para marcar/desmarcar hábitos del día
- **Racha individual** por hábito + racha máxima histórica
- Catálogo de hábitos precargado con 10+ hábitos recomendados
- Filtro por categoría (Salud, Ejercicio, Nutrición, Descanso, Productividad, Bienestar)
- Filtro de "Solo recomendados"
- Añadir hábitos del catálogo al perfil personal

### Estadísticas *(Python · Matplotlib)*
- **5 gráficas generadas por Python** en tiempo real desde el servidor:
  - **Progreso semanal** (línea): rutinas completadas los últimos 7 días
  - **Distribución de hábitos** (donut): porcentaje por categoría
  - **Evolución de peso** (área): historial de peso corporal
  - **Calorías semanales** (barras): consumo vs objetivo diario
  - **Heatmap de actividad** (calendar): días activos del mes
- Tarjetas resumen: total entrenamientos, hábitos logrados, racha activa
- Botón "Actualizar" para regenerar gráficas al momento

### Perfil de Usuario
- Datos físicos: edad, altura, peso, objetivo personal
- **Cálculo automático del IMC** con clasificación
- Bio personal personalizable
- **Subida de foto de perfil** (avatar) con Multer
- Gráfica de evolución de peso (Python)
- Historial de registros de peso
- Lista de rutinas recientes
- **Agenda de próximos entrenamientos**
- Modales para: Editar perfil · Registrar peso · Agendar entrenamiento

### Crear Hábitos y Comidas Personalizadas
- **Crear hábitos propios** desde `/habits/create`
  - Nombre, descripción, categoría, frecuencia
  - Icono personalizable (Font Awesome)
  - Color personalizado
- **Crear comidas/recetas** desde `/nutrition/create`
  - Nombre, descripción, tipo de comida
  - Macros: calorías, proteína, carbohidratos, grasas
  - Objetivo asociado (opcional)

---

## Tecnologías

### Backend
| Tecnología | Uso |
|---|---|
| **Node.js** | Motor de ejecución del servidor |
| **Express.js 5** | Framework web (rutas, middleware) |
| **MySQL 2** | Driver BD en la nube (Clever Cloud) |
| **EJS** | Motor de plantillas HTML |
| **express-session** | Gestión de sesiones de usuario |
| **bcrypt** | Hash de contraseñas |n| **Multer** | Subida de archivos (avatares) |
| **Python 3** | Generación de gráficas estadísticas |
| **Matplotlib** | Librería de visualización científica |
| **NumPy** | Computación numérica para gráficas |

### Frontend
| Tecnología | Uso |
|---|---|
| **HTML / EJS** | Estructura y templating |
| **CSS3 (custom)** | Estilos con variables CSS, glassmorphism |
| **JavaScript ES6+** | Interactividad del cliente |
| **Font Awesome** | Iconografía |
| **Google Fonts** | Tipografías (Playfair Display, Montserrat) |

### Base de Datos
- **MySQL en la nube** (Clever Cloud)
- Pool de conexiones con `mysql2/promise`

---

## Base de Datos

### Tablas existentes
```
usuarios      - Autenticación y datos del perfil
rutinas       - Rutinas de entrenamiento por usuario
ejercicios    - Ejercicios dentro de cada rutina
peso_registro           - Historial de peso corporal
entrenamientos_log      - Log de rutinas completadas (racha)
habitos_catalogo        - Catálogo de hábitos predefinidos
habitos_usuario         - Hábitos activos del usuario
habitos_registros       - Registro diario de cumplimiento
comidas_catalogo        - Catálogo de comidas y macros
plan_nutricional        - Objetivos nutricionales del usuario
comidas_usuario         - Diario de comidas del día
agenda_entrenamientos   - Próximos entrenamientos programados
```

---

## Estructura del proyecto

```
Apolo/
├── app.js                     # Servidor principal (Express)
├── conexion.bd/
│   └── db.js                  # Pool de conexión MySQL
├── python/
│   └── charts.py              # Script Python para gráficas (Matplotlib)
├── public/
│   ├── css/
│   │   ├── styles.css         # Estilos globales
│   │   ├── global.css         # Variables CSS y reset
│   │   └── main.css           # Componentes reutilizables
│   ├── js/
│   │   └── api.js             # Wrapper fetch para llamadas internas
│   ├── charts/                # Gráficas PNG generadas por Python
│   ├── images/                # Imágenes estáticas de la plataforma
│   └── uploads/
│       └── avatars/            # Avatares de usuario
├── views/
│   ├── auth/
│   │   ├── inicio.ejs         # Landing page
│   │   └── login-register.ejs # Login / registro
│   ├── partials/
│   │   ├── header.ejs         # Head HTML + navbar
│   │   ├── navbar.ejs         # Sidebar (mobile)
│   │   └── footer.ejs         # Pie de página
│   ├── dashboard.ejs          # Panel principal
│   ├── routines.ejs           # Lista de rutinas
│   ├── routines-form.ejs      # Formulario crear/editar rutina
│   ├── routine-detail.ejs     # Detalle de rutina + ejercicios
│   ├── nutrition.ejs          # Plan nutricional
│   ├── nutrition-form.ejs     # Formulario crear comida
│   ├── habits.ejs             # Hábitos diarios
│   ├── habits-form.ejs        # Formulario crear hábito
│   ├── stats.ejs              # Estadísticas (gráficas Python)
│   ├── profile.ejs            # Perfil de usuario
│   ├── destino.ejs           # Página de destino
│   ├── 404.ejs               # Página de error 404
│   └── error.ejs             # Página de error 500
├── package.json
└── README.md
```

---

## Integración Node.js ↔ Python

El servidor Node.js llama al script Python mediante `child_process.spawn`:

```js
// En app.js
const { spawn } = require('child_process');

function runPython(payload) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', ['python/charts.py']);
    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
    // Lee el JSON de salida y resuelve la promesa
  });
}
```

El script Python recibe un JSON con el tipo de gráfica y los datos, genera la imagen PNG con **Matplotlib** y responde con la ruta de la imagen:

```python
# python/charts.py
payload = json.loads(sys.stdin.read())
# → genera PNG en public/charts/
print(json.dumps({"success": True, "path": "/charts/weekly_1.png"}))
```

Las 5 gráficas disponibles:

| Tipo | Gráfica |
|---|---|
| `weekly` | Progreso semanal (línea) |
| `habits` | Distribución hábitos (donut) |
| `weight` | Evolución de peso (área) |
| `calories` | Calorías semanales (barras) |
| `streak` | Heatmap actividad mensual |

---

## Seguridad

- Contraseñas hasheadas con **bcrypt** (12 rondas)
- Sesiones HTTP-only con `express-session`
- Middleware `requireLogin` en todas las rutas protegidas
- Consultas parametrizadas (previene SQL injection)

---

## Variables de entorno (opcionales)

Crear un archivo `.env` en la raíz:

```env
PORT=3000
SESSION_SECRET=tu-secreto-seguro
NODE_ENV=development
```

---

## Autor

**Angel Salgado** — Sistema Apolo ⚡

---

> *"Mens sana in corpore sano"*
