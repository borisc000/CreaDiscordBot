require('dotenv').config();
const { OpenAI } = require('openai');

// Cliente Gemini
const geminiClient = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

async function askKimi(prompt, context = "") {
    let systemPrompt = "Eres un bot de discord que revisa tareas. Ayudas al equipo a organizarse de manera amigable.";
    if (context) {
        systemPrompt += "\n\nAquí está el estado actual de las tareas del proyecto:\n" + context + "\n\nUsa esta información para responder a la consulta del usuario de manera precisa.";
    }

    // Orden de modelos a probar (Prioridad 1, Prioridad 2, etc.)
    const modelosAProbar = ["gemini-3.5-flash", "gemini-2.5-flash"];

    for (const modelo of modelosAProbar) {
        try {
            console.log(`Intentando consultar a Gemini usando el modelo: ${modelo}...`);
            const completion = await geminiClient.chat.completions.create({
                model: modelo,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3,
            });
            return completion.choices[0].message.content;
        } catch (error) {
            console.error(`Fallo con ${modelo}:`, error.message);
            // Si es el último modelo de la lista y también falla, lanzamos el error
            if (modelo === modelosAProbar[modelosAProbar.length - 1]) {
                throw new Error("Todos los modelos de Gemini fallaron o llegaron a su límite.");
            }
            console.log(`Intentando con el siguiente modelo de respaldo...`);
        }
    }
}
async function processActionPrompt(instruccion, context) {
    const systemPrompt = `Eres un asistente que convierte instrucciones en acciones JSON para modificar una tabla.
Aquí tienes el estado actual de la tabla (las filas tienen una propiedad _rowIndex que debes usar si quieres modificar esa fila):
${JSON.stringify(context, null, 2)}

El usuario te dará una instrucción. Debes devolver UNICAMENTE un arreglo de objetos JSON con las acciones a realizar, sin markdown ni explicaciones.
Las acciones posibles son:
1. Añadir fila: { "accion": "añadir_fila", "datos": { "ID": "...", "Tarea": "...", "Responsable": "...", "Estado": "...", "Fecha": "..." } }
2. Modificar fila: { "accion": "modificar_fila", "_rowIndex": numero, "datos": { "Estado": "Completado" } }

Ejemplo de salida:
[
  { "accion": "añadir_fila", "datos": { "ID": "100", "Tarea": "Nuevo diseño", "Responsable": "Ana", "Estado": "Pendiente", "Fecha": "Hoy" } }
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
