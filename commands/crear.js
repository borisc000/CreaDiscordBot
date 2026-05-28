const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllTasks, appendRow, updateRow, deleteRow, addColumn, getNextId } = require('../services/sheetsService');
const { processActionPrompt } = require('../services/aiService');
const { getNameById, getIdsByName } = require('../utils/teamMapping');

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
            // Resolver identidad
            const currentUser = getNameById(interaction.user.id) || interaction.user.username;

            // 1. Obtener el estado actual completo
            const sheetData = await getAllTasks();

            // 2. Enviar a Gemini para convertir instrucción a JSON dinámico
            const acciones = await processActionPrompt(instruccion, sheetData, currentUser);

            if (!acciones || acciones.length === 0) {
                const noEntendioEmbed = new EmbedBuilder()
                    .setTitle('🤔 No entendí la instrucción')
                    .setDescription('No pude interpretar qué acción realizar. Intenta ser más específico.')
                    .setColor(0xFEE75C)
                    .addFields({ name: '📝 Tu instrucción', value: instruccion });
                return interaction.editReply({ embeds: [noEntendioEmbed] });
            }

            let resultados = [];
            let usuariosANotificar = []; // Guardaremos { nombre, tareaStr }

            // Función auxiliar para registrar a quién notificar
            const registrarNotificacion = (datos) => {
                const respKey = Object.keys(datos).find(k => k.toLowerCase() === 'responsable');
                const tareaKey = Object.keys(datos).find(k => k.toLowerCase() === 'tarea');
                if (respKey && datos[respKey] && datos[respKey].trim() !== '') {
                    const responsable = datos[respKey];
                    // Evitar notificar "No asignado" o similar
                    if (responsable.toLowerCase() !== 'no asignado') {
                        const tareaName = (tareaKey && datos[tareaKey]) ? datos[tareaKey] : 'una tarea actualizada';
                        usuariosANotificar.push({ nombre: responsable, tarea: tareaName });
                    }
                }
            };

            // 3. Ejecutar las acciones en orden
            for (const accion of acciones) {
                if (accion.accion === 'añadir_columna') {
                    await addColumn(accion.nombre);
                    resultados.push(`✨ **Nueva Columna Creada:** \`${accion.nombre}\``);
                }
                else if (accion.accion === 'eliminar_fila') {
                    if (accion.id !== undefined) {
                        await deleteRow(accion.id);
                        resultados.push(`🗑️ **Tarea con ID ${accion.id} eliminada**`);
                    } else {
                        resultados.push(`❌ Se intentó eliminar una tarea pero faltó el ID.`);
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
                    registrarNotificacion(accion.datos);
                    
                    // Formatear los datos insertados dinámicamente
                    const campos = Object.entries(accion.datos)
                        .map(([k, v]) => `> **${k}:** ${v}`)
                        .join('\n');
                    resultados.push(`✅ **Fila añadida (ID auto: ${accion.datos['ID']})**\n${campos}`);
                } 
                else if (accion.accion === 'modificar_fila') {
                    if (accion.id !== undefined) {
                        await updateRow(accion.id, accion.datos);
                        registrarNotificacion(accion.datos);
                        
                        const cambios = Object.entries(accion.datos).map(([k, v]) => `> **${k}:** ${v}`).join('\n');
                        resultados.push(`🔄 **Tarea con ID ${accion.id} actualizada**\n${cambios}`);
                    } else {
                        resultados.push(`❌ Se intentó modificar una tarea pero no se encontró el ID.`);
                    }
                }
            }

            // 4. Enviar notificaciones por DM a los responsables
            let dmLogs = [];
            for (const notif of usuariosANotificar) {
                const targetIds = getIdsByName(notif.nombre);
                for (const discordId of targetIds) {
                    try {
                        const user = await interaction.client.users.fetch(discordId);
                        if (user) {
                            const dmEmbed = new EmbedBuilder()
                                .setTitle('📌 Nueva Asignación de Tarea')
                                .setDescription(`¡Hola! **${currentUser}** te ha asignado o actualizado una tarea en el proyecto.`)
                                .addFields({ name: 'Tarea', value: notif.tarea })
                                .setColor(0x5865F2);
                            await user.send({ embeds: [dmEmbed] });
                            dmLogs.push(`📩 DM enviado a ${notif.nombre}`);
                        }
                    } catch (err) {
                        console.error(`No se pudo enviar DM al usuario con ID ${discordId}:`, err.message);
                    }
                }
            }
            
            // Eliminar duplicados de los logs de DM (por si notificamos a múltiples cuentas de la misma persona)
            dmLogs = [...new Set(dmLogs)];
            if (dmLogs.length > 0) {
                resultados.push(dmLogs.join('\n'));
            }

            const embed = new EmbedBuilder()
                .setTitle('📝 Base de Datos Actualizada')
                .setColor(0x00D166)
                .addFields({ name: '💬 Instrucción', value: instruccion, inline: false })
                .setDescription(resultados.join('\n\n'))
                .setFooter({ text: `Por ${currentUser} • Gestor Automático` })
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
