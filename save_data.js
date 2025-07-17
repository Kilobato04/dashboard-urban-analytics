// netlify/functions/save_data.js
// Función serverless para Netlify - Urban Analytics Dashboard

const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Manejar preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Ruta del archivo de datos (en /tmp para Netlify)
  const dataPath = '/tmp/urban_analytics_data.json';

  try {
    if (event.httpMethod === 'POST') {
      // === GUARDAR DATOS ===
      console.log('📥 Guardando datos...');
      
      // Validar que hay datos en el body
      if (!event.body) {
        throw new Error('No data provided');
      }

      // Parsear datos JSON
      let data;
      try {
        data = JSON.parse(event.body);
      } catch (parseError) {
        throw new Error('Invalid JSON data');
      }

      // Validar estructura mínima
      if (!data.metadata || !data.pipeline) {
        throw new Error('Invalid data structure - missing required fields');
      }

      // Agregar timestamp de guardado
      data.metadata.lastSaved = new Date().toISOString();
      data.metadata.version = '1.0';
      data.metadata.savedBy = 'netlify-function';

      // Escribir archivo
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

      console.log('✅ Datos guardados exitosamente');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Data saved successfully',
          timestamp: data.metadata.lastSaved,
          size: JSON.stringify(data).length
        })
      };

    } else if (event.httpMethod === 'GET') {
      // === CARGAR DATOS ===
      console.log('📤 Cargando datos...');

      if (fs.existsSync(dataPath)) {
        // Leer archivo existente
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        
        let data;
        try {
          data = JSON.parse(fileContent);
        } catch (parseError) {
          throw new Error('Corrupted data file');
        }

        console.log('✅ Datos cargados exitosamente');

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: data,
            message: 'Data loaded successfully'
          })
        };
      } else {
        // No hay archivo guardado
        console.log('⚠️ No hay datos guardados');

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: null,
            message: 'No saved data found'
          })
        };
      }

    } else {
      // Método no permitido
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Method not allowed'
        })
      };
    }

  } catch (error) {
    console.error('❌ Error en función:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// === FUNCIÓN AUXILIAR PARA VALIDAR DATOS ===
function validateDataStructure(data) {
  const requiredFields = ['metadata', 'pipeline', 'progress'];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validar metadata
  if (!data.metadata.appName || !data.metadata.version) {
    throw new Error('Invalid metadata structure');
  }

  // Validar pipeline
  if (!data.pipeline.current || !Array.isArray(data.pipeline.current)) {
    throw new Error('Invalid pipeline structure');
  }

  // Validar progress
  if (typeof data.progress.target !== 'number') {
    throw new Error('Invalid progress structure');
  }

  return true;
}

// === FUNCIÓN AUXILIAR PARA LIMPIAR DATOS ===
function sanitizeData(data) {
  // Remover campos innecesarios o potencialmente problemáticos
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Limpiar metadata
  if (sanitized.metadata) {
    delete sanitized.metadata.userAgent;
    delete sanitized.metadata.sessionId;
  }
  
  return sanitized;
}

console.log('✅ Netlify function loaded: save_data.js');
