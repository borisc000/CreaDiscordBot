const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const { getAllTasks } = require('./sheetsService');
const { getGoogleGenerativeAI } = require('./aiService'); // We will need to export getGoogleGenerativeAI or do a direct genai call
const { getIdsByName } = require('../utils/teamMapping');

// Exportar la configuración para que index.js la inicialice
function initCrons(client) {
    // CRON 1: Tareas atrasadas a las 10:00 AM todos los días
    cron.schedule('0 10 * * *', async () => {
        try {
            console.log('[CRON] Iniciando revisión de tareas atrasadas (10:00 AM)...');
            await checkOverdueTasks(client);
        } catch (error) {
            console.error('[CRON Error] Fallo al revisar tareas atrasadas:', error);
        }
    }, {
        timezone: "America/Santiago"
    });

    // CRON 2: Daily Standup a las 22:00 todos los días
    cron.schedule('0 22 * * *', async () => {
        try {
            console.log('[CRON] Iniciando Daily Standup (22:00 PM)...');
            await dailyStandup(client);
        } catch (error) {
            console.error('[CRON Error] Fallo en el Daily Standup:', error);
        }
    }, {
        timezone: "America/Santiago"
    });

    console.log('✅ Cron Jobs programados (10:00 AM Acosador / 22:00 PM Standup)');
}

function isTaskPending(tarea) {
    const statusKey = Object.keys(tarea).find(k => k.toLowerCase() === 'estado' || k.toLowerCase() === 'status');
    
    if (!statusKey || !tarea[statusKey]) {
        return true; // Si no tiene estado, está pendiente
    }
    
    const estado = tarea[statusKey].toString().toLowerCase().trim();
    const terminadas = ['completad', 'completa', 'listo', 'lista', 'hecho', 'hecha', 'terminad', 'cancelad', 'ok'];
    
    const isTerminada = terminadas.some(palabra => estado.includes(palabra));
    return !isTerminada;
}

async function checkOverdueTasks(client) {
    const sheetData = await getAllTasks();
    const tareasPendientes = sheetData.tasks.filter(t => isTaskPending(t));

    const hoy = new Date();
    // Normalizamos hoy a la medianoche para comparar solo fechas sin horas
    hoy.setHours(0, 0, 0, 0);

    for (const tarea of tareasPendientes) {
        if (!tarea['Fecha entrega']) continue; // Si no tiene fecha, la ignoramos

        // Parsear DD-MM-YYYY
        const partes = tarea['Fecha entrega'].split('-');
        if (partes.length !== 3) continue;

        const fechaEntrega = new Date(partes[2], partes[1] - 1, partes[0]);
        fechaEntrega.setHours(0, 0, 0, 0);

        if (hoy > fechaEntrega) {
            const diferenciaMilisegundos = hoy - fechaEntrega;
            const diasRetraso = Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
            
            await notificarRetraso(client, tarea, diasRetraso);
        }
    }
}

async function notificarRetraso(client, tarea, diasRetraso) {
    if (!tarea.Responsable) return;
    
    const discordIds = getIdsByName(tarea.Responsable);
    if (!discordIds || discordIds.length === 0) return;

    let mensaje = '';
    let color = 0xFEE75C; // Amarillo
    
    // Progresión cómica/sarcástica
    if (diasRetraso === 1 || diasRetraso === 2) {
        mensaje = `Hola. Paso a recordarte que la tarea **"${tarea.Tarea}"** venció hace ${diasRetraso} día(s). ¿Te echo una mano o te pones a trabajar hoy?`;
    } 
    else if (diasRetraso >= 3 && diasRetraso <= 5) {
        mensaje = `Aviso de **${diasRetraso} días** de retraso para la tarea **"${tarea.Tarea}"**. Esto ya está empezando a oler mal. Mueve esos dedos.`;
        color = 0xED4245; // Rojo
    }
    else if (diasRetraso === 7 || diasRetraso === 6 || diasRetraso === 8) {
        mensaje = `🎉 Feliz aniversario de **1 semana** de retraso a la tarea **"${tarea.Tarea}"**. ¿Deberíamos comprarle una tarta o pretendes terminarla algún día?`;
        color = 0x9B59B6; // Morado
    }
    else if (diasRetraso >= 14 && diasRetraso <= 20) {
        mensaje = `**Dos semanas** en el olvido. Sospecho que ya ni sabes de qué trataba la tarea **"${tarea.Tarea}"**. ¿Te busco un tutorial en YouTube de cómo trabajar?`;
        color = 0x9B59B6;
    }
    else if (diasRetraso >= 21 && diasRetraso <= 29) {
        mensaje = `Día ${diasRetraso}. ${tarea.Responsable}, ¿te das cuenta de que un huevo de gallina tarda menos en incubar que tú en avanzar con **"${tarea.Tarea}"**?`;
        color = 0x2B2D31; // Oscuro
    }
    else if (diasRetraso >= 30) {
        mensaje = `🚨 **1 MES**. Oficialmente has roto el récord de procrastinación con **"${tarea.Tarea}"**. O la terminas hoy, o avísame y la borro para dejar de sufrir viéndola en la base de datos.`;
        color = 0x000000; // Negro
    }
    else {
        return; 
    }

    for (const discordId of discordIds) {
        try {
            const user = await client.users.fetch(discordId);
            if (user) {
                const embed = new EmbedBuilder()
                    .setTitle('⏰ ¡Alerta de Tarea Vencida!')
                    .setDescription(mensaje)
                    .addFields(
                        { name: 'Categoría', value: tarea['Categoría'] || 'General', inline: true },
                        { name: 'ID Tarea', value: String(tarea.ID), inline: true }
                    )
                    .setColor(color);
                await user.send({ embeds: [embed] });
            }
        } catch (err) {
            console.error(`No se pudo enviar DM a ${tarea.Responsable} (${discordId})`, err);
        }
    }
}

async function dailyStandup(client) {
    // 1. Conseguir el primer canal de texto disponible o uno específico
    // Si tienes el ID en .env: process.env.NOTIFICATIONS_CHANNEL_ID
    // Si no, buscamos el primer canal de texto donde el bot pueda enviar mensajes.
    let targetChannel = null;
    
    // Primero, si existe la variable de entorno:
    if (process.env.NOTIFICATIONS_CHANNEL_ID) {
        targetChannel = client.channels.cache.get(process.env.NOTIFICATIONS_CHANNEL_ID);
    } 
    
    // Si no, buscar el canal 'gestion-crea' o el primero de texto
    if (!targetChannel) {
        targetChannel = client.channels.cache.find(c => c.isTextBased() && c.name === 'gestion-crea');
    }
    if (!targetChannel) {
        targetChannel = client.channels.cache.find(c => c.isTextBased() && c.permissionsFor(client.user).has('SendMessages'));
    }

    if (!targetChannel) {
        console.error('[CRON] No se encontró canal para enviar el Daily Standup.');
        return;
    }

    const sheetData = await getAllTasks();
    const tareasPendientes = sheetData.tasks.filter(t => isTaskPending(t));

    if (tareasPendientes.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('✨ Daily Standup: Resumen del Día')
            .setDescription('¡Excelente trabajo equipo! 🎉 No quedó ninguna tarea pendiente en la base de datos. Tómense el resto del día libre.')
            .setColor(0x00D166);
        await targetChannel.send({ embeds: [embed] });
        return;
    }

    const { askKimi } = require('./aiService');

    const prompt = `Eres un Project Manager divertido y algo exigente que da el cierre del día a las 10 PM.
    Revisa la siguiente lista de tareas pendientes.
    Escribe un "Daily Standup" resumiendo qué quedó pendiente.
    Menciona cuántas tareas tiene cada persona.
    Motiva al equipo para que ataquen estas tareas mañana a primera hora.
    Usa formato Markdown de Discord. Sé breve pero con personalidad.

    Lista de tareas pendientes:
    ${JSON.stringify(tareasPendientes, null, 2)}`;

    try {
        const respuesta = await askKimi(prompt, { headers: Object.keys(tareasPendientes[0] || {}), tasks: tareasPendientes });

        const embed = new EmbedBuilder()
            .setTitle('🌙 Resumen del Día (Daily Standup)')
            .setDescription(respuesta)
            .setColor(0x5865F2)
            .setFooter({ text: 'Reporte generado automáticamente por Gemini' });

        await targetChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[CRON] Error al generar el Daily Standup con Gemini:', error);
    }
}

module.exports = {
    initCrons,
    checkOverdueTasks, // Exportado para pruebas manuales
    dailyStandup // Exportado para pruebas manuales
};
