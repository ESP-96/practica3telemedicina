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

    supabase.from("gestores").select("id").eq("usuario", req.body.usuario).eq("password", req.body.password).then(function ({ data: id, error: err }) {
        if (err) { // No hay coincidencias 
            console.log("Usuario no encontrado", err);
            res.status(500).json("Error");
        }
        else {
            if (id.length==1){
                // Crear un token
                var contenido = { 
                    usuario: id[0].id,
                    expira: Date.now() + 60 * 60 * 1000 // expira dentro de 1 hora (en ms)
                };
                var token = jwt.encode(contenido, clave);
                
                // Devolvemos el id y el token juntos en un objeto
                res.status(200).json({ id: id[0].id, token: token });
                console.log("Gestor", id[0].id, "logeado con token");
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

    supabase.from("gestores").insert({ nombre: req.body.nombre, apellidos: req.body.apellidos, usuario: req.body.usuario, password: req.body.password }).select("id").then(function ({ data: gestor, error: err }) {
        if (err) { // Hay un gestor con el mismo usuario

            if (err.code == "23505"){
                return res.status(409).json("Error: El usuario ya existe");
            }
            console.log("Error: usuario no válido", err);
            res.status(500).json("Error");
        }
        else {
            console.log("Gestor creado con id:", gestor[0].id)
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

    // Supabase no devuelve changedRows, así que primero leemos el gestor actual para comparar
    supabase.from("gestores").select("nombre, apellidos, usuario, password").eq("id", idGestor).then(function ({ data: existe, error: err }) {
        if (err) {
            console.log("Error al actualizar:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // El gestor no existe
        if (existe.length == 0) {
            return res.status(404).json("Error, el gestor con id " + idGestor + " no existe");
        }

        var actual = existe[0];

        // Base sin el password de momento
        var datos = { nombre: req.body.nombre, apellidos: req.body.apellidos, usuario: req.body.usuario };

        // Detectamos si algún campo cambia realmente
        var cambios = String(actual.nombre) !== String(req.body.nombre) || String(actual.apellidos) !== String(req.body.apellidos) || String(actual.usuario) !== String(req.body.usuario);

        // Si la contraseña NO está vacía, la añadimos a la consulta
        if (req.body.password && req.body.password !== "") {
            datos.password = req.body.password;
            cambios = cambios || String(actual.password) !== String(req.body.password);
        }

        // No se ha modificado ningún campo
        if (!cambios) {
            return res.status(400).json("Error. Debes editar algún campo");
        }

        supabase.from("gestores").update(datos).eq("id", idGestor).then(function ({ error: err }) {
            if (err) {
                // Usuario que ya existe
                if (err.code === "23505"){
                    return res.status(409).json("Error: El usuario ya existe");
                }
                console.log("Error al actualizar:", err);
                return res.status(500).json("Error interno del servidor");
            }

            res.status(200).json("Datos modificados correctamente");
        });
    });
});


// Obtener datos del gestor tras actualizar
app.get("/api/gestores/:id", function(req, res){
    var idGestor = req.params.id;

    supabase.from("gestores").select("nombre, apellidos, usuario").eq("id", idGestor).then(function ({ data: resultados, error: err }) {
        if (err) {
            console.log("Error al consultar el gestor:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // ID no existe
        if (resultados.length === 0) {
            return res.status(404).json("Error, el gestor con id " + idGestor + " no existe");
        }
        res.status(200).json(resultados[0]);
    });
});


// Lista de categorías
app.get("/api/categorias", function(req, res){
    supabase.from("categorias").select("*").then(function({ data: resultados, error: err }) {
        if (err) {
            console.log("Error al obtener categorías:", err);
            return res.status(500).json("Error interno del servidor");
        }
        res.json(resultados);
    });
});

// Lista de modelos
app.get("/api/modelos", function(req,res){
    supabase.from("modelos").select("*").then(function({ data: resultados, error: err }) {
        if (err) {
            console.log("Error al obtener modelos:", err);
            return res.status(500).json("Error interno del servidor");
        }
        res.json(resultados);
    });
})

// Lista de ubicaciones
app.get("/api/ubicaciones", function(req,res){
    supabase.from("ubicaciones").select("*").then(function({ data: resultados, error: err }) {
        if (err) {
            console.log("Error al obtener ubicaciones:", err);
            return res.status(500).json("Error interno del servidor");
        }
        res.json(resultados);
    });
})

// PRINCIPAL
// Filtra los recursos según los parámetros
app.get("/api/recursos", function(req, res){
    var categoria = req.query.categoria;
    var modelo = req.query.modelo;
    var ubicacion = req.query.ubicacion;
    var estado = req.query.estado;

    // Unimos recursos con modelos para poder filtrar por categoría (inner join)
    var consulta = supabase.from("recursos").select("*, modelos!inner(categoria)");
    
    // Si se especifica y no es todos (-1)
    if (categoria && categoria != -1) {
        consulta = consulta.eq("modelos.categoria", categoria);
    }

    if (modelo && modelo != -1) {
        consulta = consulta.eq("modelo", modelo);

    }

    if (ubicacion && ubicacion != -1) {
        consulta = consulta.eq("ubicacion", ubicacion);
    }

    if (estado !== undefined && estado !== "" && estado != -1) {
        consulta = consulta.eq("estado", estado);
    }

    consulta.then(function ({ data: recursos, error: err }) {
        if (err) {
            console.log("Error al filtrar recursos", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        // Quitamos el campo auxiliar del join para devolver solo las columnas de recursos (como r.*)
        recursos = recursos.map(function (r) {
            delete r.modelos;
            return r;
        });
        res.json(recursos);
    });
})


//  PRINCIPAL
app.delete("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;

    supabase.from("recursos").delete().eq("id", idRecurso).select("id").then(function ({ data: result, error: err }) {
        if (err) {
            console.log("Error al eliminar el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // Comprobamos si  se eliminó algún registro
        if (result.length === 0) {
            return res.status(404).json("Error, el recurso con id " + idRecurso + " no existe");
        }

        res.status(200).json("Recurso eliminado correctamente");
    });
})

// Abrir recurso para modificarlo
app.get("/api/recursos/:id", function(req, res){
    var idRecurso = req.params.id;

    supabase.from("recursos").select("*").eq("id", idRecurso).then(function ({ data: recurso, error: err }) {
        if (err) { // No hay coincidencias 
            console.log("Error en la base de datos", err);
            res.status(500).json("Error del servidor");
        }
        else {
            if (recurso.length==0){
                return res.status(403).json("Error, el recurso no existe");
                
            }
            else{
                res.status(200).json(recurso[0]);
                console.log("Recurso",recurso[0])
            }
        }
    })
});

// RECURSOS
// Crea nuevo recurso
app.post("/api/recursos", function(req, res){

    supabase.from("recursos").insert({ modelo: req.body.modelo, ubicacion: req.body.ubicacion, numero_serie: req.body.numero_serie, estado: req.body.estado }).then(function({ error: err }) {
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

    // Supabase no devuelve changedRows, así que primero leemos el recurso actual para comparar
    supabase.from("recursos").select("modelo, ubicacion, numero_serie, estado").eq("id", idRecurso).then(function({ data: existe, error: err }) {
        if (err) {
            console.log("Error al actualizar el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // El recurso no existe
        if (existe.length === 0) {
            return res.status(404).json("Error, el recurso con id " + idRecurso + " no existe");
        }

        var actual = existe[0];

        // Detectamos si algún campo cambia realmente
        var cambios = String(actual.modelo) !== String(req.body.modelo) || String(actual.ubicacion) !== String(req.body.ubicacion) || String(actual.numero_serie) !== String(req.body.numero_serie) || String(actual.estado) !== String(req.body.estado);

        // NO se ha modificado algún campo
        if (!cambios) {
            return res.status(400).json("Error, no has modificado ningún campo");
        }

        supabase.from("recursos").update({ modelo: req.body.modelo, ubicacion: req.body.ubicacion, numero_serie: req.body.numero_serie, estado: req.body.estado }).eq("id", req.params.id).then(function({ error: err }) {
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

            res.status(200).json("Recurso modificado correctamente");
        });
    });
});


// Reservas de un recurso
app.get("/api/recursos/:id/reservas", function(req, res){
    var idRecurso = req.params.id;

    // 1. Comprobamos si el recurso existe (solo pedimos el ID para que sea más rápido)
    supabase.from("recursos").select("id").eq("id", idRecurso).then(function({ data: resultadosRecurso, error: err }) {
        if (err) {
            console.log("Error al buscar el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // El recurso no existe
        if (resultadosRecurso.length === 0) {
            return res.status(404).json("Error, recurso con id " + idRecurso + " no existe");
        }

        // 2. Como el recurso existe, buscamos todas sus reservas
        supabase.from("reservas").select("*").eq("recurso", idRecurso).then(function({ data: resultadosReservas, error: err }) {
            if (err) {
                console.log("Error al buscar las reservas:", err);
                return res.status(500).json("Error interno del servidor");
            }

            // Devolvemos la lista de reservas (si no tiene ninguna, devolverá un [])
            res.status(200).json(resultadosReservas);
        });
    });
});

// Reseñas de un recurso
app.get("/api/recursos/:id/resenyas", function(req, res){
    var idRecurso = req.params.id;

    // 1. Comprobamos si el recurso existe (solo pedimos el ID para que sea más rápido)
    supabase.from("recursos").select("id").eq("id", idRecurso).then(function({ data: resultadosRecurso, error: err }) {
        if (err) {
            console.log("Error al buscar el recurso:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // El recurso no existe
        if (resultadosRecurso.length === 0) {
            return res.status(404).json("Error, recurso con id " + idRecurso + " no existe");
        }

        // 2. Como el recurso existe, buscamos todas sus reservas
        supabase.from("resenyas").select("*").eq("recurso", idRecurso).then(function({ data: resultadosResenyas, error: err }) {
            if (err) {
                console.log("Error al buscar las reseñas:", err);
                return res.status(500).json("Error interno del servidor");
            }

            // Devolvemos la lista de reservas (si no tiene ninguna, devolverá un [])
            res.status(200).json(resultadosResenyas);
        });
    });
});

// Sanitario por id (sin password)
// Sanitario por id (sin password)
app.get("/api/sanitarios/:id", function(req, res){
    var idSanitario = req.params.id;

    // 1. Pedimos de forma explícita SOLO el nombre y los apellidos
    supabase.from("sanitarios").select("nombre, apellidos").eq("id", idSanitario).then(function ({ data: resultados, error: err }) {
        if (err) {
            console.log("Error al buscar el sanitario:", err);
            return res.status(500).json("Error interno del servidor");
        }

        // 3. Si el sanitario no existe
        if (resultados.length === 0) {
            return res.status(404).json("Error, sanitario con id " + idSanitario + " no existe");
        }

        res.status(200).json(resultados[0]);
    });
});

// Iniciar servidor --> siempre último paso
app.listen(3000, function(){
    console.log("Servidor en marcha, escuchando en el puerto 3000");
})
