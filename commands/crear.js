const { SlashCommandBuilder } = require('discord.js');
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
                return interaction.editReply("No pude entender qué acción realizar. Intenta ser más claro.");
            }

            let resultados = [];

            // 3. Ejecutar las acciones
            for (const accion of acciones) {
                if (accion.accion === 'añadir_fila') {
                    await appendRow(accion.datos);
                    resultados.push(`✅ **Fila añadida:** ${JSON.stringify(accion.datos)}`);
                } else if (accion.accion === 'modificar_fila') {
                    if (accion._rowIndex !== undefined) {
                        await updateRow(accion._rowIndex, accion.datos);
                        resultados.push(`🔄 **Fila ${accion._rowIndex + 1} actualizada:** ${JSON.stringify(accion.datos)}`);
                    } else {
                        resultados.push(`❌ **Error:** Se intentó modificar una fila pero no se encontró el índice.`);
                    }
                }
            }

            // Responder en Discord
            await interaction.editReply(`**Instrucción:** ${instruccion}\n\n${resultados.join('\\n')}`);
        } catch (error) {
            console.error('Error en comando /crear:', error);
            await interaction.editReply('¡Ups! Hubo un problema al modificar el documento. Revisa los logs o intenta nuevamente.');
        }
    },
};
