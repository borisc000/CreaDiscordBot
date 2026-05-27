const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllTasks, appendRow, updateRow } = require('../services/sheetsService');
const { processActionPrompt } = require('../services/aiService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crear')
        .setDescription('Agrega o modifica tareas en el Google Sheets usando lenguaje natural')
        .addStringOption(option =>
            option.setName('instruccion')
                .setDescription('Ej: Agrega una tarea de Diseño asignada a Juan con estado Pendiente')
                .setRequired(true)
        ),
    async execute(interaction) {
        // Le decimos a Discord que estamos pensando (puede tardar un poco)
        await interaction.deferReply();

        const instruccion = interaction.options.getString('instruccion');

        try {
            // 1. Obtener el estado actual completo de la tabla (con _rowIndex)
            const todasLasTareas = await getAllTasks();

            // 2. Enviar a Gemini para convertir instrucción a JSON
            const acciones = await processActionPrompt(instruccion, todasLasTareas);

            if (!acciones || acciones.length === 0) {
                const noEntendioEmbed = new EmbedBuilder()
                    .setTitle('🤔 No entendí la instrucción')
                    .setDescription('No pude interpretar qué acción realizar. Intenta ser más específico.')
                    .setColor(0xFEE75C) // Amarillo advertencia
                    .addFields({ name: '📝 Tu instrucción', value: instruccion });
                return interaction.editReply({ embeds: [noEntendioEmbed] });
            }

            let resultados = [];

            // 3. Ejecutar las acciones
            for (const accion of acciones) {
                if (accion.accion === 'añadir_fila') {
                    await appendRow(accion.datos);
                    const datos = accion.datos;
                    resultados.push(`✅ **Fila añadida**\n> 📌 **Tarea:** ${datos.Tarea || datos.tarea || '—'}\n> 👤 **Responsable:** ${datos.Responsable || datos.responsable || '—'}\n> 🔄 **Estado:** ${datos.Estado || datos.estado || '—'}\n> 📅 **Fecha:** ${datos.Fecha || datos.fecha || '—'}`);
                } else if (accion.accion === 'modificar_fila') {
                    if (accion._rowIndex !== undefined) {
                        await updateRow(accion._rowIndex, accion.datos);
                        const cambios = Object.entries(accion.datos).map(([k, v]) => `> **${k}:** ${v}`).join('\n');
                        resultados.push(`🔄 **Fila ${accion._rowIndex + 1} actualizada**\n${cambios}`);
                    } else {
                        resultados.push(`❌ Se intentó modificar una fila pero no se encontró el índice.`);
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('📝 Cambios Aplicados al Google Sheets')
                .setColor(0x00D166) // Verde éxito
                .addFields({ name: '💬 Instrucción', value: instruccion, inline: false })
                .setDescription(resultados.join('\n\n'))
                .setFooter({ text: `Ejecutado por ${interaction.user.username} • Gemini Flash` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error en comando /crear:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error al Modificar')
                .setDescription('Hubo un problema al modificar el documento. Revisa los logs o intenta nuevamente.')
                .setColor(0xED4245);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
