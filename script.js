
let categories = {};
let originalData = [];
let currentCurrency = 'USD';
let exchangeRates = {};
window.spendingTrendChartInstance = null; 

document.addEventListener('DOMContentLoaded', async (event) => {
    await fetchExchangeRates();

    document.getElementById('currencySelect').addEventListener('change', function(e) {
        currentCurrency = e.target.value;
        if (originalData.length > 0) {
            processCSV([...originalData]); 
        }
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

// load categories from json file
document.getElementById('csvFile').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

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
// show all transactions widget
const transactionWidget = document.getElementById('transactionWidget');
if (transactionWidget) {
    transactionWidget.addEventListener('click', function() {
        // Try to count rows in the preview table (filtered), fallback to originalData
        let total = 0;
        const tableRows = document.querySelectorAll('#previewTable tbody tr');
        if (tableRows.length > 0) {
            total = tableRows.length;
        } else if (Array.isArray(originalData)) {
            total = originalData.length;
        }
        const resultDiv = document.getElementById('widgetResult');
        resultDiv.textContent = `Total Transactions: ${total}`;
        resultDiv.style.display = 'block';
    });
}
document.getElementById('exportCSV').addEventListener('click', function() {
    // Use the currently displayed data (filtered), or originalData if not filtered
    let dataToExport = [];
    // Try to get the data currently in the preview table
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
        // fallback: export all originalData
        dataToExport = originalData;
    }

    if (dataToExport.length === 0) {
        showError("No data to export!");
        return;
    }

    // Convert to CSV string
    const csvRows = [];
    const headers = ['Date', 'Description', 'Amount', 'Category'];
    csvRows.push(headers.join(','));
    dataToExport.forEach(row => {
        const values = headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`);
        csvRows.push(values.join(','));
    });
    const csvString = csvRows.join('\n');

    // Download as file
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

//filter by date range on button click
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

// make sure the csv has the right columns
function validateCSV(data) {
    if (data.length === 0) return false;
    
    const requiredColumns = ['Date', 'Description', 'Amount'];
    const headers = Object.keys(data[0]);
    return requiredColumns.every(col => headers.includes(col));
}

//show error message if csv is invalid
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

// categorize transactions based on description keywords
function categorizeTransaction(desc) {
    desc = desc.toLowerCase();
    for (const key in categories) {
        if (desc.includes(key)) return categories[key];
    }
    return "Other";
}

//old filter function; do not use
/*function filterByDate() {
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
}*/



//process the csv and show everything
function processCSV(data) {
    //clear all previous data
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
        originalData = JSON.parse(JSON.stringify(data)); // Deep copy
    }

    // preprocess data
    data.forEach(d => {
        const date = new Date(d.Date);
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
        d.Amount = parseFloat(d.Amount);
        d.Category = categorizeTransaction(d.Description);
        d.Date = date;
    });
    

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
}

//shortcut to reset page
document.addEventListener('keydown', function(event) {
    if (event.key.toLowerCase() === 'r') {
        resetPage();
    }

});

document.getElementById('currencySelect').addEventListener('change', function(e) {
    currentCurrency = e.target.value;
    if (originalData.length > 0) {
        processCSV(originalData);
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
const fairy = document.getElementById('fairy');
const fairyMessage = document.getElementById('fairyMessage');
const fairyBubble = document.querySelector('.fairy-message-bubble');

const messages = [
        "🌟 Try uploading a new CSV to see updated insights.",
        "💡 Tip: You can filter your transactions by date!",
        "✨ Did you know? You can export your filtered data as CSV.",
        "💸 Keep an eye on your net balance for healthy finances!"
];

let messageIndex = 0;

fairy.addEventListener('click', () => {
    // Show the message bubble
    fairyBubble.classList.add('visible');

    // Update the message
    fairyMessage.textContent = messages[messageIndex];
    
    // Cycle to the next message
    messageIndex = (messageIndex + 1) % messages.length;

    // Hide the message after a few seconds
    setTimeout(() => {
        fairyBubble.classList.remove('visible');
    }, 5000);
});

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
