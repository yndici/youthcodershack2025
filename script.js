let categories = {};
let originalData = [];
let currentCurrency = 'USD';
let exchangeRates = {};
let currentSort = { column: 'Date', direction: 'desc' };
let currentlyEditingGoalId = null; 
let spendingTrendChartInstance = null; 
let ruleChartInstance = null;

// load everything when page loads
document.addEventListener('DOMContentLoaded', async (event) => {

    // dom elements for tab switching
    const goalsTab = document.getElementById('goals-tab');
    const analysisTab = document.getElementById('analysis-tab');
    const goalsView = document.getElementById('goals-view');
    const analysisView = document.getElementById('analysis-view');

    // goal form elements
    const showGoalFormButton = document.getElementById('showGoalFormButton');
    const goalCreationForm = document.getElementById('goalCreationForm');
    const cancelGoalFormButton = document.getElementById('cancelGoalFormButton');
    const newGoalForm = document.getElementById('newGoalForm'); 
    
    // goal input elements for fairy real-time projection
    const targetAmountInput = document.getElementById('targetAmount');
    const targetDateInput = document.getElementById('targetDate');
    const currentSavedInput = document.getElementById('currentSaved');
    const fairyProjectionDiv = document.getElementById('fairyProjection');

    // fairy helper widget logic
    const fairy = document.getElementById('fairyHelper'); // TARGET THE CLICKABLE CONTAINER (fairyHelper)
    const fairyMessageElement = document.getElementById('fairyMessage');
    const fairyBubble = document.querySelector('.fairy-message-bubble');
    
    // toggle between recent and all transactions
    document.getElementById('recentTransactions').addEventListener('click', function() {
        this.classList.add('active');
        document.getElementById('allTransactions').classList.remove('active');
        document.querySelector('.preview-table-section h2').textContent = 'Recent Transactions';
        
        if (originalData.length > 0) {
            updateTransactionTable(originalData, true);
        }
    });

    document.getElementById('allTransactions').addEventListener('click', function() {
        this.classList.add('active');
        document.getElementById('recentTransactions').classList.remove('active');
        document.querySelector('.preview-table-section h2').textContent = 'All Transactions';
        if (originalData.length > 0) {
            updateTransactionTable(originalData, false);
        }
    });

    // sorting functions
    document.querySelectorAll('#previewTable th').forEach(header => {
        header.addEventListener('click', function() {
            const column = this.getAttribute('data-column');
            if (column) {
                if (currentSort.column === column) {
                    // Toggle direction if clicking the same column
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    // New column, set default direction
                    currentSort.column = column;
                    currentSort.direction = 'desc';
                }
            
                // Re-render table with new sort
                if (originalData.length > 0) {
                    const isRecentView = document.getElementById('recentTransactions').classList.contains('active');
                    updateTransactionTable(originalData, isRecentView);
                }
            }
        });
    });
    
    // Function to switch views
    function switchView(viewToShow) {
        goalsView.classList.remove('visible');
        goalsView.classList.add('hidden');
        analysisView.classList.remove('visible');
        analysisView.classList.add('hidden');

        goalsTab.classList.remove('active');
        analysisTab.classList.remove('active');

        if (viewToShow === 'goals') {
            goalsView.classList.remove('hidden');
            goalsView.classList.add('visible');
            goalsTab.classList.add('active');
        } else if (viewToShow === 'analysis') {
            analysisView.classList.remove('hidden');
            analysisView.classList.add('visible');
            analysisTab.classList.add('active');
        }
        if (spendingTrendChartInstance) {
                spendingTrendChartInstance.resize();
            }
        if (ruleChartInstance) {
            ruleChartInstance.resize();
        }
    }

    // initial event listeners for tabs
    goalsTab.addEventListener('click', () => {
        switchView('goals');
    });

    analysisTab.addEventListener('click', () => {
        switchView('analysis');
    });

    // dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            darkModeToggle.textContent = document.body.classList.contains('dark-mode') ? '☀️ Light Mode' : '🌙 Dark Mode';
        });
    }

    // currency selector change
    document.getElementById('currencySelect').addEventListener('change', function(e) {
        currentCurrency = e.target.value;
        if (originalData && originalData.length > 0) {
            processCSV([...originalData]); 
        }
    });

    // Define the contextual tips for the Analysis Tab
    const analysisTips = [
        "⭐ Wish Granted! Focus on categorizing transactions marked 'Unknown' first.",
        "💡 Tip: Look for patterns! Assign similar names (e.g., Amazon) to the same category.",
        "🔎 Need to track subscriptions? Create a specific category for 'Recurring' bills.",
        "📊 Use the date filters above to analyze spending month-over-month for better insights.",
    ];

    // Define general, rotational tips (for other tabs)
    const generalTips = [
        "✨ Welcome! Start by clicking 'Create New Goal' to make a financial wish.",
        "🔎 Need to check your spending? Click the 'Transaction Analysis' tab!",
        "📤 Try uploading a new CSV to see updated insights.",
        "💾 Did you know? You can export your filtered data as CSV.",
        "💰 Keep an eye on your net balance for healthy finances!"
    ];

    let generalTipIndex = 0; // Starts at the first general tip
    let analysisTipIndex = 0; // Starts at the first analysis tip


    //Checks the active tab and provides a contextually relevant tip
    function getContextualTip() {
        const analysisTab = document.getElementById('analysis-tab');
        let messageArray;
        let tipIndex;

        if (analysisTab && analysisTab.classList.contains('active')) {
            messageArray = analysisTips;
            tipIndex = analysisTipIndex;
        } 
        else {
            messageArray = generalTips;
            tipIndex = generalTipIndex;
        }

        // Get the current message
        const message = messageArray[tipIndex];
       
        const nextIndex = (tipIndex + 1) % messageArray.length;

        if (messageArray === analysisTips) {
            analysisTipIndex = nextIndex;
        } else {
            generalTipIndex = nextIndex;
        }
        
        return message;
    }
    if (fairy && fairyMessageElement && fairyBubble) { 
    
    // Set up the click handler for the fairy widget
    fairy.addEventListener('click', () => {
        
        const message = getContextualTip(); 
        
        fairyMessageElement.textContent = message;
        
        fairyBubble.classList.add('show');
        
        setTimeout(() => {
            fairyBubble.classList.remove('show');
        }, 7500); 
    });

    
    function calculateGoalMetrics(target, targetDateStr, saved) {
        const today = new Date();
        
        if (!targetDateStr) {
            return { monthlySavingsNeeded: null, monthsRemaining: null };
        }

        const targetDate = new Date(targetDateStr);

        let monthsRemaining = (targetDate.getFullYear() - today.getFullYear()) * 12;
        monthsRemaining -= today.getMonth();
        monthsRemaining += targetDate.getMonth();
        
        monthsRemaining = Math.max(1, monthsRemaining); 

        const amountLeftToSave = target - saved;
        const monthlySavingsNeeded = amountLeftToSave > 0 ? (amountLeftToSave / monthsRemaining) : 0;

        return {
            monthlySavingsNeeded: parseFloat(monthlySavingsNeeded.toFixed(2)),
            monthsRemaining: monthsRemaining
        };
    }

    function getGoals() {
        const goalsJson = localStorage.getItem('myFinFairyGoals');
        return goalsJson ? JSON.parse(goalsJson) : [];
    }

    function saveGoal(newGoal) {
        const goals = getGoals();
        goals.push(newGoal);
        localStorage.setItem('myFinFairyGoals', JSON.stringify(goals));
    }
    
    function deleteGoal(idToDelete) {
        let goals = getGoals();
        goals = goals.filter(goal => goal.id !== idToDelete);
        localStorage.setItem('myFinFairyGoals', JSON.stringify(goals));
        renderGoals(); 
    }

    function contributeToGoal(idToUpdate, amount) {
        let goals = getGoals();
        const goalIndex = goals.findIndex(goal => goal.id === idToUpdate);
        
        if (goalIndex !== -1) {
            goals[goalIndex].saved += amount;
            goals[goalIndex].saved = Math.min(goals[goalIndex].saved, goals[goalIndex].target);
            localStorage.setItem('myFinFairyGoals', JSON.stringify(goals));
            renderGoals(); 
        }
    }

    /**
     * Updates an existing goal with new data
     * @param {object} updatedGoal 
     */
    function updateGoal(updatedGoal) {
        let goals = getGoals();
        const goalIndex = goals.findIndex(goal => goal.id === updatedGoal.id);
        
        if (goalIndex !== -1) {
            const originalGoal = goals[goalIndex];
            
            goals[goalIndex] = {
                ...originalGoal, 
                ...updatedGoal, 
                // Recalculate metrics based on potentially new target/date
                ...calculateGoalMetrics(updatedGoal.target, updatedGoal.targetDate, updatedGoal.saved) 
            };
            
            localStorage.setItem('myFinFairyGoals', JSON.stringify(goals));
        }
    }

    /**
     * Loads existing goal data into the creation form for editing
     * @param {number} goalId 
     */
    function loadGoalForEditing(goalId) {
        const goals = getGoals();
        const goalToEdit = goals.find(goal => goal.id === goalId);
        
        if (goalToEdit) {
            currentlyEditingGoalId = goalId;

            document.getElementById('goalName').value = goalToEdit.name;
            document.getElementById('targetAmount').value = goalToEdit.target;
            document.getElementById('targetDate').value = goalToEdit.targetDate || '';
            document.getElementById('currentSaved').value = goalToEdit.saved;

            document.querySelector('#newGoalForm button[type="submit"]').textContent = 'Update Goal';

            document.getElementById('goalCreationForm').classList.remove('hidden');
            document.getElementById('showGoalFormButton').classList.add('hidden');
            
            updateFairyProjection();
        }
    }
    
    //Provides real-time feedback on monthly savings required.   
    function updateFairyProjection() {
        const targetAmount = parseFloat(targetAmountInput.value);
        const targetDateStr = targetDateInput.value;
        const currentSaved = parseFloat(currentSavedInput.value) || 0;

        if (!targetAmount || targetAmount <= 0) {
            fairyProjectionDiv.innerHTML = "🧚‍♀️ Enter a **Target Amount** and a **Target Date** to see your monthly savings plan!";
            return; 
        }
        
        if (!targetDateStr) {
            fairyProjectionDiv.innerHTML = "🧚‍♀️ Select a **Target Date** to calculate the monthly amount needed.";
            return;
        }

        const metrics = calculateGoalMetrics(targetAmount, targetDateStr, currentSaved);
        const monthlySaving = metrics.monthlySavingsNeeded;
        const months = metrics.monthsRemaining;

        if (monthlySaving !== null && monthlySaving > 0) {
            fairyProjectionDiv.innerHTML = `
                🧚‍♀️ To reach your goal of **$${targetAmount.toFixed(2)}** in **${months} months**, 
                you need to save **$${monthlySaving.toFixed(2)}** per month!
            `;
        } else if (monthlySaving === 0 && targetAmount > 0) {
            fairyProjectionDiv.innerHTML = "✨ You've already reached or exceeded your target! No further savings needed.";
        } else {
            fairyProjectionDiv.innerHTML = "🤔 Please select a future date to begin saving.";
        }
    }
    
    //Renders all active goals and attaches all card-level event listeners
    function renderGoals() {
        const activeGoalsList = document.getElementById('activeGoalsList');
        const goals = getGoals();

        activeGoalsList.innerHTML = '<h3>My Active Goals</h3>'; 
        
        if (goals.length === 0) {
            activeGoalsList.innerHTML += '<p class="placeholder-text">You haven\'t set any goals yet. Click "Create New Goal" above!</p>';
            return;
        }

        goals.forEach(goal => {
            const percentComplete = Math.min(100, (goal.saved / goal.target) * 100).toFixed(1);
            const status = goal.saved >= goal.target ? 'Completed' : 'Active';
            const statusClass = status === 'Completed' ? 'goal-status-complete' : 'goal-status-active';
            
            const monthlyNeedDisplay = goal.monthlySavingsNeeded 
                ? `$${goal.monthlySavingsNeeded.toFixed(2)}` 
                : 'N/A';
            
            const goalCardHtml = `
                <div class="goal-card" data-goal-id="${goal.id}">
                    <h4>${goal.name}</h4>
                    <span class="status-badge ${statusClass}">${status}</span>
                    
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${percentComplete}%;"></div>
                    </div>
                    
                    <p><strong>${percentComplete}% Complete</strong></p>
                    <p>Saved: $${goal.saved.toFixed(2)} / Target: $${goal.target.toFixed(2)}</p>
                    
                    <p class="projection-info">
                        Monthly Need: <strong>${monthlyNeedDisplay}</strong>
                        ${goal.targetDate ? `(Finish by: ${goal.targetDate})` : ''}
                    </p>
                    
                    <button class="contribute-button">Contribute</button>
                    <button class="edit-button">Edit</button>
                    <button class="delete-button">Delete</button>
                </div>
            `;
            activeGoalsList.innerHTML += goalCardHtml;
        });
        
        // Delete Listener
        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const goalId = parseInt(e.target.closest('.goal-card').dataset.goalId);
                if (confirm('Are you sure you want to delete this goal?')) {
                    deleteGoal(goalId);
                }
            });
        });

        // Contribute Listener
        document.querySelectorAll('.contribute-button').forEach(button => {
        button.addEventListener('click', (e) => {
        
        const clickedButton = e.currentTarget;
        const goalCardElement = e.target.closest('.goal-card'); 

        if (!goalCardElement) {
            console.error("Contribute button clicked outside a .goal-card element.");
            return;
        }

        const goalId = parseInt(goalCardElement.dataset.goalId); 
        
        const contributionAmountStr = prompt('Enter the amount to contribute:');
        const contributionAmount = parseFloat(contributionAmountStr);
        
        if (contributionAmount > 0) {
            contributeToGoal(goalId, contributionAmount); 
        } else if (contributionAmountStr !== null && contributionAmountStr.trim() !== "") {
            alert('Please enter a positive number.');
        }
    });
});
        
        document.querySelectorAll('.edit-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const goalId = parseInt(e.target.closest('.goal-card').dataset.goalId);
                loadGoalForEditing(goalId);
            });
        });
    }

    // -----------------------------------------------------------------------------------
    // Logic to show the form
    showGoalFormButton.addEventListener('click', () => {
        // Reset form state to "Create New Goal" mode
        currentlyEditingGoalId = null;
        newGoalForm.reset();
        document.querySelector('#newGoalForm button[type="submit"]').textContent = 'Save Goal';

        goalCreationForm.classList.remove('hidden');
        showGoalFormButton.classList.add('hidden');
        updateFairyProjection(); 
    });

    // Logic to hide the form
    cancelGoalFormButton.addEventListener('click', () => {
        // Reset global state and button text
        currentlyEditingGoalId = null;
        document.querySelector('#newGoalForm button[type="submit"]').textContent = 'Save Goal'; 

        goalCreationForm.classList.add('hidden');
        showGoalFormButton.classList.remove('hidden');
        document.getElementById('newGoalForm').reset();
    });
    
    // Real-time projection listeners on form inputs
    if (targetAmountInput && targetDateInput && currentSavedInput) {
        targetAmountInput.addEventListener('input', updateFairyProjection);
        targetDateInput.addEventListener('change', updateFairyProjection);
        currentSavedInput.addEventListener('input', updateFairyProjection);
    }
    
    // Goal Submission Handler 
    newGoalForm.addEventListener('submit', (event) => {
        event.preventDefault(); 

        const goalName = document.getElementById('goalName').value;
        const targetAmount = parseFloat(document.getElementById('targetAmount').value);
        const targetDateStr = document.getElementById('targetDate').value;
        const currentSaved = parseFloat(document.getElementById('currentSaved').value) || 0;

        if (!goalName || targetAmount <= 0) {
            alert("Please enter a valid Goal Name and Target Amount.");
            return;
        }

        const goalMetrics = calculateGoalMetrics(targetAmount, targetDateStr, currentSaved);

        const goalData = {
            name: goalName,
            target: targetAmount,
            saved: currentSaved,
            targetDate: targetDateStr,
            monthlySavingsNeeded: goalMetrics.monthlySavingsNeeded,
            monthsRemaining: goalMetrics.monthsRemaining
        };

        if (currentlyEditingGoalId) {
            // edit logic
            updateGoal({ 
                ...goalData,
                id: currentlyEditingGoalId 
            });
        } else {
            // create logic
            const newGoal = {
                ...goalData,
                id: Date.now(), 
                dateCreated: new Date().toISOString().split('T')[0],
            };
            saveGoal(newGoal);
        }

        renderGoals(); 
        
        // Clear and close the form via the cancel button's logic
        document.getElementById('cancelGoalFormButton').click(); 
    });
    // -----------------------------------------------------------------------------------

    //final intializer calls
    renderGoals(); 
    switchView('goals'); 

    document.addEventListener('DOMContentLoaded', async (event) => {

    // dom element references
    const goalsTab = document.getElementById('goals-tab');
    const analysisTab = document.getElementById('analysis-tab');
    const goalsView = document.getElementById('goals-view');
    const analysisView = document.getElementById('analysis-view');
    
    // new anlysis button
    const runAnalysisButton = document.getElementById('runAnalysisButton'); // Reference the new button
    
    // initial event listeners
    
    if (runAnalysisButton) {
        runAnalysisButton.addEventListener('click', runFullFinancialAnalysis); // Connects to function in B.1
    }

    analysisTab.addEventListener('click', () => {
        switchView('analysis');
        runFullFinancialAnalysis(); // Run analysis on tab switch
    });
        });
    };

    document.getElementById('csvFile').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const widgetResult = document.getElementById('widgetResult');
        if (widgetResult) {
            widgetResult.style.display = 'none';
        }

        try {
            const response = await fetch('categories.json');
            categories = await response.json();
            //use papa parse to read csv
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (!validateCSV(results.data)) {
                        showError("Invalid CSV format. Please ensure your file has Date, Description, and Amount columns.");
                        return;
                    }
                    
                    // clear previous data
                    originalData = [];
                    if (window.pieChartInstance) {
                        window.pieChartInstance.destroy();
                    }
                    
                    originalData = results.data.map(row => ({
                        ...row,
                        Date: new Date(row.Date),
                        Amount: parseFloat(row.Amount)
                    }));
                    
                    processCSV(originalData);
                    
                    // reset file input for uploading different files
                    e.target.value = '';
                },
                error: function(err) {
                    showError("Error parsing CSV file: " + err.message);
                    e.target.value = '';
                }
            });     
        } catch (error) {
            showError("Error loading categories: " + error.message);
            e.target.value = '';
        }

        const resetButton = document.getElementById('resetButton'); //add button to reset charts without needing to refresh
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            resetPage();
        });
    }

    //currency selector change
    document.getElementById('currencySelect').addEventListener('change', function(e) {
        currentCurrency = e.target.value;
        if (originalData.length > 0) {
            processCSV(originalData);
        }
    });

    // show all transactions widget
    const transactionWidget = document.getElementById('transactionWidget');
    if (transactionWidget) {
        transactionWidget.addEventListener('click', function() {
            const total = Array.isArray(originalData) ? originalData.length : 0;
            const resultDiv = document.getElementById('widgetResult');
            resultDiv.textContent = `Total Transactions: ${total}`;
            resultDiv.style.display = 'block';
        });
    }
    //filter by date range button
    document.getElementById('applyFilter').addEventListener('click', function() {
        const startDate = new Date(document.getElementById('startDate').value);
        const endDate = new Date(document.getElementById('endDate').value);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            showError('Please select both start and end dates');
            return;
        }

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const filteredData = originalData.filter(d => {
            const transactionDate = new Date(d.Date);
            return transactionDate >= startDate && transactionDate <= endDate;
        });

        if (filteredData.length === 0) {
            showError('No transactions found in the selected date range');
            return;
        }

        processCSV(filteredData);
    });

    //export filtered data as csv
    document.getElementById('exportCSV').addEventListener('click', function() {
        let dataToExport = [];
        const tableRows = document.querySelectorAll('#previewTable tbody tr');
        if (tableRows.length > 0) {
            tableRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                dataToExport.push({
                    Date: cells[0].textContent,
                    Description: cells[1].textContent,
                    Amount: cells[2].textContent,
                    Category: cells[3].textContent
                });
            });
        } else {
            dataToExport = originalData;
        }

        if (dataToExport.length === 0) {
            showError("No data to export!");
            return;
        }

        // csv conversion
        const csvRows = [];
        const headers = ['Date', 'Description', 'Amount', 'Category'];
        csvRows.push(headers.join(','));
        dataToExport.forEach(row => {
            const values = headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`);
            csvRows.push(values.join(','));
        });
        const csvString = csvRows.join('\n');

        //download
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'filtered_transactions.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
            });
        });

    });


//colour coded categories for pie chart
const categoryColors = {
    "Food & Drink": "#fd0037ff",    
    "Groceries": "#00ff37ff",       
    "Transport": "#00fcfcff",       
    "Shopping": "#ff0aebff",        
    "Entertainment": "#9966FF",    
    "Housing": "#f58f29ff",         
    "Utilities": "#ace91fff",
    "Travel": "#9900ffff",
    "Health": "#fffb00ff",
    "Education": "#0a791cff",      
    "Other": "#C9CBCF"           
};

// processes csv data and shows charts+everything
function processCSV(data) {
    
    currentSort = { column: 'Date', direction: 'desc' };

    const tableBody = document.querySelector("#previewTable tbody");
    tableBody.innerHTML = ""; 

    const summaryCards = document.querySelector('.summary-cards');

if (summaryCards) {
    summaryCards.style.display = 'flex';
}

const chartsSection = document.getElementById('chartsSection');
if (chartsSection) {
    chartsSection.style.display = 'block';
}

const previewTableSection = document.querySelector('.preview-table-section');
if (previewTableSection) {
    previewTableSection.style.display = 'block';
}

    // store original data first time
    if (originalData.length === 0) {
        originalData = JSON.parse(JSON.stringify(data)); 
    }

    // preprocess data
    data.forEach(d => {
        const date = new Date(d.Date);
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
        d.Amount = parseFloat(d.Amount);
        d.Category = categorizeTransaction(d.Description);
        d.Date = date;
    });
    const sortedData = sortData(data, currentSort.column, currentSort.direction);
    updateTransactionTable(sortedData, true);

    // summary cards
    const totalIncome = data.filter(d => d.Amount > 0).reduce((sum,d)=>sum+d.Amount,0);
    const totalExpense = data.filter(d => d.Amount < 0).reduce((sum,d)=>sum+d.Amount,0);
    const netBalance = totalIncome + totalExpense;

    const convertedIncome = convertAmount(totalIncome, currentCurrency);
    const convertedExpense = convertAmount(totalExpense, currentCurrency);
    const convertedBalance = convertAmount(netBalance, currentCurrency);

    document.getElementById('incomeCard').textContent = `Income: ${formatCurrency(convertedIncome, currentCurrency)}`;
    document.getElementById('expenseCard').textContent = `Expenses: ${formatCurrency(-convertedExpense, currentCurrency)}`;
    document.getElementById('balanceCard').textContent = `Net Balance: ${formatCurrency(convertedBalance, currentCurrency)}`;

    // create pie chart
    const categoryTotals = {};
    data.filter(d => d.Amount < 0).forEach(d => {
        categoryTotals[d.Category] = (categoryTotals[d.Category] || 0) + Math.abs(d.Amount);
    });

    const ctx = document.getElementById('pieChart').getContext('2d');
    if (window.pieChartInstance) window.pieChartInstance.destroy(); // clear old chart if its there

    const categories = Object.keys(categoryTotals);

    window.pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categories,
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: categories.map(category => categoryColors[category] || categoryColors["Other"]),
            }]
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
            legend: {
                position: 'right',
                labels: {
                    font: {
                        size: 14 
                    }
                }
            }
        }
        }
    });

    // make table with all transactions
    const tbody = document.querySelector("#previewTable tbody");
    tbody.innerHTML = "";
    data.slice(0, 20).forEach(d => {
        const formattedDate = d.Date.toLocaleDateString();
        const convertedAmount = convertAmount(d.Amount, currentCurrency);
        const row = `<tr><td>${formattedDate}</td><td>${d.Description}</td><td>${formatCurrency(convertedAmount, currentCurrency)}</td><td>${d.Category}</td></tr>`;
        tbody.innerHTML += row;
    });
    const trendData = analyzeSpendingTrends(data);
if (trendData) {
    renderTrendChart(trendData);
}

document.querySelector('.summary-cards').style.display = 'grid';
document.querySelector('.charts-section').style.display = 'grid';
document.querySelector('.preview-table-section').style.display = 'block';
}

//shortcut to reset page
document.addEventListener('keydown', function(event) {
    if (event.key.toLowerCase() === 'r') {
        resetPage();
    }

});
//function to add tips and insights based on spending trends
function analyzeSpendingTrends(data) {
    const monthlyTotals = {};
    const monthlyIncome = {};

    data.forEach(d => {
        const month = d.Date.toISOString().substring(0, 7);
        const convertedAmount = convertAmount(d.Amount, currentCurrency);
        if (d.Amount < 0) {
            monthlyTotals[month] = (monthlyTotals[month] || 0) + Math.abs(convertedAmount);
        } else {
            monthlyIncome[month] = (monthlyIncome[month] || 0) + convertedAmount;
        }
    });

    const allMonths = Object.keys(monthlyTotals).sort();
    const months = allMonths.slice(-12);

    if (months.length === 0) {
        const insightsCard = document.getElementById('insightsCard');
        if (insightsCard) insightsCard.textContent = "Not enough data for spending trend analysis.";
        return null;
    }

    const totalExpensesAcrossMonths = Object.values(monthlyTotals).reduce((sum, total) => sum + total, 0);
    const averageMonthlyExpense = totalExpensesAcrossMonths / allMonths.length;
    const currentMonth = months[months.length - 1];
    const currentMonthExpense = monthlyTotals[currentMonth] || 0;

    let insightMessage = '';
    if (currentMonthExpense > averageMonthlyExpense) {
        insightMessage = `Spending more than average this month: ${formatCurrency(currentMonthExpense, currentCurrency)} vs ${formatCurrency(averageMonthlyExpense, currentCurrency)}. Keep an eye on your budget!`;
    } else if (currentMonthExpense < averageMonthlyExpense) {
        insightMessage = `Spending less than average this month: ${formatCurrency(currentMonthExpense, currentCurrency)} vs ${formatCurrency(averageMonthlyExpense, currentCurrency)}. Great job!`;
    } else {
        insightMessage = `You are currently on track with your monthly average spending (${formatCurrency(averageMonthlyExpense, currentCurrency)}).`;
    }

    const insightsCard = document.getElementById('insightsCard');
    if (insightsCard) {
        insightsCard.textContent = insightMessage;
    }

    const chartLabels = months.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
    });
    const monthlyExpenseData = months.map(m => monthlyTotals[m] || 0);
    const averageLineData = months.map(() => averageMonthlyExpense);

    return {
        labels: chartLabels,
        monthlyExpenses: monthlyExpenseData,
        averageExpense: averageLineData
    };
}


//function to make chart
function renderTrendChart(chartData) {
    const ctx = document.getElementById('spendingTrendChart').getContext('2d');
    
    // clear old chart if exists
    if (window.spendingTrendChartInstance) {
        window.spendingTrendChartInstance.destroy(); 
    }

    window.spendingTrendChartInstance = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: chartData.labels, 
            datasets: [
    {
        label: 'Monthly Expenses',
        data: chartData.monthlyExpenses,
        backgroundColor: '#fd0037ff', 
        borderColor: '#fd0037ff',
        borderWidth: 1,
        order: 2 
    },
    {
        label: 'Average Monthly Expense',
        data: chartData.averageExpense,
        type: 'line',
        borderColor: '#00fcfcff',
        backgroundColor: 'rgba(0, 252, 252, 0.2)',
        fill: false,
        tension: 0.1,
        pointRadius: 3,
        borderWidth: 3,
        order: 1 
    }
]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            scales: {
                y: {
                    beginAtZero: true, 
                    title: {
                        display: true,
                        text: 'Amount ($)' 
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month' 
                    }
                }
            },
            plugins: {
                tooltip: { 
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                // format the amount as currency
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}
function updateTotalTransactionsWidget(count) {
    const resultDiv = document.getElementById('widgetResult');
    if (resultDiv) {
        resultDiv.textContent = `Total Transactions: ${count}`;
        resultDiv.style.display = 'block';
    }
}

function updateTransactionTable(data, recentOnly) {

    let sortedData = sortData(data, currentSort.column, currentSort.direction);
    

    const transactionsToShow = recentOnly ? sortedData.slice(0, 20) : sortedData;

    const headers = document.querySelectorAll('#previewTable th');
    headers.forEach(header => {
        const column = header.getAttribute('data-column');
        if (column) {
            header.innerHTML = `${header.textContent.split(' ')[0]} ${
                column === currentSort.column 
                    ? (currentSort.direction === 'asc' ? '▲' : '▼') 
                    : ''
            }`;
        }
    });

 
    const tbody = document.querySelector("#previewTable tbody");
    tbody.innerHTML = "";
    
    transactionsToShow.forEach(d => {
        const formattedDate = d.Date.toLocaleDateString();
        const convertedAmount = convertAmount(d.Amount, currentCurrency);
        const row = `<tr>
            <td>${formattedDate}</td>
            <td>${d.Description}</td>
            <td>${formatCurrency(convertedAmount, currentCurrency)}</td>
            <td>${d.Category}</td>
        </tr>`;
        tbody.innerHTML += row;
    });
}


// Define categories for 50/30/20 rule (in progress)
const ruleCategories = {
    Needs: ['Rent', 'Utilities', 'Groceries', 'Debt_Minimum'],
    Wants: ['DiningOut', 'Entertainment', 'Shopping', 'Subscriptions'],
    Savings: ['Investment', 'Retirement', 'Goal_Contribution', 'Extra_Debt'],
};

/**
 * Calculate the spending breakdown based on 50/30/20 rule
 * @param {Array} data 
 */
function calculate503020(data) {
    let totals = { Needs: 0, Wants: 0, Savings: 0, TotalSpending: 0 };

    data.forEach(transaction => {
        // Only analyze expenses (negative amounts)
        if (transaction.Amount < 0) {
            const amount = Math.abs(transaction.Amount);
            let assigned = false;

            for (const bucket in ruleCategories) {
                if (ruleCategories[bucket].includes(transaction.Category)) {
                    totals[bucket] += amount;
                    assigned = true;
                    break;
                }
            }
            if (assigned) {
                totals.TotalSpending += amount;
            }
        }
    });
    return totals;
}

/**
 * Renders the Donot Chart and provides fairy feedback.
 * @param {Object} totals 
 */
function render503020Chart(totals) {
    const ctx = document.getElementById('ruleChart').getContext('2d');
    const feedbackDiv = document.getElementById('healthFairyFeedback');
    
    const spendingData = [totals.Needs, totals.Wants, totals.Savings];
    const totalSpent = totals.TotalSpending;

    if (totalSpent === 0) {
        if (ruleChartInstance) ruleChartInstance.destroy();
        feedbackDiv.innerHTML = "🧚‍♀️ No expenses found in the current filter range to analyze your 50/30/20 split.";
        return;
    }
    
    const percentages = spendingData.map(val => ((val / totalSpent) * 100).toFixed(1));
    const dataLabels = [`Needs (${percentages[0]}%)`, `Wants (${percentages[1]}%)`, `Savings (${percentages[2]}%)`];

    // Destroy old instance if it exists
    if (window.ruleChartInstance) {
        window.ruleChartInstance.destroy();
    }

    window.ruleChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: dataLabels,
            datasets: [{
                data: spendingData,
                backgroundColor: [
                    '#00b894', //(needs)
                    '#ff7979', //(wants)
                    '#5f27cd'  //(savings)
                ],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            aspectRatio: 1, // Ensures it's circular/square
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Spending Breakdown by Financial Rule'
                }
            }
        }
    });

    // Provide Fairy Feedback
    let feedback = `Your spending is currently split: ${percentages[0]}% Needs, ${percentages[1]}% Wants, ${percentages[2]}% Savings.`;
    
    if (parseFloat(percentages[1]) > 35) {
        feedback += " The Fairy sees a little too much magic in the 'Wants' category! Try contributing more to goals.";
    } else if (parseFloat(percentages[2]) < 20) {
        feedback += " You're close! Aim to allocate a little more to the 'Savings' category to meet that 20% goal.";
    } else {
        feedback += " ✨ Your Financial Magic is balanced! Keep up the excellent work!";
    }

    feedbackDiv.innerHTML = `**${feedback}**`;
}

// analysis logic (B)
function runFullFinancialAnalysis() {
    let filteredData = window.originalData || []; 
    
    if (filteredData.length === 0) {
        document.getElementById('healthFairyFeedback').innerHTML = 
            "⚠️ Please upload transaction data first to run the analysis.";
        if (window.ruleChartInstance) {
            window.ruleChartInstance.destroy();
        }
        return;
    }

    const analysisTotals = calculate503020(filteredData);

    render503020Chart(analysisTotals);
}

function resetPage() {
    // reset data
    originalData = [];
    
    // clear all charts and containers
    if (window.pieChartInstance) {
        window.pieChartInstance.destroy();
        window.pieChartInstance = null;
    }

    const chartSection = document.querySelector('.charts-section');
    if (chartSection) {
        chartSection.style.display = 'none';
    }

    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
        chartContainer.style.display = 'none';
    }

    const summaryCards = document.querySelector('.summary-cards');
    if (summaryCards) {
        summaryCards.style.display = 'none';
    }

    const tableSection = document.querySelector('.preview-table-section');
    if (tableSection) {
        tableSection.style.display = 'none';
    }

    // reset all inputs
    document.getElementById('incomeCard').textContent = 'Income: $0.00';
    document.getElementById('expenseCard').textContent = 'Expenses: $0.00';
    document.getElementById('balanceCard').textContent = 'Net Balance: $0.00';

    document.getElementById('csvFile').value = '';

    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';

    // clear error message if present
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.style.display = 'none';    
    }

    if (window.spendingTrendChartInstance) {
    window.spendingTrendChartInstance.destroy();
    window.spendingTrendChartInstance = null;
    }

    //Hide Total Transactions widget result
    const resultDiv = document.getElementById('widgetResult');
    if (resultDiv) {
    resultDiv.style.display = 'none';
}
}

//curency exchange logic 
async function fetchExchangeRates() {
    const API_KEY = '8d2cdf7ff1da23853045b0ef';
    try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/8d2cdf7ff1da23853045b0ef/latest/USD`);
        const data = await response.json();
        if (data.result === "success") {
            exchangeRates = data.conversion_rates;
            console.log('Exchange rates loaded:', exchangeRates);
        } else {
            throw new Error('Failed to load exchange rates');
        }
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        showError('Failed to load currency conversion rates');
    }
}

function convertAmount(amount, toCurrency) {
    if (!exchangeRates || !exchangeRates[toCurrency]) {
        console.error('Exchange rates not available for', toCurrency);
        return amount;
    }
    
    if (toCurrency === 'USD') return amount;
    return amount * exchangeRates[toCurrency];
}
function formatCurrency(amount, currency) {
    const symbols = {
        'USD': '$', 'EUR': '€', 'GBP': '£',
        'CAD': 'CA$', 'AUD': 'A$', 'JPY': '¥',
        'CNY': '¥'
    };

    const symbol = symbols[currency] || '$';
    const formattedAmount = Math.abs(amount).toFixed(2);
    
    
    if (currency === 'JPY') {
        return `${symbol}${Math.round(Math.abs(amount))}`;
    }
    
    return `${symbol}${formattedAmount}`;
}

function sortData(data, column, direction) {
    return [...data].sort((a, b) => {
        let compareA = a[column];
        let compareB = b[column];

        // Handle different column types
        if (column === 'Date') {
            compareA = new Date(a.Date);
            compareB = new Date(b.Date);
        } else if (column === 'Amount') {
            compareA = parseFloat(a.Amount);
            compareB = parseFloat(b.Amount);
        }

        // Sort direction
        if (direction === 'asc') {
            return compareA > compareB ? 1 : -1;
        } else {
            return compareA < compareB ? 1 : -1;
        }
    });
}

// categorizes transaction based on keywords in description
function categorizeTransaction(desc) {
    desc = desc.toLowerCase();
    for (const key in categories) {
        if (desc.includes(key)) return categories[key];
    }
    return "Other";
}

// validates if csv file has required columns
function validateCSV(data) {
    if (data.length === 0) return false;
    
    const requiredColumns = ['Date', 'Description', 'Amount'];
    const headers = Object.keys(data[0]);
    return requiredColumns.every(col => headers.includes(col));
}

// displays error message for 5 seconds
function showError(message) {
    let errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'errorMessage';
        document.querySelector('.container').insertBefore(
            errorDiv, 
            document.querySelector('.container').firstChild
        );
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // hide error automatically after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// analyzes spending patterns and generates insights
function analyzeSpendingTrends(data) {
    const monthlyTotals = {};
    const monthlyIncome = {};

    data.forEach(d => {
        const month = d.Date.toISOString().substring(0, 7);
        const convertedAmount = convertAmount(d.Amount, currentCurrency);
        if (d.Amount < 0) {
            monthlyTotals[month] = (monthlyTotals[month] || 0) + Math.abs(convertedAmount);
        } else {
            monthlyIncome[month] = (monthlyIncome[month] || 0) + convertedAmount;
        }
    });

    const allMonths = Object.keys(monthlyTotals).sort();
    const months = allMonths.slice(-12);

    if (months.length === 0) {
        const insightsCard = document.getElementById('insightsCard');
        if (insightsCard) insightsCard.textContent = "Not enough data for spending trend analysis.";
        return null;
    }

    const totalExpensesAcrossMonths = Object.values(monthlyTotals).reduce((sum, total) => sum + total, 0);
    const averageMonthlyExpense = totalExpensesAcrossMonths / allMonths.length;
    const currentMonth = months[months.length - 1];
    const currentMonthExpense = monthlyTotals[currentMonth] || 0;

    let insightMessage = '';
    if (currentMonthExpense > averageMonthlyExpense) {
        insightMessage = `Spending more than average this month: ${formatCurrency(currentMonthExpense, currentCurrency)} vs ${formatCurrency(averageMonthlyExpense, currentCurrency)}. Keep an eye on your budget!`;
    } else if (currentMonthExpense < averageMonthlyExpense) {
        insightMessage = `Spending less than average this month: ${formatCurrency(currentMonthExpense, currentCurrency)} vs ${formatCurrency(averageMonthlyExpense, currentCurrency)}. Great job!`;
    } else {
        insightMessage = `You are currently on track with your monthly average spending (${formatCurrency(averageMonthlyExpense, currentCurrency)}).`;
    }

    const insightsCard = document.getElementById('insightsCard');
    if (insightsCard) {
        insightsCard.textContent = insightMessage;
    }

    const chartLabels = months.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
    });
    const monthlyExpenseData = months.map(m => monthlyTotals[m] || 0);
    const averageLineData = months.map(() => averageMonthlyExpense);

    return {
        labels: chartLabels,
        monthlyExpenses: monthlyExpenseData,
        averageExpense: averageLineData
    };
}

//render trend chart
function renderTrendChart(chartData) {
    const ctx = document.getElementById('spendingTrendChart').getContext('2d');
    // clear old chart if exists
    if (window.spendingTrendChartInstance) {
        window.spendingTrendChartInstance.destroy(); 
    }

    window.spendingTrendChartInstance = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: chartData.labels, 
            datasets: [
    {
        label: 'Monthly Expenses',
        data: chartData.monthlyExpenses,
        backgroundColor: '#fd0037ff', 
        borderColor: '#fd0037ff',
        borderWidth: 1,
        order: 2 
    },
    {
        label: 'Average Monthly Expense',
        data: chartData.averageExpense,
        type: 'line',
        borderColor: '#00fcfcff',
        backgroundColor: 'rgba(0, 252, 252, 0.2)',
        fill: false,
        tension: 0.1,
        pointRadius: 3,
        borderWidth: 3,
        order: 1 
    }
]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            scales: {
                y: {
                    beginAtZero: true, 
                    title: {
                        display: true,
                        text: 'Amount ($)' 
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month' 
                    }
                }
            },
            plugins: {
                tooltip: { 
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                // format the amount as currency
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    }); 
} 
