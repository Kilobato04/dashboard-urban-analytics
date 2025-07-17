// Dashboard functionality for Urban Analytics Mexico Practice Group

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

// Progress Bar Functions
function getOngoingTotal() {
    const rows = document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)');
    let total = 0;
    rows.forEach(row => {
        const amountInput = row.querySelector('.amount-input');
        if (amountInput) {
            total += parseFloat(amountInput.value) || 0;
        }
    });
    return total;
}

function getBacklogTotal() {
    const rows = document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)');
    let total = 0;
    rows.forEach(row => {
        const amountInput = row.querySelector('.amount-input');
        const statusSelect = row.querySelector('select.editable');
        if (amountInput && statusSelect && statusSelect.value === 'In Progress') {
            total += parseFloat(amountInput.value) || 0;
        }
    });
    return total;
}

function getExercisedTotal() {
    const rows = document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)');
    let total = 0;
    rows.forEach(row => {
        const amountInput = row.querySelector('.amount-input');
        const statusSelect = row.querySelector('select.editable');
        if (amountInput && statusSelect && statusSelect.value === 'Completed') {
            total += parseFloat(amountInput.value) || 0;
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
    
    if (potentialField) {
        potentialField.value = Math.round(pipelineWeighted);
    }
    if (backlogField) {
        backlogField.value = backlogTotal;
    }
    if (exercisedField) {
        exercisedField.value = exercisedTotal;
    }
    
    const exercised = exercisedTotal;
    const backlog = backlogTotal;
    const potential = pipelineWeighted;
    const target = 300000;
    
    // Calculate gaps
    const gapTarget = target - (exercised + backlog + potential);
    const gapTeamCost = 240000 - (exercised + backlog + potential);
    
    const gapField = document.getElementById('gapAmount');
    const gapTeamCostField = document.getElementById('gapTeamCost');
    
    if (gapField) {
        gapField.value = Math.round(gapTarget);
    }
    
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

    // Calculate current month percentage based on actual date
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-based (0 = January, 11 = December)
    const currentDay = currentDate.getDate();
    const daysInMonth = new Date(currentDate.getFullYear(), currentMonth + 1, 0).getDate();
    const currentMonthPercent = ((currentMonth + (currentDay / daysInMonth)) / 12) * 100;
    
    const progressIndicator = document.getElementById('progressIndicator');
    if (progressIndicator) {
        progressIndicator.style.left = currentMonthPercent + '%';
    }
    
    // Team cost indicator
    const teamCostPercent = (240000 / target) * 100;
    const teamCostIndicator = document.getElementById('teamCostIndicator');
    if (teamCostIndicator) {
        teamCostIndicator.style.left = teamCostPercent + '%';
    }
}

// Completion Indicators
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
                    // Q2 has 2 tasks per person
                    if (quarterCheckedCount === 0) {
                        quarterIndicator.textContent = '😱';
                    } else if (quarterCheckedCount === 1) {
                        quarterIndicator.textContent = '😰';
                    } else if (quarterCheckedCount >= 2) {
                        quarterIndicator.textContent = '😊';
                    }
                } else {
                    // Q3 and Q4 have 3 tasks per person
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
                // Q2 has 2 tasks per person
                if (quarterCheckedCount >= 2) {
                    membersWithAllCompleted++;
                } else if (quarterCheckedCount > 0) {
                    membersWithSomeCompleted++;
                }
            } else {
                // Q3 and Q4 have 3 tasks per person
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
}

// Pipeline Functions
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
}

// FIXED: Pipeline Lead Analysis Function
function updatePipelineLeadAnalysis() {
    const rows = document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)');
    const teamStats = {};

    rows.forEach(row => {
        const selects = row.querySelectorAll('select.editable');
        if (selects.length >= 2) {
            const leadSelect = selects[0]; // First select is Lead
            const supportSelect = selects[1]; // Second select is Support
            
            if (leadSelect && supportSelect) {
                const lead = leadSelect.value;
                const support = supportSelect.value;
                
                // Count leads
                if (!teamStats[lead]) {
                    teamStats[lead] = { lead: 0, support: 0 };
                }
                teamStats[lead].lead++;
                
                // Count support (if not "None")
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

// Lost Opportunities Functions
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
}

function updateLossAnalysis() {
    const rows = document.querySelectorAll('#lostTable tbody tr:not(.total-row)');
    const motives = {};
    let totalValue = 0;

    rows.forEach(row => {
        const motivSelect = row.querySelector('select.editable');
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

// Ongoing Projects Functions
function updateOngoing() {
    const rows = document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)');
    let total = 0;

    rows.forEach(row => {
        const amountInput = row.querySelector('.amount-input');
        if (amountInput) {
            total += parseFloat(amountInput.value) || 0;
        }
    });

    const totalOngoingElement = document.getElementById('totalOngoing');
    if (totalOngoingElement) {
        totalOngoingElement.innerHTML = `<strong>$${total.toLocaleString()}</strong>`;
    }
    
    // Update progress bar with new status-specific amounts
    updateProgress();
}

// Row Management Functions
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
        <td><select class="editable">
            <option value="AI">AI</option>
            <option value="Demand Modeling">Demand Modeling</option>
            <option value="BigData">BigData</option>
            <option value="Urban Analytics" selected>Urban Analytics</option>
            <option value="Financial Modeling">Financial Modeling</option>
        </select></td>
        <td><input type="text" class="editable" value="New Client"></td>
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
        <td><input type="date" class="editable date-input" value="2025-12-31"></td>
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
        <td><input type="text" class="editable" value="New Project"></td>
        <td><input type="text" class="editable" value="New Client"></td>
        <td><input type="date" class="editable date-input" value="2025-12-31"></td>
        <td><input type="number" class="editable amount-input" value="0" onchange="updateOngoing()"></td>
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
        
        updatePipeline();
        updateOngoing();
        updateLost();
    }
}

// Evaluation Functions
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
}

function saveEvaluation() {
    const opportunityNameElement = document.getElementById('opportunityName');
    const finalScoreElement = document.getElementById('finalScore');
    const totalWeightElement = document.getElementById('totalWeight');
    
    const opportunityName = opportunityNameElement ? opportunityNameElement.value : 'Unknown';
    const finalScore = finalScoreElement ? finalScoreElement.textContent : '0';
    const totalWeight = totalWeightElement ? totalWeightElement.textContent : '0';
    
    alert(`Evaluation for "${opportunityName}" saved successfully!\nFinal Score: ${finalScore}/10\nTotal Weight: ${totalWeight}%\n\nNote: Server-side saving is not yet implemented. Data is stored locally only.`);
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
    doc.setTextColor(255, 102, 0); // Arcadis orange
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
    
    // Evaluation Criteria
    doc.setFontSize(14);
    doc.setTextColor(255, 102, 0);
    doc.text('Evaluation Criteria - Urban Analytics Mexico', 20, 170);
    
    // Get all evaluation items
    const items = document.querySelectorAll('.evaluation-item');
    let yPosition = 185;
    
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    items.forEach((item, index) => {
        if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
        }
        
        const criterion = item.querySelector('.criterion').textContent;
        const weight = item.querySelector('.weight-input').value;
        const score = item.querySelector('.score-input').value;
        const weightedScore = ((weight * score) / 100).toFixed(2);
        
        // Split long text if needed
        const splitText = doc.splitTextToSize(criterion, 100);
        doc.text(splitText, 20, yPosition);
        
        const textHeight = splitText.length * 4;
        doc.text(`Weight: ${weight}%`, 130, yPosition);
        doc.text(`Score: ${score}/10`, 160, yPosition);
        doc.text(`Weighted: ${weightedScore}`, 180, yPosition);
        
        yPosition += Math.max(12, textHeight + 4);
    });
    
    // Footer
    if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
    }
    
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Generated by Arcadis Practice Group Urban Analytics Mexico Dashboard', 20, yPosition + 20);
    doc.text(`Document generated on ${new Date().toLocaleString()}`, 20, yPosition + 30);
    
    // Save the PDF
    const fileName = `GoNoGo_Evaluation_UrbanAnalyticsMX_${opportunityName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

// Minutes Functions
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

function formatMinuteEntry(member, content, date) {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    let formattedContent = '';
    let bulletNumber = 1;
    
    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine) {
            formattedContent += `${bulletNumber}. ${trimmedLine}\n`;
            bulletNumber++;
        }
    });
    
    return `${member} ${date}\n${''.padEnd(50, '-')}\n${formattedContent}\n`;
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
            const formattedEntry = formatMinuteEntry(memberNames[member], content, currentDate);
            
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
        alert('Weekly minutes saved successfully!\n\nNote: Server-side saving is not yet implemented. Data is stored locally only.');
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

// Main Save Function - Only for Pipeline and Minutes
function saveData() {
    const activeTab = document.querySelector('.tab.active').textContent.trim();
    
    if (activeTab === 'Project Pipeline') {
        alert('Project Pipeline data saved successfully!\n\nNote: Server-side saving is not yet implemented. Changes are stored locally only.');
    } else if (activeTab === 'Weekly Minutes') {
        saveAllMinutes();
    } else {
        alert('Manual saving is only available for Project Pipeline and Weekly Minutes sections.\n\nNote: Server-side saving functionality is not yet implemented.');
    }
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', function() {
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
});
