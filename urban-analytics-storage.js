// === URBAN ANALYTICS STORAGE SYSTEM ===
// Adaptado del sistema exitoso de Smability

class UrbanAnalyticsStorage {
    constructor() {
        this.apiBase = './api/';
        this.hasUnsavedChanges = false;
        this.isOnline = navigator.onLine;
        this.isInitializing = false;
        this.autoSaveInterval = null;
    }

    // === INICIALIZACIÓN ===
    async initializeStorage() {
        console.log('🚀 ===== INICIALIZANDO STORAGE URBAN ANALYTICS =====');
        
        try {
            this.isInitializing = true;
            this.showNotification('🔄 Conectando con servidor...', 'info');
            
            // Cargar datos del servidor
            const loaded = await this.loadFromServer();
            
            if (loaded) {
                this.showNotification('✅ Datos cargados del servidor', 'success');
            } else {
                this.showNotification('🆕 Iniciando con datos por defecto', 'info');
            }
            
            // Configurar detección de cambios
            this.setupChangeDetection();
            this.setupBeforeUnload();
            this.setupOnlineDetection();
            
            this.isInitializing = false;
            console.log('✅ Storage inicializado exitosamente');
            
        } catch (error) {
            console.error('❌ Error inicializando storage:', error);
            this.showNotification('❌ Error al conectar con servidor', 'error');
            this.isInitializing = false;
        }
    }

    // === GUARDAR EN SERVIDOR ===
    async saveToServer() {
        if (!this.isOnline) {
            this.showNotification('❌ Sin conexión a internet', 'error');
            return false;
        }

        try {
            console.log('💾 Guardando datos en servidor...');
            this.showNotification('💾 Guardando...', 'info');
            
            const data = this.collectCurrentData();
            console.log('📦 Datos recolectados:', data);
            
            const response = await fetch(this.apiBase + 'save_data.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('📡 Respuesta del servidor:', result);

            if (result.success) {
                this.hasUnsavedChanges = false;
                this.showNotification('✅ Guardado exitoso', 'success');
                console.log('✅ Datos guardados exitosamente');
                return true;
            } else {
                throw new Error(result.error || 'Error del servidor');
            }
            
        } catch (error) {
            console.error('❌ Error guardando:', error);
            this.showNotification('❌ Error al guardar: ' + error.message, 'error');
            return false;
        }
    }

    // === CARGAR DEL SERVIDOR ===
    async loadFromServer() {
        console.log('📥 Cargando datos del servidor...');
        
        try {
            const response = await fetch(this.apiBase + 'save_data.php', {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('📡 Respuesta del servidor:', result);

            if (result.success && result.data) {
                console.log('✅ Datos encontrados, aplicando al dashboard...');
                this.applyDataToDashboard(result.data);
                return true;
            } else {
                console.log('⚠️ No hay datos guardados, usando valores por defecto');
                return false;
            }

        } catch (error) {
            console.error('❌ Error cargando datos:', error);
            this.showNotification('❌ Error al cargar: ' + error.message, 'error');
            return false;
        }
    }

    // === RECOLECTAR DATOS ACTUALES ===
    collectCurrentData() {
        console.log('📊 Recolectando datos actuales del dashboard...');
        
        const currentData = {
            metadata: {
                version: "1.0",
                lastSaved: new Date().toISOString(),
                appName: "Urban Analytics Mexico Dashboard"
            },
            pipeline: {
                current: this.extractPipelineData(),
                eoi: this.extractEOIData(),
                ongoing: this.extractOngoingData(),
                lost: this.extractLostData()
            },
            progress: {
                exercised: parseInt(document.getElementById('exercisedAmount')?.value) || 0,
                backlog: parseInt(document.getElementById('backlogAmount')?.value) || 0,
                potential: parseInt(document.getElementById('potentialAmount')?.value) || 0,
                target: parseInt(document.getElementById('targetAmount')?.value) || 300000,
                teamCost: parseInt(document.getElementById('teamCost')?.value) || 240000
            },
            tactics: this.extractTacticsData(),
            evaluation: this.extractEvaluationData(),
            settings: {
                autoSave: false,
                manualSaveOnly: true
            }
        };

        console.log('📦 Datos recolectados:', currentData);
        return currentData;
    }

    // === EXTRAER DATOS DEL PIPELINE ===
    extractPipelineData() {
        console.log('📋 Extrayendo datos del pipeline...');
        
        const pipeline = [];
        const rows = document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)');
        
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 10) {
                const project = {
                    id: `pipeline_${index + 1}`,
                    number: cells[0].textContent.trim(),
                    project: cells[1].querySelector('input')?.value || '',
                    topic: cells[2].querySelector('select')?.value || '',
                    client: cells[3].querySelector('input')?.value || '',
                    lead: cells[4].querySelector('select')?.value || '',
                    support: cells[5].querySelector('select')?.value || '',
                    date: cells[6].querySelector('input')?.value || '',
                    price: parseFloat(cells[7].querySelector('input')?.value) || 0,
                    probability: parseFloat(cells[8].querySelector('input')?.value) || 0,
                    weightedValue: parseFloat(cells[9].textContent.replace(/[$,]/g, '')) || 0
                };
                
                pipeline.push(project);
            }
        });
        
        console.log(`📊 Pipeline extraído: ${pipeline.length} proyectos`);
        return pipeline;
    }

    // === EXTRAER DATOS EOI ===
    extractEOIData() {
        console.log('📋 Extrayendo datos EOI...');
        
        const eoi = [];
        const rows = document.querySelectorAll('#eoiTable tbody tr');
        
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                const opportunity = {
                    id: `eoi_${index + 1}`,
                    number: cells[0].textContent.trim(),
                    project: cells[1].querySelector('input')?.value || '',
                    client: cells[2].querySelector('input')?.value || '',
                    lead: cells[3].querySelector('select')?.value || '',
                    support: cells[4].querySelector('select')?.value || '',
                    date: cells[5].querySelector('input')?.value || '',
                    other: cells[6].querySelector('input')?.value || ''
                };
                
                eoi.push(opportunity);
            }
        });
        
        console.log(`📊 EOI extraído: ${eoi.length} oportunidades`);
        return eoi;
    }

    // === EXTRAER DATOS ONGOING ===
    extractOngoingData() {
        console.log('📋 Extrayendo datos ongoing...');
        
        const ongoing = [];
        const rows = document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)');
        
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 6) {
                const project = {
                    id: `ongoing_${index + 1}`,
                    number: cells[0].textContent.trim(),
                    project: cells[1].querySelector('input')?.value || '',
                    client: cells[2].querySelector('input')?.value || '',
                    date: cells[3].querySelector('input')?.value || '',
                    value: parseFloat(cells[4].querySelector('input')?.value) || 0,
                    status: cells[5].querySelector('select')?.value || ''
                };
                
                ongoing.push(project);
            }
        });
        
        console.log(`📊 Ongoing extraído: ${ongoing.length} proyectos`);
        return ongoing;
    }

    // === EXTRAER DATOS LOST ===
    extractLostData() {
        console.log('📋 Extrayendo datos lost...');
        
        const lost = [];
        const rows = document.querySelectorAll('#lostTable tbody tr:not(.total-row)');
        
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 9) {
                const opportunity = {
                    id: `lost_${index + 1}`,
                    number: cells[0].textContent.trim(),
                    project: cells[1].querySelector('input')?.value || '',
                    client: cells[2].querySelector('input')?.value || '',
                    lead: cells[3].querySelector('select')?.value || '',
                    support: cells[4].querySelector('select')?.value || '',
                    dateLost: cells[5].querySelector('input')?.value || '',
                    value: parseFloat(cells[6].querySelector('input')?.value) || 0,
                    motive: cells[7].querySelector('select')?.value || '',
                    comments: cells[8].querySelector('input')?.value || ''
                };
                
                lost.push(opportunity);
            }
        });
        
        console.log(`📊 Lost extraído: ${lost.length} oportunidades`);
        return lost;
    }

    // === EXTRAER DATOS TACTICS ===
    extractTacticsData() {
        console.log('📋 Extrayendo datos tactics...');
        
        const tactics = {};
        const teamMembers = ['octavio', 'roberto', 'noe', 'ricardo'];
        
        teamMembers.forEach(member => {
            tactics[member] = {
                q2: [],
                q3: [],
                q4: []
            };
            
            const quarters = ['q2', 'q3', 'q4'];
            quarters.forEach(quarter => {
                const checkboxes = document.querySelectorAll(`input[data-quarter="${quarter}"]`);
                checkboxes.forEach(checkbox => {
                    const tacticsItem = {
                        text: checkbox.previousElementSibling?.textContent || '',
                        completed: checkbox.checked
                    };
                    tactics[member][quarter].push(tacticsItem);
                });
            });
        });
        
        console.log('📊 Tactics extraído:', Object.keys(tactics).length, 'miembros');
        return tactics;
    }

    // === EXTRAER DATOS EVALUATION ===
    extractEvaluationData() {
        console.log('📋 Extrayendo datos evaluation...');
        
        const evaluation = {
            opportunityName: document.getElementById('opportunityName')?.value || '',
            criteria: [],
            finalScore: document.getElementById('finalScore')?.textContent || '0',
            totalWeight: document.getElementById('totalWeight')?.textContent || '0',
            recommendation: document.getElementById('recommendation')?.textContent || ''
        };
        
        const evaluationItems = document.querySelectorAll('.evaluation-item');
        evaluationItems.forEach((item, index) => {
            const criterion = {
                id: index + 1,
                criterion: item.querySelector('.criterion')?.textContent || '',
                description: item.querySelector('.criterion-description')?.textContent || '',
                weight: parseFloat(item.querySelector('.weight-input')?.value) || 0,
                score: parseFloat(item.querySelector('.score-input')?.value) || 0
            };
            evaluation.criteria.push(criterion);
        });
        
        console.log('📊 Evaluation extraído:', evaluation.criteria.length, 'criterios');
        return evaluation;
    }

    // === APLICAR DATOS AL DASHBOARD ===
    applyDataToDashboard(data) {
        console.log('📥 ===== APLICANDO DATOS AL DASHBOARD =====');
        
        try {
            // Aplicar datos de progreso
            if (data.progress) {
                console.log('📊 Aplicando progreso...');
                Object.entries(data.progress).forEach(([key, value]) => {
                    const element = document.getElementById(key === 'exercised' ? 'exercisedAmount' : 
                                                         key === 'backlog' ? 'backlogAmount' :
                                                         key === 'potential' ? 'potentialAmount' :
                                                         key === 'target' ? 'targetAmount' :
                                                         key === 'teamCost' ? 'teamCost' : key);
                    if (element) {
                        element.value = value;
                    }
                });
            }
            
            // Aplicar datos del pipeline
            if (data.pipeline) {
                console.log('📋 Aplicando pipeline...');
                this.applyPipelineData(data.pipeline);
            }
            
            // Aplicar datos de tactics
            if (data.tactics) {
                console.log('📋 Aplicando tactics...');
                this.applyTacticsData(data.tactics);
            }
            
            // Aplicar datos de evaluation
            if (data.evaluation) {
                console.log('📋 Aplicando evaluation...');
                this.applyEvaluationData(data.evaluation);
            }
            
            // Recalcular totales
            setTimeout(() => {
                this.recalculateAll();
            }, 500);
            
            console.log('✅ Datos aplicados exitosamente');
            
        } catch (error) {
            console.error('❌ Error aplicando datos:', error);
            this.showNotification('❌ Error al aplicar datos', 'error');
        }
    }

    // === APLICAR DATOS DEL PIPELINE ===
    applyPipelineData(pipelineData) {
        console.log('📋 Aplicando datos del pipeline...');
        
        // Limpiar tablas existentes
        this.clearPipelineTables();
        
        // Aplicar datos de pipeline principal
        if (pipelineData.current && Array.isArray(pipelineData.current)) {
            this.recreatePipelineTable(pipelineData.current);
        }
        
        // Aplicar datos de EOI
        if (pipelineData.eoi && Array.isArray(pipelineData.eoi)) {
            this.recreateEOITable(pipelineData.eoi);
        }
        
        // Aplicar datos de ongoing
        if (pipelineData.ongoing && Array.isArray(pipelineData.ongoing)) {
            this.recreateOngoingTable(pipelineData.ongoing);
        }
        
        // Aplicar datos de lost
        if (pipelineData.lost && Array.isArray(pipelineData.lost)) {
            this.recreateLostTable(pipelineData.lost);
        }
    }

    // === LIMPIAR TABLAS ===
    clearPipelineTables() {
        console.log('🧹 Limpiando tablas del pipeline...');
        
        // Limpiar tabla principal (excepto fila de totales)
        const pipelineBody = document.querySelector('#pipelineTable tbody');
        if (pipelineBody) {
            const rows = pipelineBody.querySelectorAll('tr:not(.total-row)');
            rows.forEach(row => row.remove());
        }
        
        // Limpiar otras tablas
        const tableIds = ['eoiTable', 'ongoingTable', 'lostTable'];
        tableIds.forEach(tableId => {
            const tbody = document.querySelector(`#${tableId} tbody`);
            if (tbody) {
                const rows = tbody.querySelectorAll('tr:not(.total-row)');
                rows.forEach(row => row.remove());
            }
        });
    }

    // === RECREAR TABLA PIPELINE ===
    recreatePipelineTable(pipelineData) {
        console.log(`📋 Recreando tabla pipeline: ${pipelineData.length} proyectos`);
        
        const tbody = document.querySelector('#pipelineTable tbody');
        const totalRow = tbody.querySelector('.total-row');
        
        pipelineData.forEach((project, index) => {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" class="editable" value="${project.project}" onchange="updatePipeline()"></td>
                <td><select class="editable">
                    <option value="AI" ${project.topic === 'AI' ? 'selected' : ''}>AI</option>
                    <option value="Demand Modeling" ${project.topic === 'Demand Modeling' ? 'selected' : ''}>Demand Modeling</option>
                    <option value="BigData" ${project.topic === 'BigData' ? 'selected' : ''}>BigData</option>
                    <option value="Urban Analytics" ${project.topic === 'Urban Analytics' ? 'selected' : ''}>Urban Analytics</option>
                    <option value="Financial Modeling" ${project.topic === 'Financial Modeling' ? 'selected' : ''}>Financial Modeling</option>
                </select></td>
                <td><input type="text" class="editable" value="${project.client}"></td>
                <td><select class="editable" onchange="updatePipelineLeadAnalysis()">
                    <option value="Octavio" ${project.lead === 'Octavio' ? 'selected' : ''}>Octavio</option>
                    <option value="Roberto" ${project.lead === 'Roberto' ? 'selected' : ''}>Roberto</option>
                    <option value="Noé" ${project.lead === 'Noé' ? 'selected' : ''}>Noé</option>
                    <option value="Ricardo" ${project.lead === 'Ricardo' ? 'selected' : ''}>Ricardo</option>
                </select></td>
                <td><select class="editable" onchange="updatePipelineLeadAnalysis()">
                    <option value="None" ${project.support === 'None' ? 'selected' : ''}>None</option>
                    <option value="Octavio" ${project.support === 'Octavio' ? 'selected' : ''}>Octavio</option>
                    <option value="Roberto" ${project.support === 'Roberto' ? 'selected' : ''}>Roberto</option>
                    <option value="Noé" ${project.support === 'Noé' ? 'selected' : ''}>Noé</option>
                    <option value="Ricardo" ${project.support === 'Ricardo' ? 'selected' : ''}>Ricardo</option>
                </select></td>
                <td><input type="date" class="editable date-input" value="${project.date}"></td>
                <td><input type="number" class="editable amount-input" value="${project.price}" onchange="updatePipeline()"></td>
                <td><input type="number" class="editable probability-input" value="${project.probability}" min="0" max="100" onchange="updatePipeline()"></td>
                <td class="weighted-value">$${project.weightedValue.toLocaleString()}</td>
                <td><button class="delete-button" onclick="deleteRow(this)">Delete</button></td>
            `;
            
            tbody.insertBefore(newRow, totalRow);
        });
        
        // Configurar event listeners
        this.setupTableEventListeners();
    }

    // === RECREAR OTRAS TABLAS ===
    recreateEOITable(eoiData) {
        console.log(`📋 Recreando tabla EOI: ${eoiData.length} oportunidades`);
        
        const tbody = document.querySelector('#eoiTable tbody');
        if (!tbody) return;
        
        eoiData.forEach((opportunity, index) => {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" class="editable" value="${opportunity.project}"></td>
                <td><input type="text" class="editable" value="${opportunity.client}"></td>
                <td><select class="editable">
                    <option value="Octavio" ${opportunity.lead === 'Octavio' ? 'selected' : ''}>Octavio</option>
                    <option value="Roberto" ${opportunity.lead === 'Roberto' ? 'selected' : ''}>Roberto</option>
                    <option value="Noé" ${opportunity.lead === 'Noé' ? 'selected' : ''}>Noé</option>
                    <option value="Ricardo" ${opportunity.lead === 'Ricardo' ? 'selected' : ''}>Ricardo</option>
                </select></td>
                <td><select class="editable">
                    <option value="None" ${opportunity.support === 'None' ? 'selected' : ''}>None</option>
                    <option value="Octavio" ${opportunity.support === 'Octavio' ? 'selected' : ''}>Octavio</option>
                    <option value="Roberto" ${opportunity.support === 'Roberto' ? 'selected' : ''}>Roberto</option>
                    <option value="Noé" ${opportunity.support === 'Noé' ? 'selected' : ''}>Noé</option>
                    <option value="Ricardo" ${opportunity.support === 'Ricardo' ? 'selected' : ''}>Ricardo</option>
                </select></td>
                <td><input type="date" class="editable date-input" value="${opportunity.date}"></td>
                <td><input type="text" class="editable" value="${opportunity.other}" style="min-width: 200px;"></td>
                <td><button class="delete-button" onclick="deleteRow(this)">Delete</button></td>
            `;
            
            tbody.appendChild(newRow);
        });
    }

    recreateOngoingTable(ongoingData) {
        console.log(`📋 Recreando tabla ongoing: ${ongoingData.length} proyectos`);
        
        const tbody = document.querySelector('#ongoingTable tbody');
        const totalRow = tbody.querySelector('.total-row');
        
        ongoingData.forEach((project, index) => {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" class="editable" value="${project.project}"></td>
                <td><input type="text" class="editable" value="${project.client}"></td>
                <td><input type="date" class="editable date-input" value="${project.date}"></td>
                <td><input type="number" class="editable amount-input" value="${project.value}" onchange="updateOngoing()"></td>
                <td><select class="editable" onchange="updateOngoing()">
                    <option value="In Progress" ${project.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="On Hold" ${project.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                    <option value="Completed" ${project.status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select></td>
                <td><button class="delete-button" onclick="deleteRow(this)">Delete</button></td>
            `;
            
            tbody.insertBefore(newRow, totalRow);
        });
    }

    recreateLostTable(lostData) {
        console.log(`📋 Recreando tabla lost: ${lostData.length} oportunidades`);
        
        const tbody = document.querySelector('#lostTable tbody');
        const totalRow = tbody.querySelector('.total-row');
        
        lostData.forEach((opportunity, index) => {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" class="editable" value="${opportunity.project}"></td>
                <td><input type="text" class="editable" value="${opportunity.client}"></td>
                <td><select class="editable">
                    <option value="Octavio" ${opportunity.lead === 'Octavio' ? 'selected' : ''}>Octavio</option>
                    <option value="Roberto" ${opportunity.lead === 'Roberto' ? 'selected' : ''}>Roberto</option>
                    <option value="Noé" ${opportunity.lead === 'Noé' ? 'selected' : ''}>Noé</option>
                    <option value="Ricardo" ${opportunity.lead === 'Ricardo' ? 'selected' : ''}>Ricardo</option>
                </select></td>
                <td><select class="editable">
                    <option value="None" ${opportunity.support === 'None' ? 'selected' : ''}>None</option>
                    <option value="Octavio" ${opportunity.support === 'Octavio' ? 'selected' : ''}>Octavio</option>
                    <option value="Roberto" ${opportunity.support === 'Roberto' ? 'selected' : ''}>Roberto</option>
                    <option value="Noé" ${opportunity.support === 'Noé' ? 'selected' : ''}>Noé</option>
                    <option value="Ricardo" ${opportunity.support === 'Ricardo' ? 'selected' : ''}>Ricardo</option>
                </select></td>
                <td><input type="date" class="editable date-input" value="${opportunity.dateLost}"></td>
                <td><input type="number" class="editable amount-input" value="${opportunity.value}" onchange="updateLost()"></td>
                <td><select class="editable" onchange="updateLossAnalysis()">
                    <option value="Price" ${opportunity.motive === 'Price' ? 'selected' : ''}>Price</option>
                    <option value="Technical" ${opportunity.motive === 'Technical' ? 'selected' : ''}>Technical</option>
                    <option value="Price/Technical" ${opportunity.motive === 'Price/Technical' ? 'selected' : ''}>Price/Technical</option>
                    <option value="Deadline" ${opportunity.motive === 'Deadline' ? 'selected' : ''}>Deadline</option>
                    <option value="Corruption" ${opportunity.motive === 'Corruption' ? 'selected' : ''}>Corruption</option>
                    <option value="Lack of Funds" ${opportunity.motive === 'Lack of Funds' ? 'selected' : ''}>Lack of Funds</option>
                    <option value="Political Environment" ${opportunity.motive === 'Political Environment' ? 'selected' : ''}>Political Environment</option>
                    <option value="Client Stepback" ${opportunity.motive === 'Client Stepback' ? 'selected' : ''}>Client Stepback</option>
                    <option value="Administrative Issues" ${opportunity.motive === 'Administrative Issues' ? 'selected' : ''}>Administrative Issues</option>
                    <option value="Decided not to go" ${opportunity.motive === 'Decided not to go' ? 'selected' : ''}>Decided not to go</option>
                    <option value="Others" ${opportunity.motive === 'Others' ? 'selected' : ''}>Others</option>
                </select></td>
                <td><input type="text" class="editable" value="${opportunity.comments}"></td>
                <td><button class="delete-button" onclick="deleteRow(this)">Delete</button></td>
            `;
            
            tbody.insertBefore(newRow, totalRow);
        });
    }

    // === APLICAR DATOS DE TACTICS ===
    applyTacticsData(tacticsData) {
        console.log('📋 Aplicando datos de tactics...');
        
        Object.entries(tacticsData).forEach(([member, quarters]) => {
            Object.entries(quarters).forEach(([quarter, tasks]) => {
                tasks.forEach((task, index) => {
                    const checkbox = document.querySelector(`input[data-quarter="${quarter}"][data-member="${member}"]`);
                    if (checkbox && index < document.querySelectorAll(`input[data-quarter="${quarter}"]`).length) {
                        checkbox.checked = task.completed;
                    }
                });
            });
        });
        
        // Actualizar indicadores
        if (typeof updateCompletionIndicator === 'function') {
            updateCompletionIndicator();
        }
    }

    // === APLICAR DATOS DE EVALUATION ===
    applyEvaluationData(evaluationData) {
        console.log('📋 Aplicando datos de evaluation...');
        
        // Aplicar nombre de oportunidad
        const opportunityNameInput = document.getElementById('opportunityName');
        if (opportunityNameInput) {
            opportunityNameInput.value = evaluationData.opportunityName || '';
        }
        
        // Aplicar criterios
        const evaluationItems = document.querySelectorAll('.evaluation-item');
        evaluationItems.forEach((item, index) => {
            if (evaluationData.criteria[index]) {
                const criterion = evaluationData.criteria[index];
                const weightInput = item.querySelector('.weight-input');
                const scoreInput = item.querySelector('.score-input');
                
                if (weightInput) weightInput.value = criterion.weight;
                if (scoreInput) scoreInput.value = criterion.score;
            }
        });
        
        // Recalcular score
        if (typeof calculateScore === 'function') {
            calculateScore();
        }
    }

    // === CONFIGURAR EVENT LISTENERS ===
    setupTableEventListeners() {
        console.log('🔧 Configurando event listeners...');
        
        // Detectar cambios en inputs
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('editable')) {
                this.markUnsavedChanges();
            }
        });
        
        // Detectar cambios en selects
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('editable')) {
                this.markUnsavedChanges();
            }
        });
    }

    // === RECALCULAR TODOS LOS TOTALES ===
    recalculateAll() {
        console.log('🔄 Recalculando todos los totales...');
        
        // Recalcular pipeline
        if (typeof updatePipeline === 'function') {
            updatePipeline();
        }
        
        // Recalcular ongoing
        if (typeof updateOngoing === 'function') {
            updateOngoing();
        }
        
        // Recalcular lost
        if (typeof updateLost === 'function') {
            updateLost();
        }
        
        // Actualizar indicadores
        if (typeof updateCompletionIndicator === 'function') {
            updateCompletionIndicator();
        }
    }

    // === CONFIGURAR DETECCIÓN DE CAMBIOS ===
    setupChangeDetection() {
        console.log('🔧 Configurando detección de cambios...');
        
        // Detectar cambios en inputs y selects
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('editable') || 
                e.target.classList.contains('amount-input') ||
                e.target.classList.contains('probability-input')) {
                this.markUnsavedChanges();
            }
        });
        
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('editable') ||
                e.target.type === 'checkbox') {
                this.markUnsavedChanges();
            }
        });
    }

    // === FUNCIONES AUXILIARES ===
    markUnsavedChanges() {
        if (!this.isInitializing) {
            this.hasUnsavedChanges = true;
            console.log('📝 Cambios marcados como no guardados');
        }
    }

    setupBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                const message = '¡Tienes cambios sin guardar!';
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        });
    }

    setupOnlineDetection() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNotification('🌐 Conexión restaurada', 'success');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showNotification('📱 Modo sin conexión', 'warning');
        });
    }

    showNotification(message, type = 'info') {
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 12px 20px;
            border-radius: 8px; color: white; font-weight: bold; z-index: 10000;
            ${type === 'success' ? 'background: #28a745;' : 
              type === 'error' ? 'background: #dc3545;' : 
              type === 'warning' ? 'background: #ffc107;' : 'background: #007bff;'}
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 4000);
    }

    // === GUARDAR MANUAL ===
    async forceSave() {
        return await this.saveToServer();
    }

    // === OBTENER STATUS ===
    getStatus() {
        return {
            online: this.isOnline,
            hasChanges: this.hasUnsavedChanges,
            autoSaveActive: !!this.autoSaveInterval
        };
    }
}

// === INSTANCIAR STORAGE ===
const urbanAnalyticsStorage = new UrbanAnalyticsStorage();

// === FUNCIÓN DE GUARDADO MANUAL ===
async function saveData() {
    console.log('💾 ===== GUARDADO MANUAL ACTIVADO =====');
    
    const saveButton = document.querySelector('.save-button');
    if (saveButton) {
        const originalText = saveButton.textContent;
        saveButton.textContent = '💾 Guardando...';
        saveButton.disabled = true;
        
        try {
            const success = await urbanAnalyticsStorage.forceSave();
            
            if (success) {
                saveButton.textContent = '✅ Guardado exitoso';
                console.log('✅ Guardado manual completado');
            } else {
                saveButton.textContent = '❌ Error al guardar';
                console.log('❌ Error en guardado manual');
            }
            
        } catch (error) {
            console.error('❌ Error en guardado manual:', error);
            saveButton.textContent = '❌ Error';
        }
        
        // Restaurar botón
        setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
        }, 2000);
    }
}

// === INICIALIZAR AL CARGAR ===
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Inicializando Urban Analytics Storage...');
    
    // Esperar un poco para que se cargue el DOM completamente
    setTimeout(async () => {
        await urbanAnalyticsStorage.initializeStorage();
        console.log('✅ Urban Analytics Storage inicializado');
    }, 1000);
});

console.log('✅ Urban Analytics Storage System cargado');
