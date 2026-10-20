// Eva Soto Peral
var express = require("express");
var app = express();

// Importar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

// Configurar con URL y Public Key (anon key)
const supabaseUrl = 'https://iqsqfeyfjkzrqqvyhmmu.supabase.co';
const supabaseKey = 'sb_publishable_Ql-sVEQHpYlMbdOidUGMGQ_il127BAM'; // <--- Pega aquí tu public key
const supabase = createClient(supabaseUrl, supabaseKey);


var jwt = require('jwt-simple');
var clave = 'miSecretoMasOscuro'; // clave para codificar / decodificar el token
// Entonces la URL donde se servirá la páginas será http://localhost:3000/appCliente/index.html
app.use("/appCliente", express.static("cliente_rest")); // express.statitic(Nombre de la carpeta donde se encuentran los archivos del cliente)
app.use(express.json());

// Obtiene los datos --> variables globales
// var conexion = require("./conexion_mysql.js")

// ID ÁREA GESTOR
var idArea = 15;


// LOGIN
// Comprueba que el usuario y contraseña estén bien y devuelve el id del usuario en caso de ser correcto
// Se emplea post ya que hay datos sensibles (contraseña)
app.post("/api/gestores/login", function(req,res){
    // req.body ya que la información se pasa en el cuerpo, no en la URL porque sería inseguro
    console.log(req.body);

    var sql = "SELECT id FROM gestores WHERE usuario = '" + req.body.usuario + "' AND password = '" + req.body.password + "'";
    
    conexion.query(sql, function (err, id) {
        if (err) { // No hay coincidencias 
            console.log("Usuario no encontrado", err);
            res.status(500).json("Error");
        }
        else {
            if (id.rows.length==1){
                // Crear un token
                var contenido = { 
                    usuario: id.rows[0].id,
                    expira: Date.now() + 60 * 60 * 1000 // expira dentro de 1 hora (en ms)
                };
                var token = jwt.encode(contenido, clave);
                
                // Devolvemos el id y el token juntos en un objeto
                res.status(200).json({ id: id.rows[0].id, token: token });
                console.log("Gestor", id.rows[0].id, "logeado con token");
            }
            else{
                res.status(403).json("Credenciales inválidas");
            }
        }
    })
})


// REGISTRO
// Crea un nuevo usuario y le asigna un id
app.post("/api/gestores", function(req,res){
    console.log(req.body);

    var sql = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES('" + req.body.nombre + "','" + req.body.apellidos + "','" + req.body.usuario + "','" + req.body.password + "') RETURNING id"

    conexion.query(sql, function (err, gestor) {
        if (err) { // Hay un gestor con el mismo usuario

            if (err.code == "23505"){
                return res.status(409).json("Error: El usuario ya existe");
            }
            console.log("Error: usuario no válido", err);
            res.status(500).json("Error");
        }
        else {
            console.log("Gestor creado con id:", gestor.rows[0].id)
            res.status(201).json("Usuario creado correctamente");            
        }
    })   
})

// Antes de este use, los servicios son públicos (no necesitan token)
// Con esta función intermedia validamos el token. Si no es correcto terminamos con un error. Si es correcto continuamos.
app.use("/api", function (req, res, next) { // TODAS LAS URL QUE EMPIECEN CON /api REQUIEREN EL TOKEN

    var token = req.query.token; // obtengo el token de una query de la URL
    if (!token) { // no se ha pasado un token
        res.status(301).json("No se ha encontrado token");
        return;
    }

    // Decodificar el token
    try { 
        var contenidoToken = jwt.decode(token, clave); 
    } catch (error) {
        res.status(301).json("El token es incorrecto");
        return;
    }
    console.log("El contenido del token es:", contenidoToken);

    // Validar el token
    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) { 
        res.status(301).json("El formato del token no es adecuado")
        return;
    }

    // Comprobar la fecha de expiración
    if (contenidoToken.expira < Date.now()) {
        res.status(301).json("El token ha expirado");
        return
    }
    // Todo ha ido bien. con next hago que express continue con el procesado
    next();
});


// REGISTRO
// Modifica los datos de un gestor
app.put("/api/gestores/:id", function(req, res){
    console.log(req.body);
    var idGestor = req.params.id;

    // Base sin el password de momento
    var sql = "UPDATE gestores SET nombre = '" + req.body.nombre + "', apellidos = '" + req.body.apellidos + "', usuario = '" + req.body.usuario + "'";

    // Condición para detectar si algún campo cambia realmente (PostgreSQL no tiene changedRows)
    var cambios = "nombre IS DISTINCT FROM '" + req.body.nombre + "' OR apellidos IS DISTINCT FROM '" + req.body.apellidos + "' OR usuario IS DISTINCT FROM '" + req.body.usuario + "'";

    // Si la contraseña NO está vacía, la añadimos a la consulta
    if (req.body.password && req.body.password !== "") {
        sql += ", password = '" + req.body.password + "'";
        cambios += " OR password IS DISTINCT FROM '" + req.body.password + "'";
    }

    // Condición WHERE al final
    sql += " WHERE id = '" + idGestor +"' AND (" + cambios + ")";

    conexion.query(sql, function (err, result) {
        if (err) {
            // Usuario que ya existe
            if (err.code === "23505"){
                return res.status(409).json("Error: El usuario ya existe");
            }
            console.log("Error al actualizar:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // result.rowCount --> cuántas filas se han modificado
        if (result.rowCount == 0) {
            // Distinguimos entre "no existe" y "no ha cambiado ningún campo"
            conexion.query("SELECT id FROM gestores WHERE id = '" + idGestor + "'", function (err, existe) {
                if (err) {
                    console.log("Error al actualizar:", err);
                    return res.status(500).json("Error interno del servidor");
                }

                if (existe.rows.length == 0) {
                    return res.status(404).json("Error, el gestor con id " + idGestor + " no existe");
                }

                return res.status(400).json("Error. Debes editar algún campo");
            });
            return;
        }

        res.status(200).json("Datos modificados correctamente");
    });
});


// Obtener datos del gestor tras actualizar
app.get("/api/gestores/:id", function(req, res){
    var idGestor = req.params.id;
    var sql = "SELECT nombre, apellidos, usuario FROM gestores WHERE id = '" + idGestor + "'";

    conexion.query(sql, function (err, resultados) {
        if (err) {
            console.log("Error al consultar el gestor:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // ID no existe
        if (resultados.rows.length === 0) {
            return res.status(404).json("Error, el gestor con id " + idGestor + " no existe");
        }
        res.status(200).json(resultados.rows[0]);
    });
});


// Lista de categorías
app.get("/api/categorias", function(req, res){
    var sql = "SELECT * FROM categorias"; 
    
    conexion.query(sql, function(err, resultados) {
        if (err) {
            console.log("Error al obtener categorías:", err);
            return res.status(500).json("Error interno del servidor");
        }
        res.json(resultados.rows);
    });
});

// Lista de modelos
app.get("/api/modelos", function(req,res){
    var sql = "SELECT * FROM modelos"; 
    
    conexion.query(sql, function(err, resultados) {
        if (err) {
            console.log("Error al obtener modelos:", err);
            return res.status(500).json("Error interno del servidor");
        }
        res.json(resultados.rows);
    });
})

// Lista de ubicaciones
app.get("/api/ubicaciones", function(req,res){
    var sql = "SELECT * FROM ubicaciones"; 
    
    conexion.query(sql, function(err, resultados) {
        if (err) {
            console.log("Error al obtener ubicaciones:", err);
            return res.status(500).json("Error interno del servidor");
        }
        res.json(resultados.rows);
    });
})

// PRINCIPAL
// Filtra los recursos según los parámetros
app.get("/api/recursos", function(req, res){
    var categoria = req.query.categoria;
    var modelo = req.query.modelo;
    var ubicacion = req.query.ubicacion;
    var estado = req.query.estado;

    // Unimos recursos con modelos para poder filtrar por categoría
    var sql = "SELECT r.* FROM recursos r JOIN modelos m ON r.modelo = m.id WHERE 1=1";
    
    // Si se especifica y no es todos (-1)
    if (categoria && categoria != -1) {
        sql += " AND m.categoria = '" + categoria + "'";
    }

    if (modelo && modelo != -1) {
        sql += " AND r.modelo = '" + modelo + "'";

    }

    if (ubicacion && ubicacion != -1) {
        sql += " AND r.ubicacion = '" + ubicacion + "'";
    }

    if (estado !== undefined && estado !== "" && estado != -1) {
        sql += " AND r.estado = '" + estado + "'";
    }

    conexion.query(sql, function (err, recursos) {
        if (err) {
            console.log("Error al filtrar recursos", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        res.json(recursos.rows);
    });
})


//  PRINCIPAL
app.delete("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;

    var sql = "DELETE FROM recursos WHERE id = '" + idRecurso + "'";

    conexion.query(sql, function (err, result) {
        if (err) {
            console.log("Error al eliminar el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // Comprobamos si  se eliminó algún registro
        if (result.rowCount === 0) {
            return res.status(404).json("Error, el recurso con id " + idRecurso + " no existe");
        }

        res.status(200).json("Recurso eliminado correctamente");
    });
})

// Abrir recurso para modificarlo
app.get("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;

    var sql = "SELECT * FROM recursos WHERE id = '" + idRecurso + "'";

    conexion.query(sql, function (err, recurso) {
        if (err) { // No hay coincidencias 
            console.log("Error en la base de datos", err);
            res.status(500).json("Error del servidor");
        }
        else {
            if (recurso.rows.length==0){
                return res.status(403).json("Error, el recurso no existe");
                
            }
            else{
                res.status(200).json(recurso.rows[0]);
                console.log("Recurso",recurso.rows[0])
            }
        }
    })
});

// RECURSOS
// Crea nuevo recurso
app.post("/api/recursos", function(req, res){

    var sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES('" + req.body.modelo + "','" + req.body.ubicacion + "','" + req.body.numero_serie + "','" + req.body.estado + "')";

    conexion.query(sql, function(err, result) {
        if (err) {
            // Validación del número de serie
            if (err.code === "23505") {
                return res.status(409).json("Error: Ya existe un recurso con ese número de serie");
            }
            
            // Validación del modelo
            if (err.code === "23503") {
                return res.status(400).json("Error: El modelo o la ubicación seleccionada no existen");
            }
            
            console.log("Error al crear el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }

        res.status(201).json("Recurso creado correctamente");
    });
});

// RECURSOS
// Modifica recurso existente
app.put("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;

    // Condición para detectar si algún campo cambia realmente (PostgreSQL no tiene changedRows)
    var cambios = "modelo IS DISTINCT FROM '" + req.body.modelo + "' OR ubicacion IS DISTINCT FROM '" + req.body.ubicacion + "' OR numero_serie IS DISTINCT FROM '" + req.body.numero_serie + "' OR estado IS DISTINCT FROM '" + req.body.estado + "'";

    var sql = "UPDATE recursos SET modelo = '" + req.body.modelo + "', ubicacion = '" + req.body.ubicacion + "', numero_serie = '" + req.body.numero_serie + "', estado = '" + req.body.estado + "' WHERE id = '" + req.params.id + "' AND (" + cambios + ")";

    conexion.query(sql, function(err, result) {
        if (err) {
            // Validación de número de serie duplicado
            if (err.code === "23505") {
                return res.status(409).json("Error: Ya existe otro recurso con ese número de serie");
            }
            
            // Validación de si el modelo o ubicación existen
            if (err.code === "23503") {
                return res.status(400).json("Error: El modelo o la ubicación seleccionada no existen");
            }
            
            console.log("Error al actualizar el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // Sin cambios o recurso inexistente
        if (result.rowCount === 0) {
            // Distinguimos entre "no existe" y "no ha cambiado ningún campo"
            conexion.query("SELECT id FROM recursos WHERE id = '" + idRecurso + "'", function(err, existe) {
                if (err) {
                    console.log("Error al actualizar el recurso:", err);
                    return res.status(500).json("Error interno del servidor");
                }

                if (existe.rows.length === 0) {
                    return res.status(404).json("Error, el recurso con id " + idRecurso + " no existe");
                }

                // NO se ha modificado algún campo
                return res.status(400).json("Error, no has modificado ningún campo");
            });
            return;
        }

        res.status(200).json("Recurso modificado correctamente");
    });
});


// Reservas de un recurso
app.get("/api/recursos/:id/reservas", function(req, res){
    var idRecurso = req.params.id;

    // 1. Comprobamos si el recurso existe (solo pedimos el ID para que sea más rápido)
    var sqlRecurso = "SELECT id FROM recursos WHERE id = '" + idRecurso + "'";
    
    conexion.query(sqlRecurso, function(err, resultadosRecurso) {
        if (err) {
            console.log("Error al buscar el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // El recurso no existe
        if (resultadosRecurso.rows.length === 0) {
            return res.status(404).json("Error, recurso con id " + idRecurso + " no existe");
        }

        // 2. Como el recurso existe, buscamos todas sus reservas
        var sqlReservas = "SELECT * FROM reservas WHERE recurso = '" + idRecurso + "'";
        
        conexion.query(sqlReservas, function(err, resultadosReservas) {
            if (err) {
                console.log("Error al buscar las reservas:", err);
                return res.status(500).json("Error interno del servidor");
            }

            // Devolvemos la lista de reservas (si no tiene ninguna, devolverá un [])
            res.status(200).json(resultadosReservas.rows);
        });
    });
});

// Reseñas de un recurso
app.get("/api/recursos/:id/resenyas", function(req, res){
    var idRecurso = req.params.id;

    // 1. Comprobamos si el recurso existe (solo pedimos el ID para que sea más rápido)
    var sqlRecurso = "SELECT id FROM recursos WHERE id = '" + idRecurso + "'";
    
    conexion.query(sqlRecurso, function(err, resultadosRecurso) {
        if (err) {
            console.log("Error al buscar el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // El recurso no existe
        if (resultadosRecurso.rows.length === 0) {
            return res.status(404).json("Error, recurso con id " + idRecurso + " no existe");
        }

        // 2. Como el recurso existe, buscamos todas sus reservas
        var sqlResenyas = "SELECT * FROM resenyas WHERE recurso = '" + idRecurso + "'";
        
        conexion.query(sqlResenyas, function(err, resultadosResenyas) {
            if (err) {
                console.log("Error al buscar las reseñas:", err);
                return res.status(500).json("Error interno del servidor");
            }

            // Devolvemos la lista de reservas (si no tiene ninguna, devolverá un [])
            res.status(200).json(resultadosResenyas.rows);
        });
    });
});

// Sanitario por id (sin password)
// Sanitario por id (sin password)
app.get("/api/sanitarios/:id", function(req, res){
    var idSanitario = req.params.id;

    // 1. Pedimos de forma explícita SOLO el nombre y los apellidos
    const sql = "SELECT nombre, apellidos FROM sanitarios WHERE id = '" + idSanitario + "'";

    conexion.query(sql, function (err, resultados) {
        if (err) {
            console.log("Error al buscar el sanitario:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // 3. Si el sanitario no existe
        if (resultados.rows.length === 0) {
            return res.status(404).json("Error, sanitario con id " + idSanitario + " no existe");
        }

        res.status(200).json(resultados.rows[0]);
    });
});

// Iniciar servidor --> siempre último paso
app.listen(3000, function(){
    console.log("Servidor en marcha, escuchando en el puerto 3000");
})
