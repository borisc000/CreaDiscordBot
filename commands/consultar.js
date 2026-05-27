const { SlashCommandBuilder } = require('discord.js');
const { askKimi } = require('../services/aiService');
const { getPendingTasks } = require('../services/sheetsService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('consultar')
        .setDescription('Hazle una consulta a Kimi (la IA del bot).')
        .addStringOption(option => 
            option.setName('pregunta')
                .setDescription('La pregunta o tarea que quieres que resuelva la IA.')
                .setRequired(true)),
                
    async execute(interaction) {
        const pregunta = interaction.options.getString('pregunta');
        
        // Discord requiere que respondamos en menos de 3 segundos,
        // por lo que usamos deferReply mientras esperamos a la IA.
        await interaction.deferReply();

        try {
            // Obtenemos las tareas pendientes
            const tasks = await getPendingTasks();
            
            // Las formateamos en un bloque de texto para Kimi
            let contextoTareas = "";
            if (tasks.length > 0) {
                contextoTareas = tasks.map(t => `- ID: ${t.id} | Tarea: ${t.tarea} | Responsable: ${t.responsable} | Estado: ${t.estado} | Fecha: ${t.fecha}`).join("\n");
            } else {
                contextoTareas = "Actualmente no hay tareas pendientes en el documento.";
            }

            const textoRespuesta = await askKimi(pregunta, contextoTareas);
            
            // Si la respuesta es muy larga, Discord tiene un límite de 2000 caracteres.
            let textoFinal = textoRespuesta;
            if (textoFinal.length > 1900) {
                textoFinal = textoFinal.substring(0, 1900) + '... (respuesta truncada)';
            }
            
            // Responder en Discord
            await interaction.editReply(`**Pregunta:** ${pregunta}\n\n🤖 **Gemini:**\n${textoFinal}`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('¡Ups! Hubo un problema al contactar con Gemini o se agotó la cuota. Verifica tu API Key.');
        }
    },
};
