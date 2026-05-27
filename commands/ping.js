const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responde con Pong! Útil para probar si el bot está activo.'),
    async execute(interaction) {
        const latencia = Date.now() - interaction.createdTimestamp;
        const embed = new EmbedBuilder()
            .setTitle('🏓 ¡Pong!')
            .setColor(0x5865F2)
            .addFields(
                { name: '⏱️ Latencia', value: `${latencia}ms`, inline: true },
                { name: '📡 Estado', value: '🟢 En línea', inline: true }
            )
            .setFooter({ text: 'CreaBot • Potenciado por Gemini AI' })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },
};
