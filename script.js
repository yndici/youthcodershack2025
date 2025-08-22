
let categories = {};
let originalData = [];

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
                // Convert dates and amounts immediately
                originalData = results.data.map(row => ({
                    ...row,
                    Date: new Date(row.Date + 'T00:00:00'), // Force midnight UTC
                    Amount: parseFloat(row.Amount)
                }));
                processCSV([...originalData]); // Pass a copy
            },
            error: function(err) {
                console.error("CSV parse error:", err);
            }
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
});


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
    
    // Store original data first time
    if (originalData.length === 0) {
        originalData = JSON.parse(JSON.stringify(data)); // Deep copy
    }

    // Categorize transactions
    data.forEach(d => {
        d.Amount = parseFloat(d.Amount);
        d.Category = categorizeTransaction(d.Description);
        d.Date = new Date(d.Date);
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
    window.pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: ['#FF6384','#36A2EB','#FFCE56','#8BC34A','#FF9800','#9C27B0','#00BCD4']
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

