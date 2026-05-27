const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responde con Pong! Útil para probar si el bot está activo.'),
    async execute(interaction) {
        await interaction.reply('¡Pong! 🏓 El bot está en línea y funcionando.');
    },
};
