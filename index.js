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

const cronService = require('./services/cronService');

client.once('ready', () => {
    console.log(`¡Bot iniciado exitosamente como ${client.user.tag}!`);
    
    // Iniciar tareas programadas
    cronService.initCrons(client);
});

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

client.on('interactionCreate', async interaction => {
    // Manejo de Botones del Panel
    if (interaction.isButton()) {
        if (interaction.customId === 'btn_consultar') {
            const modal = new ModalBuilder()
                .setCustomId('modal_consultar')
                .setTitle('Consultar Tareas');
            const preguntaInput = new TextInputBuilder()
                .setCustomId('pregunta')
                .setLabel('¿Qué quieres preguntarle a Gemini?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);
            const row = new ActionRowBuilder().addComponents(preguntaInput);
            modal.addComponents(row);
            await interaction.showModal(modal);
            return;
        }
        if (interaction.customId === 'btn_crear') {
            const modal = new ModalBuilder()
                .setCustomId('modal_crear')
                .setTitle('Crear o Actualizar Tarea');
            const instruccionInput = new TextInputBuilder()
                .setCustomId('instruccion')
                .setLabel('Instrucción para la base de datos')
                .setPlaceholder('Ej: Crea una columna Prioridad y agrégale Prioridad Alta a Ana')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);
            const row = new ActionRowBuilder().addComponents(instruccionInput);
            modal.addComponents(row);
            await interaction.showModal(modal);
            return;
        }
    }

    // Manejo de Envíos de Modales
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_consultar') {
            const command = interaction.client.commands.get('consultar');
            // Mapeamos el valor del modal para que simule ser un argumento de Slash Command
            interaction.options = { getString: () => interaction.fields.getTextInputValue('pregunta') };
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Hubo un error al ejecutar la consulta.', ephemeral: true });
            }
            return;
        }
        if (interaction.customId === 'modal_crear') {
            const command = interaction.client.commands.get('crear');
            // Mapeamos el valor del modal
            interaction.options = { getString: () => interaction.fields.getTextInputValue('instruccion') };
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Hubo un error al ejecutar la creación.', ephemeral: true });
            }
            return;
        }
    }

    // Si no es un Slash Command, salir
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

// ===== Respuesta a menciones (@GestorBot) con MEMORIA =====
const { askKimi } = require('./services/aiService');
const { getAllTasks } = require('./services/sheetsService');
const { EmbedBuilder } = require('discord.js');
const memory = require('./services/memoryService');
const { getNameById } = require('./utils/teamMapping');

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

    // Detectar reset de memoria
    if (memory.isResetCommand(pregunta)) {
        memory.clear(message.channelId);
        const resetEmbed = new EmbedBuilder()
            .setTitle('🧹 Memoria limpiada')
            .setDescription('Listo, olvidé toda la conversación anterior. ¡Empecemos de cero!')
            .setColor(0x5865F2);
        return message.reply({ embeds: [resetEmbed] });
    }

    try {
        // Mostrar que estamos "escribiendo..."
        await message.channel.sendTyping();
        
        // Resolver identidad
        const currentUser = getNameById(message.author.id) || message.author.username;
        
        // Obtener historial de este canal
        const history = memory.getHistory(message.channelId);
        
        const sheetData = await getAllTasks();
        const textoRespuesta = await askKimi(pregunta, sheetData, history, currentUser);
        
        // Guardar en memoria: inyectando el nombre del usuario
        memory.addMessage(message.channelId, 'user', `[${currentUser}]: ${pregunta}`);
        memory.addMessage(message.channelId, 'assistant', textoRespuesta);
        
        let textoFinal = textoRespuesta;
        if (textoFinal.length > 4000) {
            textoFinal = textoFinal.substring(0, 4000) + '\n\n*... (respuesta truncada)*';
        }
        
        const msgCount = memory.getMessageCount(message.channelId);
        const embed = new EmbedBuilder()
            .setTitle('🤖 Respuesta de Gemini')
            .setColor(0x00D166)
            .setDescription(textoFinal)
            .setFooter({ text: `${message.author.username} • 🧠 Memoria: ${msgCount}/20 msgs • Gemini Flash` })
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
const https = require('https');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot de Discord activo');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de salud escuchando en el puerto ${PORT}`);
});

// Auto-ping: el bot se llama a sí mismo cada 14 minutos para que Render no lo duerma
if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
        const url = process.env.RENDER_EXTERNAL_URL;
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            console.log(`[Keep-Alive] Ping exitoso (${res.statusCode})`);
        }).on('error', (err) => {
            console.error('[Keep-Alive] Error en ping:', err.message);
        });
    }, 14 * 60 * 1000); // Cada 14 minutos
    console.log('✅ Auto-ping activado cada 14 minutos');
} else {
    console.log('⚠️ RENDER_EXTERNAL_URL no configurada. Auto-ping desactivado (modo local).');
}
