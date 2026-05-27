const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { askKimi } = require('../services/aiService');
const { getPendingTasks } = require('../services/sheetsService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('consultar')
        .setDescription('Hazle una consulta a Gemini (la IA del bot).')
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
            
            // Las formateamos en un bloque de texto para Gemini
            let contextoTareas = "";
            if (tasks.length > 0) {
                contextoTareas = tasks.map(t => `- ID: ${t.id} | Tarea: ${t.tarea} | Responsable: ${t.responsable} | Estado: ${t.estado} | Fecha: ${t.fecha}`).join("\n");
            } else {
                contextoTareas = "Actualmente no hay tareas pendientes en el documento.";
            }

            const textoRespuesta = await askKimi(pregunta, contextoTareas);
            
            // Limitar a 4096 caracteres (límite de description de embed)
            let textoFinal = textoRespuesta;
            if (textoFinal.length > 4000) {
                textoFinal = textoFinal.substring(0, 4000) + '\n\n*... (respuesta truncada)*';
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🤖 Respuesta de Gemini')
                .setColor(0x00D166) // Verde éxito
                .addFields({ name: '💬 Pregunta', value: pregunta, inline: false })
                .setDescription(textoFinal)
                .setFooter({ text: `Solicitado por ${interaction.user.username} • Gemini Flash` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Hubo un problema al contactar con Gemini o se agotó la cuota. Verifica tu API Key.')
                .setColor(0xED4245); // Rojo error
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
