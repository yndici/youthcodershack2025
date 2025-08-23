document.addEventListener('DOMContentLoaded', (event) => {
let categories = {};
let originalData = [];
window.spendingTrendChartInstance = null; 

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

// Load categories from JSON
document.getElementById('csvFile').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const response = await fetch('categories.json');
        categories = await response.json();
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (!validateCSV(results.data)) {
                    showError("Invalid CSV format. Please ensure your file has Date, Description, and Amount columns.");
                    return;
                }
                
                // Clear previous data
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
                
                // Reset file input
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
    const resetButton = document.getElementById('resetButton');
if (resetButton) {
    resetButton.addEventListener('click', () => {
        resetPage();
    });
}
// Side widget: Show total transactions on click
const transactionWidget = document.getElementById('transactionWidget');
if (transactionWidget) {
    transactionWidget.addEventListener('click', function() {
        // Use originalData if available, otherwise show 0
        const total = Array.isArray(originalData) ? originalData.length : 0;
        const resultDiv = document.getElementById('widgetResult');
        resultDiv.textContent = `Total Transactions: ${total}`;
        resultDiv.style.display = 'block';
    });
}
});

// Add these new functions
function validateCSV(data) {
    if (data.length === 0) return false;
    
    // Check if required columns exist
    const requiredColumns = ['Date', 'Description', 'Amount'];
    const headers = Object.keys(data[0]);
    return requiredColumns.every(col => headers.includes(col));
}

function showError(message) {
    // Create error element if it doesn't exist
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
    
    // Hide error after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Categorization helper
function categorizeTransaction(desc) {
    desc = desc.toLowerCase();
    for (const key in categories) {
        if (desc.includes(key)) return categories[key];
    }
    return "Other";
}


function filterByDate() {
    const startDate = new Date(document.getElementById('startDate').value + 'T00:00:00');
    const endDate = new Date(document.getElementById('endDate').value + 'T23:59:59');
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        alert('Please select valid dates');
        return;
    }

    console.log('Filtering between:', startDate, 'and', endDate); // Debug log

    const filteredData = originalData.filter(d => {
        return d.Date >= startDate && d.Date <= endDate;
    });

    console.log('Filtered data:', filteredData); // Debug log
    processCSV(filteredData);
}



// Process CSV and update dashboard
function processCSV(data) {
    
    const tableBody = document.querySelector("#previewTable tbody");
    tableBody.innerHTML = ""; // Clear previous data

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

    // Store original data first time
    if (originalData.length === 0) {
        originalData = JSON.parse(JSON.stringify(data)); // Deep copy
    }

    // Categorize transactions
    data.forEach(d => {
        const date = new Date(d.Date);
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
        d.Amount = parseFloat(d.Amount);
        d.Category = categorizeTransaction(d.Description);
        d.Date = date;
    });

    // Summary
    const totalIncome = data.filter(d => d.Amount > 0).reduce((sum,d)=>sum+d.Amount,0);
    const totalExpense = data.filter(d => d.Amount < 0).reduce((sum,d)=>sum+d.Amount,0);
    const netBalance = totalIncome + totalExpense;

    document.getElementById('incomeCard').textContent = `Income: $${totalIncome.toFixed(2)}`;
    document.getElementById('expenseCard').textContent = `Expenses: $${(-totalExpense).toFixed(2)}`;
    document.getElementById('balanceCard').textContent = `Net Balance: $${netBalance.toFixed(2)}`;

    // Pie chart
    const categoryTotals = {};
    data.filter(d => d.Amount < 0).forEach(d => {
        categoryTotals[d.Category] = (categoryTotals[d.Category] || 0) + Math.abs(d.Amount);
    });

    const ctx = document.getElementById('pieChart').getContext('2d');
    if (window.pieChartInstance) window.pieChartInstance.destroy(); // clear old chart

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
                        size: 14 // Increased font size
                    }
                }
            }
        }
        }
    });

    // Table preview
    const tbody = document.querySelector("#previewTable tbody");
    tbody.innerHTML = "";
    data.slice(0, 20).forEach(d => {
        const formattedDate = d.Date.toLocaleDateString();
        const row = `<tr><td>${formattedDate}</td><td>${d.Description}</td><td>$${Math.abs(d.Amount).toFixed(2)}</td><td>${d.Category}</td></tr>`;
        tbody.innerHTML += row;
    });
    const trendData = analyzeSpendingTrends(data);
if (trendData) {
    renderTrendChart(trendData);
}
}

document.addEventListener('keydown', function(event) {
    if (event.key.toLowerCase() === 'r') {
        resetPage();
    }
});

function analyzeSpendingTrends(data) {
    const monthlyTotals = {};
    const monthlyIncome = {};

    data.forEach(d => {
        const month = d.Date.toISOString().substring(0, 7);
        if (d.Amount < 0) {
            monthlyTotals[month] = (monthlyTotals[month] || 0) + Math.abs(d.Amount);
        } else {
            monthlyIncome[month] = (monthlyIncome[month] || 0) + d.Amount;
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

    // This gets the most recent month from your data, which is correct
    const currentMonth = months[months.length - 1]; 
    const currentMonthExpense = monthlyTotals[currentMonth] || 0;

    let insightMessage = '';
    if (currentMonthExpense > averageMonthlyExpense) {
        insightMessage = `Spending more than average this month: $${currentMonthExpense.toFixed(2)} vs $${averageMonthlyExpense.toFixed(2)}. Keep an eye on your budget!`;
    } else if (currentMonthExpense < averageMonthlyExpense) {
        insightMessage = `Spending less than average this month: $${currentMonthExpense.toFixed(2)} vs $${averageMonthlyExpense.toFixed(2)}. Great job!`;
    } else {
        insightMessage = `You are currently on track with your monthly average spending ($${averageMonthlyExpense.toFixed(2)}).`;
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

function renderTrendChart(chartData) {
    const ctx = document.getElementById('spendingTrendChart').getContext('2d');
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
        backgroundColor: '#fd0037ff', // This color makes the bars visible
        borderColor: '#fd0037ff',
        borderWidth: 1,
        order: 2 // This ensures the bars are drawn behind the average line
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
        order: 1 // This ensures the line is drawn on top
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
                                // Format the amount as currency
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

function resetPage() {
    // Reset all data
    originalData = [];
    
    // Clear and hide chart
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

    // Hide summary cards section
    const summaryCards = document.querySelector('.summary-cards');
    if (summaryCards) {
        summaryCards.style.display = 'none';
    }

    // Hide table section
    const tableSection = document.querySelector('.preview-table-section');
    if (tableSection) {
        tableSection.style.display = 'none';
    }

    // Reset summary card values
    document.getElementById('incomeCard').textContent = 'Income: $0.00';
    document.getElementById('expenseCard').textContent = 'Expenses: $0.00';
    document.getElementById('balanceCard').textContent = 'Net Balance: $0.00';

    // Reset file input
    document.getElementById('csvFile').value = '';

    // Reset date filters
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';

    // Clear error message if present
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.style.display = 'none';    
    }

    // Clear and hide trend chart
    if (window.spendingTrendChartInstance) {
    window.spendingTrendChartInstance.destroy();
    window.spendingTrendChartInstance = null;
    }
}
});