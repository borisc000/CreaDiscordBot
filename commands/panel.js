const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Despliega el panel de control permanente de GestorBot'),
        
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎛️ Panel de Control - GestorBot')
            .setDescription('Usa los botones de abajo para gestionar la base de datos de tareas. El bot utilizará la IA de Gemini para entender tus instrucciones en lenguaje natural.')
            .setColor(0x5865F2)
            .setThumbnail(interaction.client.user.displayAvatarURL());

        const btnConsultar = new ButtonBuilder()
            .setCustomId('btn_consultar')
            .setLabel('Consultar Tareas')
            .setEmoji('🤖')
            .setStyle(ButtonStyle.Secondary);

        const btnCrear = new ButtonBuilder()
            .setCustomId('btn_crear')
            .setLabel('Crear/Actualizar')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(btnConsultar, btnCrear);

        // Enviamos el mensaje al canal. No usamos deferReply para poder responder el mensaje
        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
