const { appendRow, updateRow, deleteRow, addColumn, getNextId } = require('./sheetsService');
const { getIdsByName } = require('../utils/teamMapping');
const { EmbedBuilder } = require('discord.js');

/**
 * Ejecuta un arreglo de acciones JSON sobre la base de datos y envía notificaciones
 * @param {Array} acciones - Arreglo de acciones JSON (ej: [{accion: 'añadir_fila', datos: {...}}])
 * @param {Object} client - Discord Client (para enviar DMs)
 * @param {String} currentUser - Nombre de quien ejecutó la orden
 * @returns {Array} - Arreglo de strings con los resultados formateados
 */
async function executeSheetActions(acciones, client, currentUser) {
    let resultados = [];
    let usuariosANotificar = []; // Guardaremos { nombre, tareaStr }

    // Función auxiliar para registrar a quién notificar
    const registrarNotificacion = (datos) => {
        const respKey = Object.keys(datos).find(k => k.toLowerCase() === 'responsable');
        const tareaKey = Object.keys(datos).find(k => k.toLowerCase() === 'tarea');
        if (respKey && datos[respKey] && datos[respKey].trim() !== '') {
            const responsable = datos[respKey];
            if (responsable.toLowerCase() !== 'no asignado') {
                const tareaName = (tareaKey && datos[tareaKey]) ? datos[tareaKey] : 'una tarea actualizada';
                usuariosANotificar.push({ nombre: responsable, tarea: tareaName });
            }
        }
    };

    // Ejecutar las acciones en orden
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
            const idKey = Object.keys(accion.datos).find(k => k.toLowerCase() === 'id');
            if (!idKey || !accion.datos[idKey] || accion.datos[idKey] === '...' || accion.datos[idKey] === 'AUTO') {
                const nextId = await getNextId();
                accion.datos['ID'] = String(nextId);
            }
            await appendRow(accion.datos);
            registrarNotificacion(accion.datos);
            
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

    // Enviar notificaciones por DM a los responsables
    let dmLogs = [];
    if (client) {
        for (const notif of usuariosANotificar) {
            const targetIds = getIdsByName(notif.nombre);
            for (const discordId of targetIds) {
                try {
                    const user = await client.users.fetch(discordId);
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
    }
    
    dmLogs = [...new Set(dmLogs)];
    if (dmLogs.length > 0) {
        resultados.push(dmLogs.join('\n'));
    }

    return resultados;
}

module.exports = { executeSheetActions };
