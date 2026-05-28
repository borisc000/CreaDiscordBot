// Diccionario duro para mapear Nombres a IDs de Discord (y viceversa)
// Esto soluciona problemas con apodos, y permite que un usuario (como Pedro) reciba DMs en múltiples cuentas.

const teamMapping = {
    'boris': ['533112424123858944'],
    'pedro': ['803340552355446804', '1100194757256425683']
};

/**
 * Dado un ID de Discord, devuelve el nombre real del usuario (ej: "Boris")
 * Si no lo encuentra, devuelve nulo.
 */
function getNameById(discordId) {
    for (const [name, ids] of Object.entries(teamMapping)) {
        if (ids.includes(discordId)) {
            // Devolver Capitalizado (ej: "boris" -> "Boris")
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
    }
    return null;
}

/**
 * Dado un nombre (ej: "Pedro" o "pedro"), devuelve el array de IDs de Discord.
 * Útil para notificarle a todas sus cuentas.
 * Si no lo encuentra, devuelve un array vacío.
 */
function getIdsByName(name) {
    if (!name) return [];
    
    // Normalizar nombre
    const normalizedName = name.trim().toLowerCase();
    
    // Buscar coincidencia exacta
    if (teamMapping[normalizedName]) {
        return teamMapping[normalizedName];
    }
    
    // Buscar coincidencia parcial (ej: si escriben "@Pedro" o "Pedro_")
    for (const [key, ids] of Object.entries(teamMapping)) {
        if (normalizedName.includes(key)) {
            return ids;
        }
    }
    
    return [];
}

module.exports = {
    teamMapping,
    getNameById,
    getIdsByName
};
