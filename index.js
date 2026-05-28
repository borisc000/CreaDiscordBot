require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Crear una nueva instancia de cliente
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ] 
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

// Si no existe la carpeta, la creamos para evitar errores
if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath);
}

// Cargar los archivos de comandos (aún no hemos creado ninguno, lo haremos después)
const commandFiles = fs.existsSync(commandsPath) ? fs.readdirSync(commandsPath).filter(file => file.endsWith('.js')) : [];
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

client.once('ready', () => {
    console.log(`¡Bot iniciado exitosamente como ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No se encontró el comando ${interaction.commandName}.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

// ===== Respuesta a menciones (@GestorBot) =====
const { askKimi } = require('./services/aiService');
const { getAllTasks } = require('./services/sheetsService');
const { EmbedBuilder } = require('discord.js');

client.on('messageCreate', async message => {
    // Ignorar mensajes de bots (incluyéndose a sí mismo)
    if (message.author.bot) return;
    
    // Solo responder si mencionan al bot
    if (!message.mentions.has(client.user)) return;
    
    // Extraer el texto limpio (quitar la mención del bot)
    const pregunta = message.content
        .replace(/<@!?\d+>/g, '')  // Quitar todas las menciones
        .trim();
    
    if (!pregunta) {
        const ayudaEmbed = new EmbedBuilder()
            .setTitle('👋 ¡Hola! Soy GestorBot')
            .setDescription('Puedes hacerme preguntas directamente mencionándome.\n\n**Ejemplo:** `@GestorBot ¿cómo van las tareas de Pedro?`\n\nO usa `/ayuda` para ver todos mis comandos.')
            .setColor(0x5865F2);
        return message.reply({ embeds: [ayudaEmbed] });
    }

    try {
        // Mostrar que estamos "escribiendo..."
        await message.channel.sendTyping();
        
        const sheetData = await getAllTasks();
        const textoRespuesta = await askKimi(pregunta, sheetData);
        
        let textoFinal = textoRespuesta;
        if (textoFinal.length > 4000) {
            textoFinal = textoFinal.substring(0, 4000) + '\n\n*... (respuesta truncada)*';
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🤖 Respuesta de Gemini')
            .setColor(0x00D166)
            .setDescription(textoFinal)
            .setFooter({ text: `Preguntado por ${message.author.username} • Gemini Flash` })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error en mención:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription('Hubo un problema al procesar tu mensaje. Intenta de nuevo.')
            .setColor(0xED4245);
        await message.reply({ embeds: [errorEmbed] });
    }
});

// Mini servidor HTTP para que Render lo reconozca como Web Service (tier gratuito)
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot de Discord activo');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de salud escuchando en el puerto ${PORT}`);
});
