require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Asegurar que los saltos de línea se procesen bien
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);

async function getPendingTasks() {
    try {
        await doc.loadInfo(); // Carga las propiedades del documento
        const sheet = doc.sheetsByIndex[0]; // Seleccionamos la primera hoja
        
        const rows = await sheet.getRows(); // Obtiene todas las filas
        
        if (rows.length === 0) {
            return [];
        }

        // Mapeamos las filas a un array de objetos limpios
        const tasks = rows.map(row => {
            return {
                id: row.get('ID') || 'N/A',
                tarea: row.get('Tarea') || 'Sin nombre',
                responsable: row.get('Responsable') || 'No asignado',
                estado: row.get('Estado') || 'Pendiente',
                fecha: row.get('Fecha') || 'Sin fecha'
            };
        });

        // Filtramos para devolver solo las que no estén marcadas como "Completado"
        return tasks.filter(task => task.estado.toLowerCase() !== 'completado');

    } catch (error) {
        console.error('Error al conectar con Google Sheets:', error);
        throw error;
    }
}

async function getAllTasks() {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        if (rows.length === 0) return [];

        return rows.map((row, index) => {
            return {
                _rowIndex: index, // Importante para saber qué fila actualizar
                id: row.get('ID') || 'N/A',
                tarea: row.get('Tarea') || 'Sin nombre',
                responsable: row.get('Responsable') || 'No asignado',
                estado: row.get('Estado') || 'Pendiente',
                fecha: row.get('Fecha') || 'Sin fecha'
            };
        });
    } catch (error) {
        console.error('Error al obtener todas las tareas:', error);
        throw error;
    }
}

// Función auxiliar para forzar que las claves coincidan con las columnas del Sheet
function normalizeData(data) {
    const normalized = {};
    const keyMap = {
        'id': 'ID',
        'tarea': 'Tarea',
        'responsable': 'Responsable',
        'estado': 'Estado',
        'fecha': 'Fecha'
    };
    
    for (const key of Object.keys(data)) {
        const lowerKey = key.toLowerCase();
        if (keyMap[lowerKey]) {
            normalized[keyMap[lowerKey]] = data[key];
        } else {
            // Si la IA inventa una columna, la dejamos pasar pero con mayúscula inicial
            normalized[key.charAt(0).toUpperCase() + key.slice(1)] = data[key];
        }
    }
    return normalized;
}

async function appendRow(data) {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const finalData = normalizeData(data);
        await sheet.addRow(finalData);
    } catch (error) {
        console.error('Error al añadir fila:', error);
        throw error;
    }
}

async function updateRow(rowIndex, data) {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        if (rowIndex >= 0 && rowIndex < rows.length) {
            const row = rows[rowIndex];
            const finalData = normalizeData(data);
            for (const key of Object.keys(finalData)) {
                row.set(key, finalData[key]);
            }
            await row.save();
        } else {
            throw new Error(`La fila con índice ${rowIndex} no existe.`);
        }
    } catch (error) {
        console.error('Error al actualizar fila:', error);
        throw error;
    }
}

module.exports = {
    getPendingTasks,
    getAllTasks,
    appendRow,
    updateRow
};
