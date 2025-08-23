
let categories = {};
let originalData = [];

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

    document.querySelector('.summary-cards').style.display = 'flex';
    document.getElementById('chartsSection').style.display = 'block';
    document.querySelector('.preview-table-section').style.display = 'block'; 

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
        options: { responsive: true }
    });

    // Table preview
    const tbody = document.querySelector("#previewTable tbody");
    tbody.innerHTML = "";
    data.slice(0, 20).forEach(d => {
        const formattedDate = d.Date.toLocaleDateString();
        const row = `<tr><td>${formattedDate}</td><td>${d.Description}</td><td>$${Math.abs(d.Amount).toFixed(2)}</td><td>${d.Category}</td></tr>`;
        tbody.innerHTML += row;
    });
}

document.addEventListener('keydown', function(event) {
    if (event.key.toLowerCase() === 'r') {
        resetPage();
    }
});

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
}