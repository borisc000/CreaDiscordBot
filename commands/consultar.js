const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { askKimi } = require('../services/aiService');
const { getAllTasks } = require('../services/sheetsService');
const memory = require('../services/memoryService');
const { getNameById } = require('../utils/teamMapping');

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
        
        await interaction.deferReply();

        try {
            // Resolver identidad
            const currentUser = getNameById(interaction.user.id) || interaction.user.username;
            
            // Obtener historial de este canal
            const history = memory.getHistory(interaction.channelId);
            
            // Obtener todo el contexto dinámico del sheet
            const sheetData = await getAllTasks();
            
            const textoRespuesta = await askKimi(pregunta, sheetData, history, currentUser);
            
            // Guardar en memoria
            memory.addMessage(interaction.channelId, 'user', pregunta);
            memory.addMessage(interaction.channelId, 'assistant', textoRespuesta);
            
            // Limitar a 4096 caracteres (límite de description de embed)
            let textoFinal = textoRespuesta;
            if (textoFinal.length > 4000) {
                textoFinal = textoFinal.substring(0, 4000) + '\n\n*... (respuesta truncada)*';
            }
            
            const msgCount = memory.getMessageCount(interaction.channelId);
            const embed = new EmbedBuilder()
                .setTitle('🤖 Respuesta de Gemini')
                .setColor(0x00D166)
                .addFields({ name: '💬 Pregunta', value: pregunta, inline: false })
                .setDescription(textoFinal)
                .setFooter({ text: `${interaction.user.username} • 🧠 Memoria: ${msgCount}/20 msgs • Gemini Flash` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Hubo un problema al contactar con Gemini o se agotó la cuota. Verifica tu API Key.')
                .setColor(0xED4245);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
