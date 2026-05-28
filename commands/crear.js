const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllTasks, appendRow, updateRow, deleteRow, addColumn, getNextId } = require('../services/sheetsService');
const { processActionPrompt } = require('../services/aiService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crear')
        .setDescription('Agrega, modifica o elimina tareas en el Google Sheets (gestión dinámica)')
        .addStringOption(option =>
            option.setName('instruccion')
                .setDescription('Ej: Crea una columna Prioridad y agrégale Prioridad Alta a Ana')
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        const instruccion = interaction.options.getString('instruccion');

        try {
            // 1. Obtener el estado actual completo (ahora incluye headers y tasks)
            const sheetData = await getAllTasks();

            // 2. Enviar a Gemini para convertir instrucción a JSON dinámico
            const acciones = await processActionPrompt(instruccion, sheetData);

            if (!acciones || acciones.length === 0) {
                const noEntendioEmbed = new EmbedBuilder()
                    .setTitle('🤔 No entendí la instrucción')
                    .setDescription('No pude interpretar qué acción realizar. Intenta ser más específico.')
                    .setColor(0xFEE75C)
                    .addFields({ name: '📝 Tu instrucción', value: instruccion });
                return interaction.editReply({ embeds: [noEntendioEmbed] });
            }

            let resultados = [];

            // 3. Ejecutar las acciones en orden
            for (const accion of acciones) {
                if (accion.accion === 'añadir_columna') {
                    await addColumn(accion.nombre);
                    resultados.push(`✨ **Nueva Columna Creada:** \`${accion.nombre}\``);
                }
                else if (accion.accion === 'eliminar_fila') {
                    if (accion._rowIndex !== undefined) {
                        await deleteRow(accion._rowIndex);
                        resultados.push(`🗑️ **Fila ${accion._rowIndex + 1} eliminada**`);
                    } else {
                        resultados.push(`❌ Se intentó eliminar una fila pero faltó el índice.`);
                    }
                }
                else if (accion.accion === 'añadir_fila') {
                    // Auto-ID: si no tiene ID o está vacío, asignar el siguiente automáticamente
                    const idKey = Object.keys(accion.datos).find(k => k.toLowerCase() === 'id');
                    if (!idKey || !accion.datos[idKey] || accion.datos[idKey] === '...' || accion.datos[idKey] === 'AUTO') {
                        const nextId = await getNextId();
                        accion.datos['ID'] = String(nextId);
                    }
                    await appendRow(accion.datos);
                    // Formatear los datos insertados dinámicamente
                    const campos = Object.entries(accion.datos)
                        .map(([k, v]) => `> **${k}:** ${v}`)
                        .join('\n');
                    resultados.push(`✅ **Fila añadida (ID auto: ${accion.datos['ID']})**\n${campos}`);
                } 
                else if (accion.accion === 'modificar_fila') {
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
                .setTitle('📝 Base de Datos Actualizada')
                .setColor(0x00D166)
                .addFields({ name: '💬 Instrucción', value: instruccion, inline: false })
                .setDescription(resultados.join('\n\n'))
                .setFooter({ text: `Gestor Automático • Potenciado por Gemini` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error en comando /crear:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error al Modificar')
                .setDescription('Hubo un problema al modificar el documento. Revisa que el bot tenga permisos y el formato sea correcto.')
                .setColor(0xED4245);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
