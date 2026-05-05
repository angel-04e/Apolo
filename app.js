/** APOLO ⚡
 * Servidor principal - Express + MySQL + Python (charts) */

const express       = require('express');
const path          = require('path');
const session       = require('express-session');
const cookieParser  = require('cookie-parser');
const bcrypt        = require('bcrypt');
const { spawn }     = require('child_process');
const multer        = require('multer');
require('dotenv').config();

const connection = require('./conexion.bd/db');

const app  = express();
const PORT = process.env.PORT || 3000;

//  Multer config (avatares) 
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public/uploads/avatars')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${req.session.user.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Solo imágenes jpg, png, webp'), false);
  }
});

//  Middleware de autenticación 
const requireLogin = (req, res, next) => {
  if (!req.session.userEmail) return res.redirect('/auth/login-register');
  next();
};

//  Configuración 
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser('apolo-secreto-2025'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'apolo-secreto-2025',
  resave: true,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000, httpOnly: true, secure: false }
}));

// Variables globales para vistas
app.use((req, res, next) => {
  res.locals.user            = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.user;
  res.locals.appName         = 'Apolo Fitness';
  res.locals.currentPath     = req.path;
  next();
});

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

//  Helper: ejecutar script Python 
function runPython(payload) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [path.join(__dirname, 'python', 'charts.py')]);
    let out = '', err = '';
    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
    py.stdout.on('data', d => out += d);
    py.stderr.on('data', d => err += d);
    py.on('close', code => {
      if (code !== 0) return reject(new Error(err || 'Python error'));
      try {
        // El script puede imprimir warnings antes del JSON, tomamos la última línea
        const lines = out.trim().split('\n');
        resolve(JSON.parse(lines[lines.length - 1]));
      } catch(e) {
        reject(new Error('Python output parse error: ' + out));
      }
    });
  });
}

//  Helper: calcular racha de entrenamientos 
async function calcularRacha(userId) {
  try {
    const [rows] = await connection.execute(
      `SELECT DISTINCT DATE(fecha) as fecha 
       FROM entrenamientos_log 
       WHERE usuario_id = ? 
       ORDER BY fecha DESC 
       LIMIT 60`,
      [userId]
    );
    if (!rows.length) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let racha = 0;
    let current = new Date(today);

    for (const row of rows) {
      const d = new Date(row.fecha);
      d.setHours(0, 0, 0, 0);
      const diff = (current - d) / (1000 * 60 * 60 * 24);
      if (diff === 0 || diff === 1) { racha++; current = d; }
      else break;
    }
    return racha;
  } catch { return 0; }
}

//  RUTAS DE AUTENTICACIÓN 

app.get('/', (req, res) => res.render('auth/inicio'));

app.get('/auth/login-register', (req, res) => {
  res.render('auth/login-register', { error: null, success: null, showLogin: true, registeredEmail: null });
});

// POST Registro
app.post('/auth/register', async (req, res) => {
  const { nombre, email, password, confirmPassword } = req.body;
  if (!nombre || !email || !password || !confirmPassword) {
    return res.render('auth/login-register', { error: 'Completa todos los campos', success: null, showLogin: false, registeredEmail: null });
  }
  if (password !== confirmPassword) {
    return res.render('auth/login-register', { error: 'Las contraseñas no coinciden', success: null, showLogin: false, registeredEmail: null });
  }
  if (password.length < 6) {
    return res.render('auth/login-register', { error: 'La contraseña debe tener al menos 6 caracteres', success: null, showLogin: false, registeredEmail: null });
  }
  try {
    const [existing] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.render('auth/login-register', { error: 'El email ya está registrado', success: null, showLogin: false, registeredEmail: null });
    }
    const hash = await bcrypt.hash(password, 12);
    await connection.execute('INSERT INTO usuarios (nombre, email, contrasena) VALUES (?, ?, ?)', [nombre, email, hash]);
    res.render('auth/login-register', { error: null, success: '¡Cuenta creada! Ahora inicia sesión.', showLogin: true, registeredEmail: email });
  } catch (error) {
    console.error('Error registro:', error);
    res.render('auth/login-register', { error: 'Error del servidor', success: null, showLogin: false, registeredEmail: null });
  }
});

// POST Login
app.post('/auth/login', async (req, res) => {
  const { loginemail, loginpassword } = req.body;
  if (!loginemail || !loginpassword) {
    return res.render('auth/login-register', { error: 'Completa todos los campos', success: null, showLogin: true, registeredEmail: null });
  }
  try {
    const [rows] = await connection.execute('SELECT * FROM usuarios WHERE email = ?', [loginemail]);
    if (!rows.length) {
      return res.render('auth/login-register', { error: 'Credenciales incorrectas', success: null, showLogin: true, registeredEmail: null });
    }
    const usuario = rows[0];
    const ok = await bcrypt.compare(loginpassword, usuario.contrasena);
    if (!ok) {
      return res.render('auth/login-register', { error: 'Credenciales incorrectas', success: null, showLogin: true, registeredEmail: null });
    }
    req.session.userEmail = usuario.email;
    req.session.user = { id: usuario.id, email: usuario.email, nombre: usuario.nombre, avatar_url: usuario.avatar_url };
    req.session.save(err => {
      if (err) return res.render('auth/login-register', { error: 'Error al iniciar sesión', success: null, showLogin: true, registeredEmail: null });
      res.cookie('user', usuario.email, { httpOnly: true, maxAge: 3600000, secure: false });
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Error login:', error);
    res.render('auth/login-register', { error: 'Error del servidor', success: null, showLogin: true, registeredEmail: null });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('user'); res.redirect('/'); });
});

//  DASHBOARD 
app.get('/dashboard', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  try {
    // Datos del usuario para enfoque
    const [users] = await connection.execute('SELECT * FROM usuarios WHERE id = ?', [userId]).catch(() => [[]]);
    const userData = users[0] || {};

    // Próximo entrenamiento
    const [agenda] = await connection.execute(
      `SELECT a.*, r.nombre as rutina_nombre 
       FROM agenda_entrenamientos a
       LEFT JOIN rutinas r ON a.rutina_id = r.id
       WHERE a.usuario_id = ? AND a.fecha_programada >= CURDATE() AND a.completado = 0
       ORDER BY a.fecha_programada ASC, a.hora_programada ASC
       LIMIT 1`,
      [userId]
    ).catch(() => [[]]);

    // Racha
    const racha = await calcularRacha(userId);

    // Enfoque: de BD o sugerencias por defecto
    const sugerencias = {
      'Ganancia muscular': 'Serie pesada + alta proteína',
      'Pérdida de peso': 'HIIT + déficit calórico',
      'Definición': 'Ejercicios de aislamiento',
      'Mantenimiento': 'Rutina equilibrada',
      'Resistencia': 'Cardio + alta reps'
    };
    const objetivo = userData.objetivo || null;
    const sugerencia = (objetivo && sugerencias[objetivo]) ? sugerencias[objetivo] : 'Establecer objetivo';
    const enfoqueHoy = userData.enfoque_hoy || null;

    const proximoEntrenamiento = agenda[0] || null;

    res.render('dashboard', {
      title: 'Dashboard - Apolo',
      racha,
      proximoEntrenamiento,
      enfoqueHoy,
      sugerencia,
      objetivo,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error dashboard:', error);
    res.render('dashboard', { title: 'Dashboard - Apolo', racha: 0, proximoEntrenamiento: null, enfoqueHoy: null, sugerencia: 'Establecer enfoque', objetivo: null });
  }
});

//  RUTINAS 

app.get('/routines', requireLogin, async (req, res) => {
  try {
    // Rutinas personales del usuario
    const [rutinasPersonales] = await connection.execute(
      'SELECT * FROM rutinas WHERE usuario_id = ? AND es_personal = 1 ORDER BY fecha_creacion DESC',
      [req.session.user.id]
    );
    
    // Rutinas sugeridas/del catálogo 
    const [rutinasSugeridas] = await connection.execute(
      'SELECT * FROM rutinas WHERE es_personal = 0 OR es_personal IS NULL ORDER BY fecha_creacion DESC'
    );
    
    // Combinar ambas listas
    const routines = [...rutinasPersonales, ...rutinasSugeridas];
    
    res.render('routines', { title: 'Rutinas - Apolo', routines, user: req.session.user });
  } catch (error) {
    console.error(error);
    res.render('routines', { title: 'Rutinas - Apolo', routines: [], user: req.session.user });
  }
});

app.get('/routines/create', requireLogin, (req, res) => {
  res.render('routines-form', { title: 'Nueva Rutina - Apolo', routine: null, action: 'create', user: req.session.user });
});

app.post('/routines/create', requireLogin, async (req, res) => {
  const { nombre, descripcion, tipo, duracion, nivel, ejercicios_count } = req.body;
  try {
    const [result] = await connection.execute(
      'INSERT INTO rutinas (usuario_id, nombre, descripcion, tipo, duracion, nivel, ejercicios_count, es_personal) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [req.session.user.id, nombre, descripcion, tipo, parseInt(duracion), nivel, parseInt(ejercicios_count) || 0]
    );
    res.redirect(`/routines/${result.insertId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear rutina');
  }
});

app.get('/routines/:id', requireLogin, async (req, res) => {
  try {
    const [routines] = await connection.execute(
      'SELECT * FROM rutinas WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.session.user.id]
    );
    if (!routines.length) return res.status(404).render('404', { path: req.path });
    const [ejercicios] = await connection.execute(
      'SELECT * FROM ejercicios WHERE rutina_id = ? ORDER BY orden ASC',
      [req.params.id]
    );
    const routine = routines[0];
    routine.ejercicios = ejercicios;
    res.render('routine-detail', { title: routine.nombre + ' - Apolo', routine, user: req.session.user });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error');
  }
});

app.get('/routines/:id/edit', requireLogin, async (req, res) => {
  try {
    const [routines] = await connection.execute(
      'SELECT * FROM rutinas WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.session.user.id]
    );
    if (!routines.length) return res.status(404).send('No encontrado');
    res.render('routines-form', { title: 'Editar Rutina - Apolo', routine: routines[0], action: 'edit', user: req.session.user });
  } catch (error) { res.status(500).send('Error'); }
});

app.post('/routines/:id/edit', requireLogin, async (req, res) => {
  const { nombre, descripcion, tipo, duracion, nivel, ejercicios_count } = req.body;
  try {
    await connection.execute(
      'UPDATE rutinas SET nombre=?, descripcion=?, tipo=?, duracion=?, nivel=?, ejercicios_count=? WHERE id=? AND usuario_id=?',
      [nombre, descripcion, tipo, parseInt(duracion), nivel, parseInt(ejercicios_count) || 0, req.params.id, req.session.user.id]
    );
    res.redirect(`/routines/${req.params.id}`);
  } catch (error) { res.status(500).send('Error'); }
});

app.post('/routines/:id/delete', requireLogin, async (req, res) => {
  try {
    await connection.execute('DELETE FROM rutinas WHERE id=? AND usuario_id=?', [req.params.id, req.session.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar' });
  }
});

// Marcar rutina como completada (registra en entrenamientos_log)
app.post('/routines/:id/complete', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const routineId = req.params.id;
  try {
    const [routines] = await connection.execute('SELECT * FROM rutinas WHERE id=? AND usuario_id=?', [routineId, userId]);
    if (!routines.length) return res.status(404).json({ message: 'No encontrado' });
    const r = routines[0];
    await connection.execute(
      'INSERT INTO entrenamientos_log (usuario_id, rutina_id, fecha, duracion_min) VALUES (?, ?, CURDATE(), ?)',
      [userId, routineId, r.duracion || 0]
    );
    const racha = await calcularRacha(userId);
    res.json({ success: true, racha, message: '¡Entrenamiento registrado!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error' });
  }
});

// Ejercicios CRUD
app.post('/routines/:routineId/exercises', requireLogin, async (req, res) => {
  const { nombre, series, repeticiones, descanso, notas } = req.body;
  const { routineId } = req.params;
  try {
    const [ruts] = await connection.execute('SELECT id FROM rutinas WHERE id=? AND usuario_id=?', [routineId, req.session.user.id]);
    if (!ruts.length) return res.status(404).send('No encontrado');
    const [lastOrder] = await connection.execute('SELECT MAX(orden) as maxOrden FROM ejercicios WHERE rutina_id=?', [routineId]);
    const orden = (lastOrder[0].maxOrden || 0) + 1;
    await connection.execute(
      'INSERT INTO ejercicios (rutina_id, nombre, series, repeticiones, descanso, notas, orden) VALUES (?,?,?,?,?,?,?)',
      [routineId, nombre, parseInt(series), parseInt(repeticiones), parseInt(descanso), notas || null, orden]
    );
    res.redirect(`/routines/${routineId}`);
  } catch (error) { res.status(500).send('Error'); }
});

app.post('/routines/:routineId/exercises/:exerciseId/edit', requireLogin, async (req, res) => {
  const { nombre, series, repeticiones, descanso, notas } = req.body;
  const { routineId, exerciseId } = req.params;
  try {
    await connection.execute(
      'UPDATE ejercicios SET nombre=?, series=?, repeticiones=?, descanso=?, notas=? WHERE id=? AND rutina_id=?',
      [nombre, parseInt(series), parseInt(repeticiones), parseInt(descanso), notas || null, exerciseId, routineId]
    );
    res.redirect(`/routines/${routineId}`);
  } catch (error) { res.status(500).send('Error'); }
});

app.post('/routines/:routineId/exercises/:exerciseId/delete', requireLogin, async (req, res) => {
  const { routineId, exerciseId } = req.params;
  try {
    await connection.execute('DELETE FROM ejercicios WHERE id=? AND rutina_id=?', [exerciseId, routineId]);
    res.redirect(`/routines/${routineId}`);
  } catch (error) { res.status(500).send('Error'); }
});

// Agenda de entrenamientos
app.post('/agenda/create', requireLogin, async (req, res) => {
  const { titulo, rutina_id, fecha_programada, hora_programada, descripcion } = req.body;
  try {
    await connection.execute(
      'INSERT INTO agenda_entrenamientos (usuario_id, rutina_id, titulo, descripcion, fecha_programada, hora_programada) VALUES (?,?,?,?,?,?)',
      [req.session.user.id, rutina_id || null, titulo, descripcion || null, fecha_programada, hora_programada || '07:00:00']
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

app.get('/agenda', requireLogin, async (req, res) => {
  try {
    const [agenda] = await connection.execute(
      `SELECT a.*, r.nombre as rutina_nombre 
       FROM agenda_entrenamientos a
       LEFT JOIN rutinas r ON a.rutina_id = r.id
       WHERE a.usuario_id = ? AND a.fecha_programada >= CURDATE()
       ORDER BY a.fecha_programada ASC LIMIT 20`,
      [req.session.user.id]
    );
    res.json(agenda);
  } catch { res.json([]); }
});

//  NUTRICIÓN 

app.get('/nutrition', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    // Plan nutricional del usuario
    const [planRows] = await connection.execute(
      'SELECT * FROM plan_nutricional WHERE usuario_id = ?', [userId]
    ).catch(() => [[]]);

    // Comidas de hoy (del catálogo)
    const [comidasHoy] = await connection.execute(
      `SELECT cu.*, c.nombre, c.calorias, c.proteina_g, c.carbohidratos_g, c.grasas_g, c.tipo_comida, c.usuario_id as comida_propia
       FROM comidas_usuario cu
       JOIN comidas_catalogo c ON cu.comida_id = c.id
       WHERE cu.usuario_id = ? AND cu.fecha = CURDATE()`,
      [userId]
    ).catch(() => [[]]);

    // Resumen del día
    const resumen = {
      calorias: comidasHoy.reduce((s, c) => s + (c.calorias * c.porcion || 0), 0),
      proteina: comidasHoy.reduce((s, c) => s + (c.proteina_g * c.porcion || 0), 0),
      carbs: comidasHoy.reduce((s, c) => s + (c.carbohidratos_g * c.porcion || 0), 0),
      grasas: comidasHoy.reduce((s, c) => s + (c.grasas_g * c.porcion || 0), 0)
    };

    const plan = planRows[0] || { calorias_objetivo: 2000, proteina_g_objetivo: 150, carbohidratos_g_objetivo: 250, grasas_g_objetivo: 65 };

    // Recomendaciones según objetivo del usuario
    const [userData] = await connection.execute('SELECT objetivo FROM usuarios WHERE id = ?', [userId]).catch(() => [[]]);
    const objetivoUsuario = userData[0]?.objetivo || null;

    const [recomendaciones] = await connection.execute(
      `SELECT * FROM comidas_catalogo WHERE recomendado = 1 ${objetivoUsuario ? 'AND (objetivo = ? OR objetivo IS NULL)' : ''} LIMIT 12`,
      objetivoUsuario ? [objetivoUsuario] : []
    ).catch(() => [[]]);

    // Si no hay recomendaciones, cargar todas
    const [todasComidas] = await connection.execute(
      'SELECT * FROM comidas_catalogo ORDER BY recomendado DESC LIMIT 12'
    ).catch(() => [[]]);

    // Comidas personalizadas del usuario (para mostrar en sección separada)
    const [comidasPersonalizadas] = await connection.execute(
      'SELECT * FROM comidas_catalogo WHERE usuario_id = ? ORDER BY created_at DESC',
      [userId]
    ).catch(() => [[]]);

    res.render('nutrition', {
      title: 'Nutrición - Apolo',
      user: req.session.user,
      plan,
      resumen,
      comidasHoy,
      comidasPersonalizadas,
      recomendaciones: recomendaciones.length ? recomendaciones : todasComidas
    });
  } catch (error) {
    console.error('Error nutrición:', error);
    res.render('nutrition', {
      title: 'Nutrición - Apolo',
      user: req.session.user,
      plan: { calorias_objetivo: 2000, proteina_g_objetivo: 150, carbohidratos_g_objetivo: 250, grasas_g_objetivo: 65 },
      resumen: { calorias: 0, proteina: 0, carbs: 0, grasas: 0 },
      comidasHoy: [],
      comidasPersonalizadas: [],
      recomendaciones: []
    });
  }
});

// API: añadir comida al plan diario
app.post('/nutrition/add', requireLogin, async (req, res) => {
  const { comida_id, porcion } = req.body;
  try {
    await connection.execute(
      'INSERT INTO comidas_usuario (usuario_id, comida_id, fecha, porcion) VALUES (?,?,CURDATE(),?)',
      [req.session.user.id, comida_id, porcion || 1.0]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al añadir' });
  }
});

// API: guardar/actualizar plan nutricional
app.post('/nutrition/plan', requireLogin, async (req, res) => {
  const { calorias_objetivo, proteina_g_objetivo, carbohidratos_g_objetivo, grasas_g_objetivo } = req.body;
  try {
    await connection.execute(
      `INSERT INTO plan_nutricional (usuario_id, calorias_objetivo, proteina_g_objetivo, carbohidratos_g_objetivo, grasas_g_objetivo)
       VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE calorias_objetivo=VALUES(calorias_objetivo), proteina_g_objetivo=VALUES(proteina_g_objetivo),
       carbohidratos_g_objetivo=VALUES(carbohidratos_g_objetivo), grasas_g_objetivo=VALUES(grasas_g_objetivo)`,
      [req.session.user.id, calorias_objetivo, proteina_g_objetivo, carbohidratos_g_objetivo, grasas_g_objetivo]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// API: eliminar comida del día
app.delete('/nutrition/remove/:id', requireLogin, async (req, res) => {
  try {
    await connection.execute('DELETE FROM comidas_usuario WHERE id=? AND usuario_id=?', [req.params.id, req.session.user.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

//  Crear comida personalizada 
app.get('/nutrition/create', requireLogin, (req, res) => {
  res.render('nutrition-form', { title: 'Crear Comida - Apolo', comida: null, action: 'create', user: req.session.user });
});

app.post('/nutrition/create', requireLogin, async (req, res) => {
  const { nombre, descripcion, tipo_comida, objetivo, calorias, proteina_g, carbohidratos_g, grasas_g } = req.body;
  const userId = req.session.user.id;
  try {
    await connection.execute(
      `INSERT INTO comidas_catalogo (nombre, descripcion, tipo_comida, objetivo, calorias, proteina_g, carbohidratos_g, grasas_g, recomendado, usuario_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [nombre, descripcion || null, tipo_comida || 'Snack', objetivo || null, parseInt(calorias)||0, parseFloat(proteina_g)||0, parseFloat(carbohidratos_g)||0, parseFloat(grasas_g)||0, userId]
    );
    res.redirect('/nutrition');
  } catch (e) { console.error(e); res.status(500).send('Error al crear comida'); }
});

//  HÁBITOS 

app.get('/habits', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  try {
    // Mis hábitos de hoy
    const [misHabitos] = await connection.execute(
      `SELECT hu.id as user_habit_id, hc.nombre, hc.descripcion, hc.categoria, hc.icono, hc.color_hex, hc.frecuencia,
              hu.racha_actual, hu.racha_maxima,
              COALESCE((SELECT hr.completado FROM habitos_registros hr WHERE hr.usuario_habito_id = hu.id AND hr.fecha = CURDATE()), 0) as completado_hoy
       FROM habitos_usuario hu
       JOIN habitos_catalogo hc ON hu.habito_id = hc.id
       WHERE hu.usuario_id = ? AND hu.activo = 1
       ORDER BY completado_hoy ASC, hc.nombre ASC`,
      [userId]
    ).catch(() => [[]]);

    // Catálogo de hábitos disponibles
    const [catalogo] = await connection.execute(
      'SELECT * FROM habitos_catalogo ORDER BY recomendado DESC, nombre ASC'
    ).catch(() => [[]]);

    // IDs de hábitos ya añadidos por el usuario
    const [yaAnadidos] = await connection.execute(
      'SELECT habito_id FROM habitos_usuario WHERE usuario_id = ? AND activo = 1', [userId]
    ).catch(() => [[]]);
    const yaAnadidosSet = new Set(yaAnadidos.map(h => h.habito_id));

    // Racha máxima global del usuario
    const rachaTotal = misHabitos.length ? Math.max(...misHabitos.map(h => h.racha_actual || 0)) : 0;

    res.render('habits', {
      title: 'Hábitos - Apolo',
      user: req.session.user,
      misHabitos,
      catalogo,
      yaAnadidosSet,
      rachaTotal
    });
  } catch (error) {
    console.error('Error hábitos:', error);
    res.render('habits', { title: 'Hábitos - Apolo', user: req.session.user, misHabitos: [], catalogo: [], yaAnadidosSet: new Set(), rachaTotal: 0 });
  }
});

// API: añadir hábito al usuario
app.post('/habits/add', requireLogin, async (req, res) => {
  const { habito_id } = req.body;
  try {
    await connection.execute(
      'INSERT IGNORE INTO habitos_usuario (usuario_id, habito_id) VALUES (?,?)',
      [req.session.user.id, habito_id]
    );
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

// API: marcar/desmarcar hábito del día
app.post('/habits/toggle/:userHabitId', requireLogin, async (req, res) => {
  const { userHabitId } = req.params;
  const userId = req.session.user.id;
  const today = new Date().toISOString().split('T')[0];
  try {
    // Verificar que pertenece al usuario
    const [check] = await connection.execute(
      'SELECT id, racha_actual FROM habitos_usuario WHERE id=? AND usuario_id=?', [userHabitId, userId]
    );
    if (!check.length) return res.status(403).json({ message: 'No autorizado' });

    // Ver estado actual
    const [existing] = await connection.execute(
      'SELECT id, completado FROM habitos_registros WHERE usuario_habito_id=? AND fecha=?', [userHabitId, today]
    );

    let completado;
    if (existing.length) {
      completado = existing[0].completado ? 0 : 1;
      await connection.execute('UPDATE habitos_registros SET completado=? WHERE id=?', [completado, existing[0].id]);
    } else {
      completado = 1;
      await connection.execute('INSERT INTO habitos_registros (usuario_habito_id, fecha, completado) VALUES (?,?,1)', [userHabitId, today]);
    }

    // Recalcular racha
    const [logs] = await connection.execute(
      'SELECT fecha FROM habitos_registros WHERE usuario_habito_id=? AND completado=1 ORDER BY fecha DESC LIMIT 60',
      [userHabitId]
    );
    let racha = 0;
    let prev = new Date(today);
    prev.setHours(0, 0, 0, 0);
    for (const log of logs) {
      const d = new Date(log.fecha); d.setHours(0, 0, 0, 0);
      const diff = (prev - d) / 86400000;
      if (diff === 0 || diff === 1) { racha++; prev = d; }
      else break;
    }
    await connection.execute(
      'UPDATE habitos_usuario SET racha_actual=?, racha_maxima=GREATEST(racha_maxima,?) WHERE id=?',
      [racha, racha, userHabitId]
    );

    res.json({ success: true, completado: !!completado, racha });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

// API: eliminar hábito del usuario
app.delete('/habits/remove/:userHabitId', requireLogin, async (req, res) => {
  try {
    await connection.execute(
      'UPDATE habitos_usuario SET activo=0 WHERE id=? AND usuario_id=?',
      [req.params.userHabitId, req.session.user.id]
    );
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

// Crear hábito personalizado 
app.get('/habits/create', requireLogin, (req, res) => {
  res.render('habits-form', { title: 'Crear Hábito - Apolo', habit: null, action: 'create', user: req.session.user });
});

app.post('/habits/create', requireLogin, async (req, res) => {
  const { nombre, descripcion, categoria, frecuencia, icono, color_hex } = req.body;
  try {
    // Primero crear el hábito en el catálogo personal del usuario
    // Insertar en catálogo si no existe
    const [newHabit] = await connection.execute(
      'INSERT INTO habitos_catalogo (nombre, descripcion, categoria, frecuencia, icono, color_hex, recomendado) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [nombre, descripcion || null, categoria || 'Salud', frecuencia || 'Diario', icono || 'fa-star', color_hex || '#b8996e']
    );
    // Añadir a los hábitos del usuario
    await connection.execute(
      'INSERT INTO habitos_usuario (usuario_id, habito_id, fecha_inicio) VALUES (?, ?, CURDATE())',
      [req.session.user.id, newHabit.insertId]
    );
    res.redirect('/habits');
  } catch (e) { console.error(e); res.status(500).send('Error al crear hábito'); }
});

//  ESTADÍSTICAS (con Python) 

app.get('/stats', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  try {
    // Datos para las gráficas
    const [logs7dias] = await connection.execute(
      `SELECT DATE(fecha) as dia, COUNT(*) as total FROM entrenamientos_log 
       WHERE usuario_id=? AND fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(fecha) ORDER BY dia ASC`,
      [userId]
    ).catch(() => [[]]);

    const [habitosCategoria] = await connection.execute(
      `SELECT hc.categoria, COUNT(*) as total 
       FROM habitos_usuario hu JOIN habitos_catalogo hc ON hu.habito_id = hc.id
       WHERE hu.usuario_id = ? AND hu.activo = 1 GROUP BY hc.categoria`,
      [userId]
    ).catch(() => [[]]);

    const [pesos] = await connection.execute(
      `SELECT fecha, peso_kg FROM peso_registro WHERE usuario_id=? ORDER BY fecha ASC LIMIT 20`,
      [userId]
    ).catch(() => [[]]);

    const [calorias7dias] = await connection.execute(
      `SELECT cu.fecha, SUM(cc.calorias * cu.porcion) as total_cal
       FROM comidas_usuario cu JOIN comidas_catalogo cc ON cu.comida_id = cc.id
       WHERE cu.usuario_id=? AND cu.fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY cu.fecha ORDER BY cu.fecha ASC`,
      [userId]
    ).catch(() => [[]]);

    const [resumenTotal] = await connection.execute(
      'SELECT COUNT(*) as total_entrenamientos FROM entrenamientos_log WHERE usuario_id=?', [userId]
    ).catch(() => [[{ total_entrenamientos: 0 }]]);

    const [habitosCompletados] = await connection.execute(
      'SELECT COUNT(*) as total FROM habitos_registros hr JOIN habitos_usuario hu ON hr.usuario_habito_id = hu.id WHERE hu.usuario_id=? AND hr.completado=1',
      [userId]
    ).catch(() => [[{ total: 0 }]]);

    const racha = await calcularRacha(userId);

    // Preparar datos para Python
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const today = new Date();
    const weekValues = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = logs7dias.find(l => l.dia?.toISOString?.().split('T')[0] === dateStr || String(l.dia).split('T')[0] === dateStr);
      weekValues.push(found ? found.total : 0);
    }

    const weekDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      weekDays.push(days[d.getDay() === 0 ? 6 : d.getDay() - 1]);
    }

    // Heatmap: días activos del mes
    const [activeDays] = await connection.execute(
      `SELECT DAY(fecha) as dia FROM entrenamientos_log WHERE usuario_id=? AND MONTH(fecha)=MONTH(CURDATE()) AND YEAR(fecha)=YEAR(CURDATE())`,
      [userId]
    ).catch(() => [[]]);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    // Generar todas las gráficas en paralelo
    const [chartWeekly, chartHabits, chartWeight, chartCalories, chartStreak] = await Promise.all([
      runPython({ type: 'weekly', data: { days: weekDays, values: weekValues }, user_id: userId }),
      runPython({
        type: 'habits',
        data: {
          labels: habitosCategoria.length ? habitosCategoria.map(h => h.categoria) : ['Sin datos'],
          values: habitosCategoria.length ? habitosCategoria.map(h => h.total) : [1]
        },
        user_id: userId
      }),
      runPython({
        type: 'weight',
        data: {
          dates: pesos.map(p => String(p.fecha).split('T')[0]),
          weights: pesos.map(p => parseFloat(p.peso_kg))
        },
        user_id: userId
      }),
      runPython({
        type: 'calories',
        data: {
          days: weekDays,
          consumed: weekValues.map((_, i) => {
            const d = new Date(today); d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split('T')[0];
            const found = calorias7dias.find(c => String(c.fecha).split('T')[0] === dateStr);
            return found ? Math.round(found.total_cal) : 0;
          }),
          target: 2000
        },
        user_id: userId
      }),
      runPython({
        type: 'streak',
        data: {
          days_in_month: daysInMonth,
          completed_days: activeDays.map(d => d.dia)
        },
        user_id: userId
      })
    ]).catch(err => {
      console.error('Error generando gráficas Python:', err);
      return [
        { path: null }, { path: null }, { path: null }, { path: null }, { path: null }
      ];
    });

    res.render('stats', {
      title: 'Estadísticas - Apolo',
      user: req.session.user,
      stats: {
        totalEntrenamientos: resumenTotal[0]?.total_entrenamientos || 0,
        habitosCompletados:  habitosCompletados[0]?.total || 0,
        racha
      },
      charts: {
        weekly:   chartWeekly?.path   || null,
        habits:   chartHabits?.path   || null,
        weight:   chartWeight?.path   || null,
        calories: chartCalories?.path || null,
        streak:   chartStreak?.path   || null
      }
    });
  } catch (error) {
    console.error('Error stats:', error);
    res.render('stats', {
      title: 'Estadísticas - Apolo',
      user: req.session.user,
      stats: { totalEntrenamientos: 0, habitosCompletados: 0, racha: 0 },
      charts: { weekly: null, habits: null, weight: null, calories: null, streak: null }
    });
  }
});

// API: regenerar gráficas manualmente
app.post('/stats/refresh', requireLogin, (req, res) => {
  res.redirect('/stats');
});

//  PERFIL 

app.get('/profile', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [users] = await connection.execute('SELECT * FROM usuarios WHERE id=?', [userId]);
    const userData = users[0] || req.session.user;

    // Estadísticas del usuario
    const [totalRutinas] = await connection.execute('SELECT COUNT(*) as total FROM rutinas WHERE usuario_id=? AND es_personal=1', [userId]).catch(() => [[{ total: 0 }]]);
    const [totalEntrenamientos] = await connection.execute('SELECT COUNT(*) as total FROM entrenamientos_log WHERE usuario_id=?', [userId]).catch(() => [[{ total: 0 }]]);
    const [totalHabitos] = await connection.execute('SELECT COUNT(*) as total FROM habitos_usuario WHERE usuario_id=? AND activo=1', [userId]).catch(() => [[{ total: 0 }]]);

    // Historial de peso
    const [pesosHistorial] = await connection.execute(
      'SELECT peso_kg, fecha FROM peso_registro WHERE usuario_id=? ORDER BY fecha DESC LIMIT 10', [userId]
    ).catch(() => [[]]);

    // Rutinas del usuario
    const [misRutinas] = await connection.execute(
      'SELECT id, nombre, tipo, nivel, duracion FROM rutinas WHERE usuario_id=? AND es_personal=1 ORDER BY fecha_creacion DESC LIMIT 5', [userId]
    ).catch(() => [[]]);

    // Hábitos del usuario (del catálogo personalizado)
    const [misHabitos] = await connection.execute(
      `SELECT hu.id, hc.nombre, hc.categoria, hc.icono, hc.color_hex, hu.racha_actual
       FROM habitos_usuario hu
       JOIN habitos_catalogo hc ON hu.habito_id = hc.id
       WHERE hu.usuario_id=? AND hu.activo=1
       ORDER BY hu.racha_actual DESC LIMIT 5`, [userId]
    ).catch(() => [[]]);

    // Comidas personalizadas del usuario
    const [misComidas] = await connection.execute(
      'SELECT id, nombre, tipo_comida, calorias, proteina_g FROM comidas_catalogo WHERE usuario_id=? ORDER BY created_at DESC LIMIT 5', [userId]
    ).catch(() => [[]]);

    const racha = await calcularRacha(userId);

    // Próximos entrenamientos
    const [proximosEnts] = await connection.execute(
      `SELECT a.*, r.nombre as rutina_nombre FROM agenda_entrenamientos a
       LEFT JOIN rutinas r ON a.rutina_id = r.id
       WHERE a.usuario_id=? AND a.fecha_programada >= CURDATE() AND a.completado=0
       ORDER BY a.fecha_programada ASC LIMIT 5`,
      [userId]
    ).catch(() => [[]]);

    // Generar gráfica de peso con Python
    let weightChart = null;
    if (pesosHistorial.length > 1) {
      const result = await runPython({
        type: 'weight',
        data: {
          dates: pesosHistorial.map(p => String(p.fecha).split('T')[0]).reverse(),
          weights: pesosHistorial.map(p => parseFloat(p.peso_kg)).reverse()
        },
        user_id: userId
      }).catch(() => null);
      weightChart = result?.path || null;
    }

    res.render('profile', {
      title: 'Mi Perfil - Apolo',
      user: req.session.user,
      userData,
      stats: {
        totalRutinas: totalRutinas[0]?.total || 0,
        totalEntrenamientos: totalEntrenamientos[0]?.total || 0,
        totalHabitos: totalHabitos[0]?.total || 0,
        racha
      },
      pesosHistorial,
      misRutinas,
      misHabitos,
      misComidas,
      proximosEnts,
      weightChart
    });
  } catch (error) {
    console.error('Error perfil:', error);
    res.render('profile', {
      title: 'Mi Perfil - Apolo',
      user: req.session.user,
      userData: req.session.user,
      stats: { totalRutinas: 0, totalEntrenamientos: 0, totalHabitos: 0, racha: 0 },
      pesosHistorial: [],
      misRutinas: [],
      misHabitos: [],
      misComidas: [],
      proximosEnts: [],
      weightChart: null
    });
  }
});

// POST: actualizar perfil
app.post('/profile/update', requireLogin, async (req, res) => {
  const { nombre, edad, altura_cm, peso_kg, objetivo, bio } = req.body;
  const userId = req.session.user.id;
  try {
    await connection.execute(
      'UPDATE usuarios SET nombre=?, edad=?, altura_cm=?, peso_kg=?, objetivo=?, bio=? WHERE id=?',
      [nombre, edad || null, altura_cm || null, peso_kg || null, objetivo || null, bio || null, userId]
    );
    // Actualizar sesión
    req.session.user.nombre = nombre;
    // Si hay nuevo peso, registrarlo en historial
    if (peso_kg) {
      await connection.execute(
        'INSERT INTO peso_registro (usuario_id, peso_kg, fecha) VALUES (?,?,CURDATE()) ON DUPLICATE KEY UPDATE peso_kg=?',
        [userId, peso_kg, peso_kg]
      ).catch(() => {});
    }
    res.json({ success: true, message: 'Perfil actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al actualizar' });
  }
});

// POST: registrar peso
app.post('/profile/weight', requireLogin, async (req, res) => {
  const { peso_kg, notas } = req.body;
  try {
    await connection.execute(
      'INSERT INTO peso_registro (usuario_id, peso_kg, fecha, notas) VALUES (?,?,CURDATE(),?)',
      [req.session.user.id, peso_kg, notas || null]
    );
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

// POST: subir avatar
app.post('/profile/avatar', requireLogin, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Sin imagen' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await connection.execute('UPDATE usuarios SET avatar_url = ? WHERE id = ?', [avatarUrl, req.session.user.id]);
    // Actualizar sesión
    req.session.user.avatar_url = avatarUrl;
    res.json({ success: true, avatarUrl });
  } catch (e) { console.error(e); res.status(500).json({ success: false }); }
});

// POST: guardar enfoque del día
app.post('/dashboard/enfoque', requireLogin, async (req, res) => {
  const { enfoque } = req.body;
  try {
    await connection.execute('UPDATE usuarios SET enfoque_hoy = ? WHERE id = ?', [enfoque || null, req.session.user.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

//  DESTINO 
app.get('/destino', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Obtener rutinas personales
    const [rutinas] = await connection.execute(
      'SELECT * FROM rutinas WHERE usuario_id=? AND es_personal = 1', [userId]
    );
    
    // Obtener hábitos del usuario
    const [habitos] = await connection.execute(
      'SELECT h.*, hu.id as user_habit_id, hu.racha_actual, hu.racha_maxima FROM habitos_catalogo h INNER JOIN habitos_usuario hu ON h.id = hu.habito_id AND hu.usuario_id = ?', 
      [userId]
    );
    
    // Obtener comidas del usuario
    const [comidas] = await connection.execute(
      'SELECT c.*, cu.id as user_comida_id, cu.fecha as fecha_consumo FROM comidas_catalogo c INNER JOIN comidas_usuario cu ON c.id = cu.comida_id AND cu.usuario_id = ? GROUP BY c.id', 
      [userId]
    );
    
    res.render('destino', { rutinas, habitos, comidas });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error en el servidor');
  }
});

//  ERRORES 

app.use((req, res) => {
  res.status(404).render('404', { path: req.path });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).render('error', {
    message: 'Algo salió mal',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

//  Migraciones de BD 
async function runMigrations() {
  try {
    // Añadir columna usuario_id a comidas_catalogo si no existe
    const [cols] = await connection.execute("SHOW COLUMNS FROM comidas_catalogo LIKE 'usuario_id'");
    if (cols.length === 0) {
      await connection.execute("ALTER TABLE comidas_catalogo ADD COLUMN usuario_id INT DEFAULT NULL");
      console.log('✓ Columna usuario_id añadida a comidas_catalogo');
    }
    
    // Añadir columna es_personal a rutinas si no existe
    const [rutCols] = await connection.execute("SHOW COLUMNS FROM rutinas LIKE 'es_personal'");
    if (rutCols.length === 0) {
      await connection.execute("ALTER TABLE rutinas ADD COLUMN es_personal TINYINT(1) DEFAULT 0");
      console.log('✓ Columna es_personal añadida a rutinas');
    }
    
    console.log('✓ Migraciones completadas');
  } catch(e) {
    console.log('Migraciones:', e.message);
  }
}

// ¡ SERVIDOR 
async function startServer() {
  await runMigrations();
  
  app.listen(PORT, () => {
    console.log('');
    console.log('     ⚡⚡  APOLO  ⚡⚡     ');
    console.log(`  Servidor: http://localhost:${PORT}`);
    console.log('');
  });
}

startServer();

module.exports = app;
