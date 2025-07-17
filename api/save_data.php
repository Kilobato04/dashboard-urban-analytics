<?php
// Urban Analytics - API para guardar/cargar datos
// Archivo: api/save_data.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Archivo donde se guardan los datos
$dataFile = '../data/urban_analytics_data.json';

// Crear directorio si no existe
$dataDir = dirname($dataFile);
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // GUARDAR DATOS
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON data');
        }
        
        // Validar estructura mínima
        if (!isset($data['metadata']) || !isset($data['pipeline'])) {
            throw new Exception('Invalid data structure');
        }
        
        // Agregar timestamp
        $data['metadata']['lastSaved'] = date('Y-m-d H:i:s');
        $data['metadata']['version'] = '1.0';
        
        // Guardar archivo
        $result = file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT));
        
        if ($result === false) {
            throw new Exception('Failed to save data');
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Data saved successfully',
            'timestamp' => $data['metadata']['lastSaved'],
            'bytes' => $result
        ]);
        
    } else {
        // CARGAR DATOS
        if (file_exists($dataFile)) {
            $jsonData = file_get_contents($dataFile);
            $data = json_decode($jsonData, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('Corrupted data file');
            }
            
            echo json_encode([
                'success' => true,
                'data' => $data,
                'message' => 'Data loaded successfully'
            ]);
        } else {
            // Archivo no existe, devolver estructura vacía
            echo json_encode([
                'success' => true,
                'data' => null,
                'message' => 'No saved data found'
            ]);
        }
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
