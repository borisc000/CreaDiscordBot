const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPendingTasks } = require('../services/sheetsService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tareas')
        .setDescription('Muestra la lista de tareas pendientes desde Google Sheets.'),
    async execute(interaction) {
        // Le indicamos a Discord que el bot está pensando, ya que llamar a una API puede tomar un segundo
        await interaction.deferReply();

        try {
            const tasks = await getPendingTasks();

            if (tasks.length === 0) {
                return interaction.editReply('¡Genial! No hay tareas pendientes en este momento. 🎉');
            }

            // Creamos un Embed bonito para mostrar las tareas
            const embed = new EmbedBuilder()
                .setTitle('📋 Tareas Pendientes')
                .setColor(0x0099FF)
                .setDescription('Aquí tienes la lista de trabajos activos sacada de Google Sheets:');

            tasks.forEach(task => {
                embed.addFields({ 
                    name: `[${task.id}] ${task.tarea}`, 
                    value: `👤 **Responsable:** ${task.responsable}\n🔄 **Estado:** ${task.estado}\n📅 **Fecha:** ${task.fecha}`,
                    inline: false 
                });
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en comando tareas:', error);
            await interaction.editReply('Hubo un problema al intentar leer el documento de Google Sheets. Verifica que el bot tenga acceso al documento.');
        }
    },
};
