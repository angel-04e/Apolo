/** Conexion de la BD
Usando un pool de conexiones para mejor rendimiento */

const mysql = require('mysql2');
 
const pool = mysql.createPool({
    host: 'bzdpmvzelfpsedqkg9sm-mysql.services.clever-cloud.com',
    user: 'upxzkteggytnolof',
    password: 'UsqunSfrS9owD9UJsUV8',
    database: 'bzdpmvzelfpsedqkg9sm',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
 
// Convertir pool a promesas
const connection = pool.promise();
 
// Verificar conexión
pool.getConnection((err, conn) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('Se perdió la conexión con la base de datos');
        }
        if (err.code === 'ER_CON_COUNT_ERROR') {
            console.error('La base de datos tiene demasiadas conexiones');
        }
        if (err.code === 'ECONNREFUSED') {
            console.error('La conexión fue rechazada');
        }
    } else {
        console.log('Conectado a la base de datos MySQL');
        conn.release();
    }
});
 
module.exports = connection;