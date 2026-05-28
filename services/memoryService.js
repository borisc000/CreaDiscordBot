/**
 * Servicio de Memoria Conversacional (Híbrido)
 * - Últimos 20 mensajes por canal (ventana deslizante)
 * - TTL de 2 horas de inactividad
 * - Reset manual con "olvida todo"
 */

const MAX_MESSAGES = 20;         // Máximo de mensajes por conversación
const TTL_MS = 2 * 60 * 60 * 1000; // 2 horas en milisegundos
const CLEANUP_INTERVAL = 10 * 60 * 1000; // Limpiar cada 10 minutos

// Map: channelId → { messages: [{role, content}], lastActivity: timestamp }
const conversations = new Map();

/**
 * Agrega un mensaje al historial de un canal
 */
function addMessage(channelId, role, content) {
    if (!conversations.has(channelId)) {
        conversations.set(channelId, { messages: [], lastActivity: Date.now() });
    }

    const convo = conversations.get(channelId);
    convo.messages.push({ role, content });
    convo.lastActivity = Date.now();

    // Ventana deslizante: si hay más de MAX_MESSAGES, quitar los más viejos
    if (convo.messages.length > MAX_MESSAGES) {
        convo.messages = convo.messages.slice(-MAX_MESSAGES);
    }
}

/**
 * Obtiene el historial de un canal (array de {role, content})
 */
function getHistory(channelId) {
    if (!conversations.has(channelId)) return [];
    
    const convo = conversations.get(channelId);
    convo.lastActivity = Date.now(); // Refrescar TTL al leer
    return convo.messages;
}

/**
 * Limpia la memoria de un canal específico
 */
function clear(channelId) {
    conversations.delete(channelId);
}

/**
 * Devuelve cuántos mensajes hay en memoria para un canal
 */
function getMessageCount(channelId) {
    if (!conversations.has(channelId)) return 0;
    return conversations.get(channelId).messages.length;
}

/**
 * Detecta si el usuario quiere resetear la memoria
 */
function isResetCommand(text) {
    const lower = text.toLowerCase().trim();
    const triggers = ['olvida todo', 'olvidalo todo', 'reset', 'limpia memoria', 'borra memoria', 'nueva conversación', 'nueva conversacion'];
    return triggers.some(t => lower.includes(t));
}

/**
 * Limpieza automática de conversaciones inactivas (TTL)
 */
function startCleanupTimer() {
    setInterval(() => {
        const now = Date.now();
        let cleaned = 0;
        for (const [channelId, convo] of conversations) {
            if (now - convo.lastActivity > TTL_MS) {
                conversations.delete(channelId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[Memoria] Limpieza automática: ${cleaned} conversación(es) expirada(s).`);
        }
    }, CLEANUP_INTERVAL);
}

// Iniciar el timer de limpieza
startCleanupTimer();

module.exports = {
    addMessage,
    getHistory,
    clear,
    getMessageCount,
    isResetCommand
};
