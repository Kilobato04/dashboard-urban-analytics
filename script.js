// Dashboard functionality for Urban Analytics Mexico Practice Group
// Updated with Server Storage Integration

// === GLOBAL VARIABLES ===
let isInitializing = true;
let rowCounter = 1;

// === TAB NAVIGATION ===
function openTab(tabName) {
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));

    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Initialize current week when minuta tab is opened
    if (tabName === 'minuta') {
        const currentWeekElement = document.getElementById('currentWeek');
        if (currentWeekElement) {
            currentWeekElement.textContent = getCurrentWeek();
        }
    }
}

// === PROGRESS BAR FUNCTIONS ===
function getOngoingTotal() {
    const rows = document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)');
    let total = 0;
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
            // Usar UA Fees (columna 7, índice 6)
            const uaFeesInput = cells[6].querySelector('.amount-input');
            if (uaFeesInput) {
                total += parseFloat(uaFeesInput.value) || 0;
            }
        }
    });
    return total;
}

function getBacklogTotal() {
    const rows = document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)');
    let total = 0;
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
            // Usar UA Fees (columna 7, índice 6)
            const uaFeesInput = cells[6].querySelector('.amount-input');
            const statusSelect = cells[7].querySelector('select.editable'); // Status ahora es columna 8
            if (uaFeesInput && statusSelect && statusSelect.value === 'In Progress') {
                total += parseFloat(uaFeesInput.value) || 0;
            }
        }
    });
    return total;
}

function getExercisedTotal() {
    const rows = document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)');
    let total = 0;
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
            // Usar UA Fees (columna 7, índice 6)
            const uaFeesInput = cells[6].querySelector('.amount-input');
            const statusSelect = cells[7].querySelector('select.editable'); // Status ahora es columna 8
            if (uaFeesInput && statusSelect && statusSelect.value === 'Completed') {
                total += parseFloat(uaFeesInput.value) || 0;
            }
        }
    });
    return total;
}

function getPipelineWeighted() {
    const rows = document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)');
    let totalWeighted = 0;
    rows.forEach(row => {
        const amountInput = row.querySelector('.amount-input');
        const probabilityInput = row.querySelector('.probability-input');
        if (amountInput && probabilityInput) {
            const amount = parseFloat(amountInput.value) || 0;
            const probability = parseFloat(probabilityInput.value) || 0;
            totalWeighted += (amount * probability) / 100;
        }
    });
    return totalWeighted;
}

function updateProgress() {
    // Get totals automatically
    const pipelineWeighted = getPipelineWeighted();
    const backlogTotal = getBacklogTotal();
    const exercisedTotal = getExercisedTotal();
    
    // Update fields
    const potentialField = document.getElementById('potentialAmount');
    const backlogField = document.getElementById('backlogAmount');
    const exercisedField = document.getElementById('exercisedAmount');
    
    if (potentialField) potentialField.value = Math.round(pipelineWeighted);
    if (backlogField) backlogField.value = backlogTotal;
    if (exercisedField) exercisedField.value = exercisedTotal;
    
    const exercised = exercisedTotal;
    const backlog = backlogTotal;
    const potential = pipelineWeighted;
    const target = parseInt(document.getElementById('targetAmount')?.value) || 300000;
    
    // Calculate gaps
    const gapTarget = target - (exercised + backlog + potential);
    const teamCostValue = parseInt(document.getElementById('teamCost')?.value) || 240000;
    const gapTeamCost = teamCostValue - (exercised + backlog + potential);
    
    const gapField = document.getElementById('gapAmount');
    const gapTeamCostField = document.getElementById('gapTeamCost');
    
    if (gapField) gapField.value = Math.round(gapTarget);
    
    if (gapTeamCostField) {
        gapTeamCostField.value = Math.round(gapTeamCost);
        
        // Change color based on result
        if (gapTeamCost > 0) {
            gapTeamCostField.style.background = '#d4edda';
            gapTeamCostField.style.color = '#155724';
            gapTeamCostField.style.border = '2px solid #28a745';
        } else {
            gapTeamCostField.style.background = '#f8d7da';
            gapTeamCostField.style.color = '#721c24';
            gapTeamCostField.style.border = '2px solid #dc3545';
        }
    }

    const total = exercised + backlog + potential;
    const remaining = Math.max(0, target - total);

    const exercisedPercent = (exercised / target) * 100;
    const backlogPercent = (backlog / target) * 100;
    const potentialPercent = (potential / target) * 100;
    const remainingPercent = (remaining / target) * 100;

    const progressExercised = document.getElementById('progressExercised');
    const progressBacklog = document.getElementById('progressBacklog');
    const progressPotential = document.getElementById('progressPotential');
    const progressRemaining = document.getElementById('progressRemaining');
    
    if (progressExercised) progressExercised.style.width = exercisedPercent + '%';
    if (progressBacklog) progressBacklog.style.width = backlogPercent + '%';
    if (progressPotential) progressPotential.style.width = potentialPercent + '%';
    if (progressRemaining) progressRemaining.style.width = remainingPercent + '%';

    // Calculate current month percentage
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentDay = currentDate.getDate();
    const daysInMonth = new Date(currentDate.getFullYear(), currentMonth + 1, 0).getDate();
    const currentMonthPercent = ((currentMonth + (currentDay / daysInMonth)) / 12) * 100;
    
    const progressIndicator = document.getElementById('progressIndicator');
    if (progressIndicator) {
        progressIndicator.style.left = currentMonthPercent + '%';
    }
    
    // Team cost indicator
    const teamCostPercent = (teamCostValue / target) * 100;
    const teamCostIndicator = document.getElementById('teamCostIndicator');
    if (teamCostIndicator) {
        teamCostIndicator.style.left = teamCostPercent + '%';
    }
    
    // Mark changes for saving
    markChangesForSaving();
}

// === COMPLETION INDICATORS ===
function updateCompletionIndicator() {
    const teamMembers = ['octavio', 'roberto', 'noe', 'ricardo'];
    const quarters = ['q2', 'q3', 'q4'];
    
    teamMembers.forEach(member => {
        const memberDiv = document.querySelector(`[data-member="${member}"]`);
        if (!memberDiv) return;
        
        const memberContainer = memberDiv.closest('.team-member');
        if (!memberContainer) return;
        
        let totalCheckedCount = 0;
        let totalCheckboxes = 0;
        
        quarters.forEach(quarter => {
            const quarterCheckboxes = memberContainer.querySelectorAll(`[data-quarter="${quarter}"]`);
            const quarterCheckedCount = Array.from(quarterCheckboxes).filter(cb => cb.checked).length;
            const quarterIndicator = memberContainer.querySelector(`[data-member="${member}"][data-quarter="${quarter}"]`);
            
            if (quarterIndicator) {
                if (quarter === 'q2') {
                    if (quarterCheckedCount === 0) {
                        quarterIndicator.textContent = '😱';
                    } else if (quarterCheckedCount === 1) {
                        quarterIndicator.textContent = '😰';
                    } else if (quarterCheckedCount >= 2) {
                        quarterIndicator.textContent = '😊';
                    }
                } else {
                    if (quarterCheckedCount === 0) {
                        quarterIndicator.textContent = '😱';
                    } else if (quarterCheckedCount === 1) {
                        quarterIndicator.textContent = '😰';
                    } else if (quarterCheckedCount === 2) {
                        quarterIndicator.textContent = '😐';
                    } else if (quarterCheckedCount >= 3) {
                        quarterIndicator.textContent = '😊';
                    }
                }
            }
            
            totalCheckedCount += quarterCheckedCount;
            totalCheckboxes += quarterCheckboxes.length;
        });
        
        const overallIndicator = memberContainer.querySelector('.completion-indicator');
        if (overallIndicator) {
            if (totalCheckedCount === 0) {
                overallIndicator.textContent = '😱';
            } else if (totalCheckedCount <= totalCheckboxes / 4) {
                overallIndicator.textContent = '😰';
            } else if (totalCheckedCount <= totalCheckboxes / 2) {
                overallIndicator.textContent = '😐';
            } else {
                overallIndicator.textContent = '😊';
            }
        }
    });
    
    // Update quarterly indicators
    quarters.forEach(quarter => {
        let membersWithAllCompleted = 0;
        let membersWithSomeCompleted = 0;
        
        teamMembers.forEach(member => {
            const memberDiv = document.querySelector(`[data-member="${member}"]`);
            if (!memberDiv) return;
            
            const memberContainer = memberDiv.closest('.team-member');
            if (!memberContainer) return;
            
            const quarterCheckboxes = memberContainer.querySelectorAll(`[data-quarter="${quarter}"]`);
            const quarterCheckedCount = Array.from(quarterCheckboxes).filter(cb => cb.checked).length;
            
            if (quarter === 'q2') {
                if (quarterCheckedCount >= 2) {
                    membersWithAllCompleted++;
                } else if (quarterCheckedCount > 0) {
                    membersWithSomeCompleted++;
                }
            } else {
                if (quarterCheckedCount >= 3) {
                    membersWithAllCompleted++;
                } else if (quarterCheckedCount > 0) {
                    membersWithSomeCompleted++;
                }
            }
        });
        
        const quarterProgressIndicator = document.getElementById(`${quarter}-progress`);
        if (quarterProgressIndicator) {
            if (membersWithAllCompleted === teamMembers.length) {
                quarterProgressIndicator.textContent = '😊';
            } else if (membersWithAllCompleted >= teamMembers.length / 2) {
                quarterProgressIndicator.textContent = '😐';
            } else if (membersWithSomeCompleted > 0 || membersWithAllCompleted > 0) {
                quarterProgressIndicator.textContent = '😰';
            } else {
                quarterProgressIndicator.textContent = '😱';
            }
        }
    });
    
    // Mark changes for saving
    markChangesForSaving();
}

// === PIPELINE FUNCTIONS ===
function updatePipeline() {
    const rows = document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)');
    let totalAmount = 0;
    let totalWeighted = 0;

    rows.forEach(row => {
        const amountInput = row.querySelector('.amount-input');
        const probabilityInput = row.querySelector('.probability-input');
        const weightedCell = row.querySelector('.weighted-value');

        if (amountInput && probabilityInput && weightedCell) {
            const amount = parseFloat(amountInput.value) || 0;
            const probability = parseFloat(probabilityInput.value) || 0;
            const weighted = (amount * probability) / 100;

            weightedCell.textContent = `$${weighted.toLocaleString()}`;
            totalAmount += amount;
            totalWeighted += weighted;
        }
    });

    const totalPipelineElement = document.getElementById('totalPipeline');
    const totalWeightedElement = document.getElementById('totalWeighted');
    
    if (totalPipelineElement) {
        totalPipelineElement.innerHTML = `<strong>$${totalAmount.toLocaleString()}</strong>`;
    }
    if (totalWeightedElement) {
        totalWeightedElement.innerHTML = `<strong>$${Math.round(totalWeighted).toLocaleString()}</strong>`;
    }
    
    updateProgress();
    updatePipelineLeadAnalysis();
    markChangesForSaving();
}

function updatePipelineLeadAnalysis() {
    const rows = document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)');
    const teamStats = {};

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
            const leadSelect = cells[4].querySelector('select.editable');
            const supportSelect = cells[5].querySelector('select.editable');
            
            if (leadSelect && supportSelect) {
                const lead = leadSelect.value;
                const support = supportSelect.value;
                
                if (!teamStats[lead]) {
                    teamStats[lead] = { lead: 0, support: 0 };
                }
                teamStats[lead].lead++;
                
                if (support !== "None") {
                    if (!teamStats[support]) {
                        teamStats[support] = { lead: 0, support: 0 };
                    }
                    teamStats[support].support++;
                }
            }
        }
    });

    const analysisContainer = document.getElementById('pipelineLeadAnalysis');
    if (analysisContainer) {
        let html = '';
        const teamMembers = ['Octavio', 'Roberto', 'Noé', 'Ricardo'];
        
        teamMembers.forEach(member => {
            const stats = teamStats[member] || { lead: 0, support: 0 };
            const total = stats.lead + stats.support;
            
            html += `
                <div style="background: white; padding: 15px; border-radius: 6px; border-left: 3px solid #FF6600; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <div style="font-weight: 600; color: #FF6600; margin-bottom: 8px;">${member}</div>
                    <div style="font-size: 0.9rem; color: #6c757d;">
                        <div>${stats.lead} Lead • ${stats.support} Support</div>
                        <div style="font-weight: 600; color: #1a1a1a; margin-top: 4px;">Total: ${total} opportunities</div>
                    </div>
                </div>
            `;
        });
        
        analysisContainer.innerHTML = html;
    }
}

// === LOST OPPORTUNITIES FUNCTIONS ===
function updateLost() {
    const rows = document.querySelectorAll('#lostTable tbody tr:not(.total-row)');
    let total = 0;

    rows.forEach(row => {
        const amountInput = row.querySelector('.amount-input');
        if (amountInput) {
            total += parseFloat(amountInput.value) || 0;
        }
    });

    const totalLostElement = document.getElementById('totalLost');
    if (totalLostElement) {
        totalLostElement.innerHTML = `<strong>$${total.toLocaleString()}</strong>`;
    }
    
    updateLossAnalysis();
    markChangesForSaving();
}

function updateLossAnalysis() {
    const rows = document.querySelectorAll('#lostTable tbody tr:not(.total-row)');
    const motives = {};
    let totalValue = 0;

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
            const motivSelect = cells[7].querySelector('select.editable');
            const amountInput = row.querySelector('.amount-input');
            
            if (motivSelect && amountInput) {
                const motive = motivSelect.value;
                const amount = parseFloat(amountInput.value) || 0;
                
                if (!motives[motive]) {
                    motives[motive] = { count: 0, value: 0 };
                }
                motives[motive].count++;
                motives[motive].value += amount;
                totalValue += amount;
            }
        }
    });

    const analysisContainer = document.getElementById('lossAnalysis');
    if (analysisContainer) {
        let html = '';
        Object.keys(motives).sort((a, b) => motives[b].value - motives[a].value).forEach(motive => {
            const data = motives[motive];
            const percentage = totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : 0;
            html += `
                <div style="background: white; padding: 15px; border-radius: 6px; border-left: 3px solid #dc3545; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <div style="font-weight: 600; color: #dc3545; margin-bottom: 5px;">${motive}</div>
                    <div style="font-size: 0.9rem; color: #6c757d;">
                        ${data.count} opp${data.count !== 1 ? 's' : ''} • $${data.value.toLocaleString()} (${percentage}%)
                    </div>
                </div>
            `;
        });
        
        if (html === '') {
            html = '<div style="text-align: center; color: #6c757d; font-style: italic;">No lost opportunities recorded yet</div>';
        }
        
        analysisContainer.innerHTML = html;
    }
}

// === ONGOING PROJECTS FUNCTIONS ===
function updateOngoing() {
    const rows = document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)');
    let totalProjectFees = 0;
    let totalUAFees = 0;

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
            // Project Fees (columna 6, índice 5)
            const projectFeesInput = cells[5].querySelector('.amount-input');
            if (projectFeesInput) {
                totalProjectFees += parseFloat(projectFeesInput.value) || 0;
            }
            
            // UA Fees (columna 7, índice 6) 
            const uaFeesInput = cells[6].querySelector('.amount-input');
            if (uaFeesInput) {
                totalUAFees += parseFloat(uaFeesInput.value) || 0;
            }
        }
    });

    // Actualizar totales en la tabla
    const totalProjectFeesElement = document.getElementById('totalProjectFees');
    const totalOngoingElement = document.getElementById('totalOngoing');
    
    if (totalProjectFeesElement) {
        totalProjectFeesElement.innerHTML = `<strong>$${totalProjectFees.toLocaleString()}</strong>`;
    }
    if (totalOngoingElement) {
        totalOngoingElement.innerHTML = `<strong>$${totalUAFees.toLocaleString()}</strong>`;
    }
    
    // Actualizar progress bar (usar UA Fees)
    updateProgress();
    markChangesForSaving();
    
    console.log(`📊 Ongoing updated: Project Fees: $${totalProjectFees.toLocaleString()}, UA Fees: $${totalUAFees.toLocaleString()}`);
}


// === ROW MANAGEMENT FUNCTIONS ===
function addPipelineRow() {
    const tbody = document.querySelector('#pipelineTable tbody');
    if (!tbody) return;
    
    const totalRow = tbody.querySelector('.total-row');
    const existingRows = tbody.querySelectorAll('tr:not(.total-row)');
    const nextNumber = existingRows.length + 1;
    const newRow = document.createElement('tr');
    
    newRow.innerHTML = `
        <td>${nextNumber}</td>
        <td><input type="text" class="editable" value="New Project" onchange="updatePipeline()"></td>
        <td><select class="editable" onchange="updatePipeline()">
            <option value="AI">AI</option>
            <option value="Demand Modeling">Demand Modeling</option>
            <option value="BigData">BigData</option>
            <option value="Urban Analytics" selected>Urban Analytics</option>
            <option value="Financial Modeling">Financial Modeling</option>
        </select></td>
        <td><input type="text" class="editable" value="New Client" onchange="updatePipeline()"></td>
        <td><select class="editable" onchange="updatePipelineLeadAnalysis()">
            <option value="Octavio">Octavio</option>
            <option value="Roberto">Roberto</option>
            <option value="Noé">Noé</option>
            <option value="Ricardo">Ricardo</option>
        </select></td>
        <td><select class="editable" onchange="updatePipelineLeadAnalysis()">
            <option value="None" selected>None</option>
            <option value="Octavio">Octavio</option>
            <option value="Roberto">Roberto</option>
            <option value="Noé">Noé</option>
            <option value="Ricardo">Ricardo</option>
        </select></td>
        <td><input type="date" class="editable date-input" value="2025-12-31" onchange="updatePipeline()"></td>
        <td><input type="number" class="editable amount-input" value="0" onchange="updatePipeline()"></td>
        <td><input type="number" class="editable probability-input" value="0" min="0" max="100" onchange="updatePipeline()"></td>
        <td class="weighted-value">$0</td>
        <td><button class="delete-button" onclick="deleteRow(this)">Delete</button></td>
    `;
    
    if (totalRow) {
        tbody.insertBefore(newRow, totalRow);
    } else {
        tbody.appendChild(newRow);
    }
    
    // Setup event listeners for the new row
    setupRowEventListeners(newRow);
    updatePipeline();
}

function addEOIRow() {
    const tbody = document.querySelector('#eoiTable tbody');
    if (!tbody) return;
    
    const existingRows = tbody.querySelectorAll('tr');
    const nextNumber = existingRows.length + 1;
    const newRow = document.createElement('tr');
    
    newRow.innerHTML = `
        <td>${nextNumber}</td>
        <td><input type="text" class="editable" value="New EOI Project"></td>
        <td><input type="text" class="editable" value="New Client"></td>
        <td><select class="editable">
            <option value="Octavio">Octavio</option>
            <option value="Roberto">Roberto</option>
            <option value="Noé">Noé</option>
            <option value="Ricardo">Ricardo</option>
        </select></td>
        <td><select class="editable">
            <option value="None" selected>None</option>
            <option value="Octavio">Octavio</option>
            <option value="Roberto">Roberto</option>
            <option value="Noé">Noé</option>
            <option value="Ricardo">Ricardo</option>
        </select></td>
        <td><input type="date" class="editable date-input" value="2025-12-31"></td>
        <td><input type="text" class="editable" value="Additional information" style="min-width: 200px;"></td>
        <td><button class="delete-button" onclick="deleteRow(this)">Delete</button></td>
    `;
    
    tbody.appendChild(newRow);
    setupRowEventListeners(newRow);
    markChangesForSaving();
}

function addOngoingRow() {
    const tbody = document.querySelector('#ongoingTable tbody');
    if (!tbody) return;
    
    const totalRow = tbody.querySelector('.total-row');
    const existingRows = tbody.querySelectorAll('tr:not(.total-row)');
    const nextNumber = existingRows.length + 1;
    const newRow = document.createElement('tr');
    
    newRow.innerHTML = `
        <td>${nextNumber}</td>
        <td><input type="text" class="editable" value="New Project" onchange="updateOngoing()"></td>
        <td><input type="text" class="editable" value="New Client" onchange="updateOngoing()"></td>
        <td><input type="date" class="editable date-input" value="2025-12-31" onchange="updateOngoing()"></td>
        <td><input type="text" class="editable bst-input" value="BST00${nextNumber}" placeholder="BST Code" onchange="updateOngoing()"></td>
        <td><input type="number" class="editable amount-input" value="0" onchange="updateOngoing()" placeholder="Project Fees"></td>
        <td><input type="number" class="editable amount-input ua-fees-input" value="0" onchange="updateOngoing()" placeholder="UA Fees"></td>
        <td><select class="editable" onchange="updateOngoing()">
            <option value="In Progress" selected>In Progress</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
        </select></td>
        <td><button class="delete-button" onclick="deleteRow(this)">Delete</button></td>
    `;
    
    if (totalRow) {
        tbody.insertBefore(newRow, totalRow);
    } else {
        tbody.appendChild(newRow);
    }
    
    setupRowEventListeners(newRow);
    updateOngoing();
}

function addLostRow() {
    const tbody = document.querySelector('#lostTable tbody');
    if (!tbody) return;
    
    const totalRow = tbody.querySelector('.total-row');
    const existingRows = tbody.querySelectorAll('tr:not(.total-row)');
    const nextNumber = existingRows.length + 1;
    const newRow = document.createElement('tr');
    
    newRow.innerHTML = `
        <td>${nextNumber}</td>
        <td><input type="text" class="editable" value="New Lost Project"></td>
        <td><input type="text" class="editable" value="New Client"></td>
        <td><select class="editable">
            <option value="Octavio">Octavio</option>
            <option value="Roberto">Roberto</option>
            <option value="Noé">Noé</option>
            <option value="Ricardo">Ricardo</option>
        </select></td>
        <td><select class="editable">
            <option value="None" selected>None</option>
            <option value="Octavio">Octavio</option>
            <option value="Roberto">Roberto</option>
            <option value="Noé">Noé</option>
            <option value="Ricardo">Ricardo</option>
        </select></td>
        <td><input type="date" class="editable date-input" value="2025-06-05"></td>
        <td><input type="number" class="editable amount-input" value="0" onchange="updateLost()"></td>
        <td><select class="editable" onchange="updateLossAnalysis()">
            <option value="Price">Price</option>
            <option value="Technical">Technical</option>
            <option value="Price/Technical">Price/Technical</option>
            <option value="Deadline">Deadline</option>
            <option value="Corruption">Corruption</option>
            <option value="Lack of Funds">Lack of Funds</option>
            <option value="Political Environment">Political Environment</option>
            <option value="Client Stepback">Client Stepback</option>
            <option value="Administrative Issues">Administrative Issues</option>
            <option value="Decided not to go">Decided not to go</option>
            <option value="Others" selected>Others</option>
        </select></td>
        <td><input type="text" class="editable" value="Unknown"></td>
        <td><button class="delete-button" onclick="deleteRow(this)">Delete</button></td>
    `;
    
    if (totalRow) {
        tbody.insertBefore(newRow, totalRow);
    } else {
        tbody.appendChild(newRow);
    }
    
    setupRowEventListeners(newRow);
    updateLost();
}

function deleteRow(button) {
    const row = button.closest('tr');
    if (row) {
        const table = row.closest('table');
        row.remove();
        
        // Renumber rows in the table
        if (table) {
            const tbody = table.querySelector('tbody');
            const rows = tbody.querySelectorAll('tr:not(.total-row)');
            rows.forEach((row, index) => {
                const firstCell = row.querySelector('td');
                if (firstCell && !isNaN(firstCell.textContent)) {
                    firstCell.textContent = index + 1;
                }
            });
        }
        
        // Update calculations
        updatePipeline();
        updateOngoing();
        updateLost();
        markChangesForSaving();
    }
}

// === EVENT LISTENERS SETUP ===
function setupRowEventListeners(row) {
    const inputs = row.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('input', markChangesForSaving);
        input.addEventListener('change', markChangesForSaving);
    });
}

function setupAllEventListeners() {
    console.log('🔧 Setting up event listeners for all existing rows...');
    
    // Setup for all table rows
    const allRows = document.querySelectorAll('#pipelineTable tbody tr, #eoiTable tbody tr, #ongoingTable tbody tr, #lostTable tbody tr');
    allRows.forEach(row => {
        if (!row.classList.contains('total-row')) {
            setupRowEventListeners(row);
        }
    });
    
    // Setup for checkboxes
    const checkboxes = document.querySelectorAll('.tactic-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', markChangesForSaving);
    });
    
    // Setup for evaluation inputs
    const evaluationInputs = document.querySelectorAll('.weight-input, .score-input, #opportunityName');
    evaluationInputs.forEach(input => {
        input.addEventListener('input', markChangesForSaving);
        input.addEventListener('change', markChangesForSaving);
    });
    
    console.log('✅ Event listeners setup complete');
}

// === EVALUATION FUNCTIONS ===
function calculateScore() {
    const items = document.querySelectorAll('.evaluation-item');
    let totalWeightedScore = 0;
    let totalWeight = 0;

    items.forEach(item => {
        const weightInput = item.querySelector('.weight-input');
        const scoreInput = item.querySelector('.score-input');
        
        if (weightInput && scoreInput) {
            const weight = parseFloat(weightInput.value) || 0;
            const score = parseFloat(scoreInput.value) || 0;
            
            totalWeightedScore += (weight * score);
            totalWeight += weight;
        }
    });

    const totalWeightElement = document.getElementById('totalWeight');
    if (totalWeightElement) {
        totalWeightElement.textContent = totalWeight;
    }
    
    const finalScore = totalWeight > 0 ? (totalWeightedScore / totalWeight).toFixed(2) : 0;
    const finalScoreElement = document.getElementById('finalScore');
    if (finalScoreElement) {
        finalScoreElement.textContent = finalScore;
    }

    const recommendationElement = document.getElementById('recommendation');
    const containerElement = document.getElementById('finalScoreContainer');
    
    if (containerElement) {
        containerElement.classList.remove('score-go', 'score-conditional', 'score-no-go');
        
        if (finalScore >= 7.5) {
            if (recommendationElement) {
                recommendationElement.textContent = "GO - Excellent opportunity with strong alignment";
            }
            containerElement.classList.add('score-go');
        } else if (finalScore >= 6.0) {
            if (recommendationElement) {
                recommendationElement.textContent = "CONDITIONAL GO - Good opportunity worth pursuing with some considerations";
            }
            containerElement.classList.add('score-conditional');
        } else {
            if (recommendationElement) {
                recommendationElement.textContent = "NO GO - High risk, poor alignment";
            }
            containerElement.classList.add('score-no-go');
        }
    }
    
    markChangesForSaving();
}

function saveEvaluation() {
    const opportunityNameElement = document.getElementById('opportunityName');
    const finalScoreElement = document.getElementById('finalScore');
    const totalWeightElement = document.getElementById('totalWeight');
    
    const opportunityName = opportunityNameElement ? opportunityNameElement.value : 'Unknown';
    const finalScore = finalScoreElement ? finalScoreElement.textContent : '0';
    const totalWeight = totalWeightElement ? totalWeightElement.textContent : '0';
    
    alert(`Evaluation for "${opportunityName}" saved successfully!\nFinal Score: ${finalScore}/10\nTotal Weight: ${totalWeight}%`);
    markChangesForSaving();
}

function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Get opportunity data
    const opportunityName = document.getElementById('opportunityName').value || 'Unknown Opportunity';
    const finalScore = document.getElementById('finalScore').textContent || '0';
    const totalWeight = document.getElementById('totalWeight').textContent || '0';
    const recommendation = document.getElementById('recommendation').textContent || 'No recommendation';
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(255, 102, 0);
    doc.text('Go/No Go Opportunity Evaluation', 20, 30);
    doc.setFontSize(14);
    doc.setTextColor(255, 102, 0);
    doc.text('Urban Analytics Mexico Practice Group', 20, 45);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 60);
    
    // Opportunity Info
    doc.setFontSize(14);
    doc.setTextColor(255, 102, 0);
    doc.text('Opportunity Information', 20, 80);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Opportunity Name: ${opportunityName}`, 20, 95);
    
    // Evaluation Results
    doc.setFontSize(14);
    doc.setTextColor(255, 102, 0);
    doc.text('Evaluation Results', 20, 115);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Final Score: ${finalScore}/10`, 20, 130);
    doc.text(`Total Weight: ${totalWeight}%`, 20, 140);
    doc.text(`Recommendation: ${recommendation}`, 20, 150);
    
    // Save the PDF
    const fileName = `GoNoGo_Evaluation_UrbanAnalyticsMX_${opportunityName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

// === MINUTES FUNCTIONS ===
function updateCharCounter(member) {
    const textarea = document.getElementById(`${member}-input`);
    const counter = document.getElementById(`${member}-counter`);
    const currentLength = textarea.value.length;
    const maxLength = textarea.maxLength;
    
    counter.textContent = `${currentLength}/${maxLength}`;
    
    if (currentLength > maxLength * 0.9) {
        counter.style.color = '#dc3545';
    } else if (currentLength > maxLength * 0.7) {
        counter.style.color = '#ffc107';
    } else {
        counter.style.color = '#6c757d';
    }
}

function getCurrentWeek() {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1));
    const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 7));
    
    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    };
    
    return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;
}

function saveAllMinutes() {
    const members = ['octavio', 'roberto', 'noe', 'ricardo'];
    const memberNames = {
        'octavio': 'Octavio Jiménez',
        'roberto': 'Roberto Ascencio', 
        'noe': 'Noé Osorio',
        'ricardo': 'Ricardo Sánchez'
    };
    
    const currentDate = new Date().toLocaleDateString('en-GB');
    const logContainer = document.getElementById('minutesLog');
    let hasNewEntries = false;
    
    // Remove placeholder if it exists
    const placeholder = logContainer.querySelector('.log-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    members.forEach(member => {
        const textarea = document.getElementById(`${member}-input`);
        const content = textarea.value.trim();
        
        if (content) {
            hasNewEntries = true;
            
            // Create new log entry element
            const entryDiv = document.createElement('div');
            entryDiv.className = 'log-entry';
            entryDiv.innerHTML = `
                <div class="log-entry-header">${memberNames[member]} ${currentDate}</div>
                <div class="log-entry-separator">${''.padEnd(50, '-')}</div>
                <div class="log-entry-content">${content.split('\n').map((line, index) => 
                    line.trim() ? `${index + 1}. ${line.trim()}` : ''
                ).filter(line => line).join('\n')}</div>
            `;
            
            // Insert at the beginning of the log
            logContainer.insertBefore(entryDiv, logContainer.firstChild);
            
            // Clear the textarea
            textarea.value = '';
            updateCharCounter(member);
        }
    });
    
    if (hasNewEntries) {
        alert('Weekly minutes saved successfully!');
        markChangesForSaving();
    } else {
        alert('No content to save. Please enter progress for at least one team member.');
    }
}

function clearMinutesLog() {
    if (confirm('Are you sure you want to clear all minutes logs? This action cannot be undone.')) {
        const logContainer = document.getElementById('minutesLog');
        logContainer.innerHTML = `
            <div class="log-placeholder">
                <p>📅 Weekly minutes will appear here once saved.</p>
                <p>Each entry includes date, team member, and their weekly progress bullets.</p>
            </div>
        `;
        alert('Minutes log cleared successfully!');
        markChangesForSaving();
    }
}

function exportMinutesLog() {
    const logContainer = document.getElementById('minutesLog');
    const entries = logContainer.querySelectorAll('.log-entry');
    
    if (entries.length === 0) {
        alert('No minutes to export. Please save some entries first.');
        return;
    }
    
    let exportContent = 'URBAN ANALYTICS MEXICO - WEEKLY MINUTES LOG\n';
    exportContent += '='.repeat(60) + '\n\n';
    
    entries.forEach(entry => {
        const header = entry.querySelector('.log-entry-header').textContent;
        const content = entry.querySelector('.log-entry-content').textContent;
        exportContent += `${header}\n`;
        exportContent += '-'.repeat(50) + '\n';
        exportContent += `${content}\n\n`;
    });
    
    // Create and download file
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UrbanAnalyticsMX_WeeklyMinutes_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// === INTEGRATION WITH STORAGE SYSTEM ===
function markChangesForSaving() {
    if (!isInitializing && typeof urbanAnalyticsStorage !== 'undefined') {
        urbanAnalyticsStorage.markUnsavedChanges();
    }
}

// === MAIN INITIALIZATION ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Urban Analytics Dashboard...');
    
    // Set initializing flag
    isInitializing = true;
    
    // Initialize basic components
    updateProgress();
    updatePipeline();
    updateOngoing();
    updateLost();
    updatePipelineLeadAnalysis();
    calculateScore();
    updateCompletionIndicator();
    
    // Initialize current week display
    const currentWeekElement = document.getElementById('currentWeek');
    if (currentWeekElement) {
        currentWeekElement.textContent = getCurrentWeek();
    }
    
    // Setup event listeners after a delay to ensure DOM is ready
    setTimeout(() => {
        setupAllEventListeners();
        isInitializing = false;
        console.log('✅ Urban Analytics Dashboard initialized');
    }, 1000);
});

// === UTILITY FUNCTIONS ===
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

// === FUNCIÓN PARA EXPORTAR PIPELINE A CSV ===

function exportPipelineToCSV() {
    console.log('📊 Iniciando exportación de Pipeline a CSV...');
    
    try {
        // Generar contenido CSV
        let csvContent = '';
        
        // Header del archivo
        csvContent += generateCSVHeader();
        
        // Sección 1: Current Proposal Pipeline
        csvContent += generateCurrentPipelineCSV();
        
        // Sección 2: EOI Opportunities  
        csvContent += generateEOICSV();
        
        // Sección 3: Ongoing Projects
        csvContent += generateOngoingCSV();
        
        // Sección 4: Lost Opportunities
        csvContent += generateLostOpportunitiesCSV();
        
        // Footer con estadísticas
        csvContent += generateCSVFooter();
        
        // Descargar archivo
        downloadCSV(csvContent, `Urban_Analytics_Pipeline_${getCurrentDateString()}.csv`);
        
        // Mostrar notificación de éxito
        showExportNotification('✅ Pipeline data exported successfully!');
        console.log('✅ Exportación CSV completada');
        
    } catch (error) {
        console.error('❌ Error exportando CSV:', error);
        showExportNotification('❌ Error exporting data: ' + error.message, 'error');
    }
}

// === GENERAR HEADER DEL CSV ===
function generateCSVHeader() {
    const currentDate = new Date().toLocaleString('en-US');
    const teamCost = document.getElementById('teamCost')?.value || '240000';
    const target = document.getElementById('targetAmount')?.value || '300000';
    
    return `Urban Analytics Mexico - Project Pipeline Export
Generated on: ${currentDate}
Team Cost: $${parseInt(teamCost).toLocaleString()}
Revenue Target: $${parseInt(target).toLocaleString()}

========================================

`;
}

// === GENERAR CURRENT PIPELINE CSV ===
function generateCurrentPipelineCSV() {
    console.log('📋 Extrayendo Current Pipeline...');
    
    let csv = `CURRENT PROPOSAL PIPELINE
#,Project,Topic,Client,Lead,Support,Date,Price (USD),Probability (%),Weighted Value (USD)
`;
    
    const rows = document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)');
    let totalAmount = 0;
    let totalWeighted = 0;
    
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 10) {
            const project = escapeCSV(cells[1].querySelector('input')?.value || '');
            const topic = escapeCSV(cells[2].querySelector('select')?.value || '');
            const client = escapeCSV(cells[3].querySelector('input')?.value || '');
            const lead = escapeCSV(cells[4].querySelector('select')?.value || '');
            const support = escapeCSV(cells[5].querySelector('select')?.value || '');
            const date = cells[6].querySelector('input')?.value || '';
            const price = parseFloat(cells[7].querySelector('input')?.value) || 0;
            const probability = parseFloat(cells[8].querySelector('input')?.value) || 0;
            const weighted = (price * probability) / 100;
            
            csv += `${index + 1},"${project}","${topic}","${client}","${lead}","${support}",${date},${price},${probability},${weighted.toFixed(2)}
`;
            
            totalAmount += price;
            totalWeighted += weighted;
        }
    });
    
    // Totales
    csv += `TOTAL,,,,,,,$${totalAmount.toLocaleString()},,${totalWeighted.toFixed(2)}

`;
    
    console.log(`📊 Current Pipeline: ${rows.length} proyectos, $${totalAmount.toLocaleString()} total`);
    return csv;
}

// === GENERAR EOI CSV ===
function generateEOICSV() {
    console.log('📋 Extrayendo EOI Opportunities...');
    
    let csv = `EOI'S AND LEADS (NO FEE)
#,Project,Client,Lead,Support,Date,Other
`;
    
    const rows = document.querySelectorAll('#eoiTable tbody tr');
    
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 7) {
            const project = escapeCSV(cells[1].querySelector('input')?.value || '');
            const client = escapeCSV(cells[2].querySelector('input')?.value || '');
            const lead = escapeCSV(cells[3].querySelector('select')?.value || '');
            const support = escapeCSV(cells[4].querySelector('select')?.value || '');
            const date = cells[5].querySelector('input')?.value || '';
            const other = escapeCSV(cells[6].querySelector('input')?.value || '');
            
            csv += `${index + 1},"${project}","${client}","${lead}","${support}",${date},"${other}"
`;
        }
    });
    
    csv += `
`;
    console.log(`📊 EOI: ${rows.length} oportunidades`);
    return csv;
}

// === GENERAR ONGOING CSV ===
function generateOngoingCSV() {
    console.log('📋 Extrayendo Ongoing Projects...');
    
    let csv = `ONGOING PROJECTS
#,Project,Client,Date,BST,Fees USD,UA Fees USD,Status
`;
    
    const rows = document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)');
    let totalProjectFees = 0;
    let totalUAFees = 0;
    
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
            const project = escapeCSV(cells[1].querySelector('input')?.value || '');
            const client = escapeCSV(cells[2].querySelector('input')?.value || '');
            const date = cells[3].querySelector('input')?.value || '';
            const bst = escapeCSV(cells[4].querySelector('input')?.value || '');
            const projectFees = parseFloat(cells[5].querySelector('input')?.value) || 0;
            const uaFees = parseFloat(cells[6].querySelector('input')?.value) || 0;
            const status = escapeCSV(cells[7].querySelector('select')?.value || '');
            
            csv += `${index + 1},"${project}","${client}",${date},"${bst}",${projectFees},${uaFees},"${status}"
`;
            
            totalProjectFees += projectFees;
            totalUAFees += uaFees;
        }
    });
    
    // Totales
    csv += `TOTAL,,,,,${totalProjectFees.toLocaleString()},${totalUAFees.toLocaleString()},

`;
    
    console.log(`📊 Ongoing: ${rows.length} proyectos, Project Fees: $${totalProjectFees.toLocaleString()}, UA Fees: $${totalUAFees.toLocaleString()}`);
    return csv;
}

console.log('✅ Ongoing Projects functions updated with new columns (BST, Project Fees USD, UA Fees USD)');

// === GENERAR LOST OPPORTUNITIES CSV ===
function generateLostOpportunitiesCSV() {
    console.log('📋 Extrayendo Lost Opportunities...');
    
    let csv = `LOST OPPORTUNITIES / DECIDED NOT TO GO
#,Project,Client,Lead,Support,Date Lost,Value (USD),Motive,Comments
`;
    
    const rows = document.querySelectorAll('#lostTable tbody tr:not(.total-row)');
    let totalLost = 0;
    const motiveStats = {};
    
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 9) {
            const project = escapeCSV(cells[1].querySelector('input')?.value || '');
            const client = escapeCSV(cells[2].querySelector('input')?.value || '');
            const lead = escapeCSV(cells[3].querySelector('select')?.value || '');
            const support = escapeCSV(cells[4].querySelector('select')?.value || '');
            const dateLost = cells[5].querySelector('input')?.value || '';
            const value = parseFloat(cells[6].querySelector('input')?.value) || 0;
            const motive = escapeCSV(cells[7].querySelector('select')?.value || '');
            const comments = escapeCSV(cells[8].querySelector('input')?.value || '');
            
            csv += `${index + 1},"${project}","${client}","${lead}","${support}",${dateLost},${value},"${motive}","${comments}"
`;
            
            totalLost += value;
            
            // Estadísticas por motivo
            if (!motiveStats[motive]) {
                motiveStats[motive] = { count: 0, value: 0 };
            }
            motiveStats[motive].count++;
            motiveStats[motive].value += value;
        }
    });
    
    // Total y estadísticas
    csv += `TOTAL,,,,,,$${totalLost.toLocaleString()},,

LOSS ANALYSIS BY MOTIVE
Motive,Count,Total Value (USD),Percentage
`;
    
    Object.entries(motiveStats).forEach(([motive, stats]) => {
        const percentage = totalLost > 0 ? ((stats.value / totalLost) * 100).toFixed(1) : '0';
        csv += `"${motive}",${stats.count},$${stats.value.toLocaleString()},${percentage}%
`;
    });
    
    csv += `
`;
    
    console.log(`📊 Lost: ${rows.length} oportunidades, $${totalLost.toLocaleString()} perdido`);
    return csv;
}

// === GENERAR FOOTER CON ESTADÍSTICAS ===
function generateCSVFooter() {
    // Calcular estadísticas generales
    const exercised = parseInt(document.getElementById('exercisedAmount')?.value) || 0;
    const backlog = parseInt(document.getElementById('backlogAmount')?.value) || 0;
    const potential = parseInt(document.getElementById('potentialAmount')?.value) || 0;
    const target = parseInt(document.getElementById('targetAmount')?.value) || 300000;
    const teamCost = parseInt(document.getElementById('teamCost')?.value) || 240000;
    
    const gapTarget = target - (exercised + backlog + potential);
    const gapTeamCost = teamCost - (exercised + backlog + potential);
    
    return `========================================
SUMMARY STATISTICS
Exercised Revenue: $${exercised.toLocaleString()}
Backlog Revenue: $${backlog.toLocaleString()}
Potential Revenue: $${potential.toLocaleString()}
Total Pipeline: $${(exercised + backlog + potential).toLocaleString()}

Target Gap: $${gapTarget.toLocaleString()}
Team Cost Gap: $${gapTeamCost.toLocaleString()}

Target Achievement: ${((exercised + backlog + potential) / target * 100).toFixed(1)}%
Team Cost Coverage: ${((exercised + backlog + potential) / teamCost * 100).toFixed(1)}%

Generated by Urban Analytics Mexico Dashboard
========================================
`;
}

// === FUNCIONES AUXILIARES ===

// Escapar comillas en CSV
function escapeCSV(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/"/g, '""');
}

// Obtener fecha actual formateada
function getCurrentDateString() {
    const now = new Date();
    return now.getFullYear() + 
           String(now.getMonth() + 1).padStart(2, '0') + 
           String(now.getDate()).padStart(2, '0');
}

// Descargar archivo CSV
function downloadCSV(csvContent, fileName) {
    console.log(`📥 Descargando archivo: ${fileName}`);
    
    // Crear blob con BOM para Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { 
        type: 'text/csv;charset=utf-8;' 
    });
    
    // Crear y ejecutar descarga
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Mostrar notificación de exportación
function showExportNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed; 
        top: 70px; 
        right: 20px; 
        padding: 15px 25px;
        border-radius: 8px; 
        color: white; 
        font-weight: bold; 
        z-index: 10001;
        ${type === 'success' ? 'background: #17a2b8;' : 'background: #dc3545;'}
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 4000);
}

console.log('✅ Pipeline CSV Export functions loaded successfully');

console.log('✅ Urban Analytics Dashboard script loaded successfully');
