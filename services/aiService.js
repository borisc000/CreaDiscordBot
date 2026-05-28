require('dotenv').config();
const { OpenAI } = require('openai');

// Cliente Gemini
const geminiClient = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

async function askKimi(prompt, context = {}, history = []) {
    let systemPrompt = "Eres un bot de discord que revisa tareas. Ayudas al equipo a organizarse de manera amigable. Tienes memoria de la conversación reciente, úsala para entender referencias como 'la primera', 'esa tarea', 'cámbiala', etc.";
    
    // Ahora context contiene { headers, tasks }
    if (context && context.headers && context.tasks) {
        systemPrompt += "\n\nAquí están las columnas actuales del documento: " + context.headers.join(', ');
        systemPrompt += "\nY aquí está el estado actual de las tareas del proyecto:\n" + JSON.stringify(context.tasks, null, 2);
        systemPrompt += "\n\nUsa esta información para responder a la consulta del usuario de manera precisa. Si te preguntan por tareas completadas, búscalas. Tienes la visión total del proyecto.";
    }

    // Construir el array de mensajes: system + historial previo + mensaje actual
    const messages = [
        { role: "system", content: systemPrompt },
        ...history,  // Mensajes anteriores de la conversación
        { role: "user", content: prompt }
    ];

    const modelosAProbar = ["gemini-3.5-flash", "gemini-2.5-flash"];

    for (const modelo of modelosAProbar) {
        try {
            console.log(`Intentando consultar a Gemini usando el modelo: ${modelo}... (historial: ${history.length} msgs)`);
            const completion = await geminiClient.chat.completions.create({
                model: modelo,
                messages,
                temperature: 0.3,
            });
            return completion.choices[0].message.content;
        } catch (error) {
            console.error(`Fallo con ${modelo}:`, error.message);
            if (modelo === modelosAProbar[modelosAProbar.length - 1]) {
                throw new Error("Todos los modelos de Gemini fallaron o llegaron a su límite.");
            }
            console.log(`Intentando con el siguiente modelo de respaldo...`);
        }
    }
}

async function processActionPrompt(instruccion, context) {
    // context ahora contiene { headers, tasks }
    const systemPrompt = `Eres un asistente que convierte instrucciones en acciones JSON para gestionar una base de datos dinámica.
Columnas actuales de la base de datos: ${context.headers ? context.headers.join(', ') : 'Desconocidas'}

Estado actual de las filas (cada fila tiene un '_rowIndex' que DEBES usar para referenciarla si quieres modificarla o eliminarla):
${JSON.stringify(context.tasks || context, null, 2)}

El usuario te dará una instrucción. Debes devolver UNICAMENTE un arreglo de objetos JSON con las acciones a realizar, sin markdown ni explicaciones.
Si el usuario pide guardar información que no encaja en las columnas actuales, DEBES usar primero la acción 'añadir_columna' para crearla y luego añadir o modificar la fila.

Las acciones posibles son:
1. Añadir fila: { "accion": "añadir_fila", "datos": { "ID": "...", "Tarea": "...", "Responsable": "..." } } (Usa las columnas actuales)
2. Modificar fila: { "accion": "modificar_fila", "_rowIndex": numero, "datos": { "Estado": "Completado" } }
3. Eliminar fila: { "accion": "eliminar_fila", "_rowIndex": numero }
4. Añadir columna: { "accion": "añadir_columna", "nombre": "Prioridad" }

Ejemplo de salida (el usuario pide agregar 'Prioridad Alta' a una tarea, pero la columna Prioridad no existe):
[
  { "accion": "añadir_columna", "nombre": "Prioridad" },
  { "accion": "modificar_fila", "_rowIndex": 0, "datos": { "Prioridad": "Alta" } }
]

Ejemplo 2 (el usuario dice 'Borra la tarea 5 y agrega una de limpiar'):
[
  { "accion": "eliminar_fila", "_rowIndex": 5 },
  { "accion": "añadir_fila", "datos": { "Tarea": "Limpiar base de datos", "Estado": "Pendiente" } }
]`;

    const modelosAProbar = ["gemini-3.5-flash", "gemini-2.5-flash"];

    for (const modelo of modelosAProbar) {
        try {
            const completion = await geminiClient.chat.completions.create({
                model: modelo,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: instruccion }
                ],
                temperature: 0.1, // Baja temperatura para JSON predecible
            });
            const text = completion.choices[0].message.content.trim();
            // Limpiar posibles bloques de código de markdown
            const jsonText = text.replace(/^```json\s*/, '').replace(/```$/, '');
            return JSON.parse(jsonText);
        } catch (error) {
            console.error(`Fallo parseo con ${modelo}:`, error.message);
            if (modelo === modelosAProbar[modelosAProbar.length - 1]) {
                throw new Error("No se pudo procesar la acción.");
            }
        }
    }
}

module.exports = { askKimi, processActionPrompt };
