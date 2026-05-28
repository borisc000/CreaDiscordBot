require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);

async function getHeaders() {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.loadHeaderRow();
    return sheet.headerValues;
}

async function getAllTasks() {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const headers = sheet.headerValues;
        
        const rows = await sheet.getRows();
        
        if (rows.length === 0) return { headers, tasks: [] };

        const tasks = rows.map((row, index) => {
            const taskObj = { _rowIndex: index };
            for (const header of headers) {
                taskObj[header] = row.get(header) || '';
            }
            return taskObj;
        });
        
        return { headers, tasks };
    } catch (error) {
        console.error('Error al obtener todas las tareas:', error);
        throw error;
    }
}

// Función que lee los headers actuales y cruza los datos de Gemini,
// respetando mayúsculas/minúsculas del sheet original para evitar errores.
async function normalizeData(data) {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.loadHeaderRow();
    const headers = sheet.headerValues;
    
    const normalized = {};
    for (const key of Object.keys(data)) {
        // Buscamos si existe la columna ignorando mayúsculas/minúsculas
        const realHeader = headers.find(h => h.toLowerCase() === key.toLowerCase());
        if (realHeader) {
            normalized[realHeader] = data[key];
        } else {
            // Si la columna no existe aún, la pasamos tal cual.
            // Más adelante podemos crearla, o depender de que Gemini mande un añadir_columna antes.
            // La capitalizamos para que se vea bien si se añade sola
            normalized[key.charAt(0).toUpperCase() + key.slice(1)] = data[key];
        }
    }
    return normalized;
}

async function appendRow(data) {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        
        // Primero, si hay datos de columnas que NO existen en headerValues, deberíamos agregarlas automáticamente.
        // Pero como ya tenemos un comando "añadir_columna", no es estrictamente necesario, aunque es buena defensa.
        await sheet.loadHeaderRow();
        const finalData = await normalizeData(data);
        
        const newKeys = Object.keys(finalData).filter(k => !sheet.headerValues.includes(k));
        if (newKeys.length > 0) {
            await sheet.setHeaderRow([...sheet.headerValues, ...newKeys]);
        }
        
        await sheet.addRow(finalData);
    } catch (error) {
        console.error('Error al añadir fila:', error);
        throw error;
    }
}

async function updateRow(taskId, data) {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        // Buscar la fila por su columna ID
        const row = rows.find(r => r.get('ID') === String(taskId));
        
        if (row) {
            const finalData = await normalizeData(data);
            for (const key of Object.keys(finalData)) {
                row.set(key, finalData[key]);
            }
            await row.save();
        } else {
            throw new Error(`La tarea con ID ${taskId} no existe.`);
        }
    } catch (error) {
        console.error('Error al actualizar fila:', error);
        throw error;
    }
}

async function deleteRow(taskId) {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        // Buscar la fila por su columna ID
        const row = rows.find(r => r.get('ID') === String(taskId));
        
        if (row) {
            await row.delete();
        } else {
            throw new Error(`La tarea con ID ${taskId} no existe.`);
        }
    } catch (error) {
        console.error('Error al eliminar fila:', error);
        throw error;
    }
}

async function addColumn(columnName) {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        
        // Evitamos duplicados
        const exists = sheet.headerValues.some(h => h.toLowerCase() === columnName.toLowerCase());
        if (!exists) {
            await sheet.setHeaderRow([...sheet.headerValues, columnName]);
        }
    } catch (error) {
        console.error('Error al añadir columna:', error);
        throw error;
    }
}

async function getNextId() {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        
        // Si no existe columna ID, devolvemos 1
        if (!sheet.headerValues.some(h => h.toLowerCase() === 'id')) {
            return 1;
        }
        
        const rows = await sheet.getRows();
        let maxId = 0;
        for (const row of rows) {
            const val = parseInt(row.get('ID'));
            if (!isNaN(val) && val > maxId) {
                maxId = val;
            }
        }
        return maxId + 1;
    } catch (error) {
        console.error('Error al calcular siguiente ID:', error);
        return 1;
    }
}

module.exports = {
    getHeaders,
    getAllTasks,
    appendRow,
    updateRow,
    deleteRow,
    addColumn,
    getNextId
};
