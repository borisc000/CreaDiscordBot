const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('Muestra todos los comandos disponibles y cómo usarlos.'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📚 Guía de Comandos — CreaBot')
            .setDescription('Aquí tienes todos los comandos disponibles para gestionar tu proyecto desde Discord.')
            .setColor(0x5865F2) // Color Discord Blurple
            .addFields(
                {
                    name: '🏓 /ping',
                    value: 'Verifica que el bot esté activo.\n**Ejemplo:** `/ping`',
                    inline: false
                },
                {
                    name: '📋 /tareas',
                    value: 'Muestra la lista visual de tareas pendientes desde Google Sheets.\n**Ejemplo:** `/tareas`',
                    inline: false
                },
                {
                    name: '🤖 /consultar',
                    value: 'Hazle una pregunta a la IA sobre el estado del proyecto. Gemini analiza tus tareas y responde.\n**Ejemplo:** `/consultar pregunta: ¿Qué tareas tiene Pedro pendientes?`',
                    inline: false
                },
                {
                    name: '✏️ /crear',
                    value: 'Agrega o modifica tareas en el Google Sheets usando lenguaje natural.\n**Ejemplos:**\n• `/crear instruccion: Agrega una tarea de Diseño asignada a Ana con estado Pendiente`\n• `/crear instruccion: Cambia el estado de la tarea de Pedro a Completado`',
                    inline: false
                },
                {
                    name: '❓ /ayuda',
                    value: 'Muestra este mensaje de ayuda.',
                    inline: false
                }
            )
            .setFooter({ text: 'CreaBot • Potenciado por Gemini AI' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
