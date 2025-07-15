/**
 * Main application script
 * Handles UI interactions and data display
 */

class StockDashboard {
    constructor() {
        this.currentSymbol = '';
        this.currentData = null;
        this.priceChart = null;
        this.currentTimeRange = '1D';
        
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.setupEventListeners();
        this.setupChart();
        
        // Load sample data or show welcome message
        this.showWelcomeMessage();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Stock form submission
        document.getElementById('stockForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleStockSearch();
        });

        // Time range buttons
        document.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleTimeRangeChange(e.target.dataset.range);
            });
        });

        // Export CSV button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportToCSV();
        });

        // Enter key support for stock input
        document.getElementById('stockSymbol').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleStockSearch();
            }
        });
    }

    /**
     * Setup Chart.js configuration
     */
    setupChart() {
        const ctx = document.getElementById('priceChart').getContext('2d');
        
        this.priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Price',
                    data: [],
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#007bff',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#ffffff'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#007bff',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.y;
                                return `Price: $${value.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b0b0b0'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b0b0b0',
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                onHover: (event, activeElements) => {
                    event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                }
            }
        });
    }

    /**
     * Handle stock search
     */
    async handleStockSearch() {
        const symbolInput = document.getElementById('stockSymbol');
        const symbol = symbolInput.value.trim().toUpperCase();

        if (!symbol) {
            this.showError('Please enter a stock symbol');
            return;
        }

        if (!stockAPI.validateSymbol(symbol)) {
            this.showError('Please enter a valid stock symbol (1-10 characters, alphanumeric)');
            return;
        }

        this.showLoading();
        this.hideError();

        try {
            // Fetch stock data
            const [quoteData, detailData] = await Promise.all([
                stockAPI.getStockQuote(symbol),
                stockAPI.getStockDetails(symbol)
            ]);

            this.currentSymbol = symbol;
            this.currentData = { ...quoteData, ...detailData };

            // Update UI
            this.updateStockOverview(this.currentData);
            this.updateChart(this.currentData, this.currentTimeRange);
            this.updateDataTable(this.currentData);

            // Show sections
            this.showSections();
            
        } catch (error) {
            console.error('Error fetching stock data:', error);
            this.showError(error.message || 'Failed to fetch stock data. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Handle time range change
     */
    async handleTimeRangeChange(range) {
        if (!this.currentSymbol) return;

        // Update active button
        document.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-range="${range}"]`).classList.add('active');

        this.currentTimeRange = range;
        this.showLoading();

        try {
            // Fetch historical data for the selected range
            const period = this.mapTimeRangeToPeriod(range);
            const historicalData = await stockAPI.getHistoricalData(this.currentSymbol, period);
            
            this.updateChartWithHistoricalData(historicalData, range);
        } catch (error) {
            console.error('Error fetching historical data:', error);
            this.showError('Failed to fetch historical data for the selected time range');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Map time range to Yahoo Finance period
     */
    mapTimeRangeToPeriod(range) {
        const periodMap = {
            '1D': '1d',
            '5D': '5d',
            '1M': '1mo',
            '3M': '3mo',
            '1Y': '1y'
        };
        return periodMap[range] || '1mo';
    }

    /**
     * Update stock overview section
     */
    updateStockOverview(data) {
        document.getElementById('stockName').textContent = data.longName || data.symbol;
        document.getElementById('stockPrice').textContent = stockAPI.formatCurrency(data.regularMarketPrice, data.currency);

        // Price change
        const changeElement = document.getElementById('priceChange');
        const changeValue = data.regularMarketChange;
        changeElement.textContent = (changeValue >= 0 ? '+' : '') + stockAPI.formatCurrency(changeValue, data.currency);
        changeElement.className = `metric-value ${changeValue >= 0 ? 'positive' : 'negative'}`;

        // Price change percentage
        const changePercentElement = document.getElementById('priceChangePercent');
        const changePercent = data.regularMarketChangePercent;
        changePercentElement.textContent = stockAPI.formatPercentage(changePercent);
        changePercentElement.className = `metric-value ${changePercent >= 0 ? 'positive' : 'negative'}`;

        // Volume
        document.getElementById('volume').textContent = stockAPI.formatLargeNumber(data.regularMarketVolume);

        // Market Cap
        document.getElementById('marketCap').textContent = stockAPI.formatLargeNumber(data.marketCap);
    }

    /**
     * Update chart with current data
     */
    updateChart(data, timeRange) {
        if (!data.timestamps || !data.prices) return;

        // Prepare chart data
        const labels = data.timestamps.map(timestamp => {
            const date = new Date(timestamp * 1000);
            return timeRange === '1D' ? 
                date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) :
                date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        const prices = data.prices.filter(price => price !== null);

        // Update chart
        this.priceChart.data.labels = labels;
        this.priceChart.data.datasets[0].data = prices;
        this.priceChart.data.datasets[0].label = `${data.symbol} Price`;
        this.priceChart.update();
    }

    /**
     * Update chart with historical data
     */
    updateChartWithHistoricalData(data, timeRange) {
        if (!data.timestamps || !data.prices) return;

        const labels = data.timestamps.map(timestamp => {
            const date = new Date(timestamp * 1000);
            return timeRange === '1D' ? 
                date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) :
                date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        const prices = data.prices.filter(price => price !== null);

        this.priceChart.data.labels = labels;
        this.priceChart.data.datasets[0].data = prices;
        this.priceChart.update();
    }

    /**
     * Update data table
     */
    updateDataTable(data) {
        const tbody = document.getElementById('dataTableBody');
        tbody.innerHTML = '';

        // Define table data
        const tableData = [
            { metric: 'Symbol', value: data.symbol, description: 'Stock ticker symbol' },
            { metric: 'Current Price', value: stockAPI.formatCurrency(data.regularMarketPrice, data.currency), description: 'Current market price' },
            { metric: 'Previous Close', value: stockAPI.formatCurrency(data.previousClose, data.currency), description: 'Previous trading day close price' },
            { metric: 'Change', value: stockAPI.formatCurrency(data.regularMarketChange, data.currency), description: 'Price change from previous close' },
            { metric: 'Change %', value: stockAPI.formatPercentage(data.regularMarketChangePercent), description: 'Percentage change from previous close' },
            { metric: 'Volume', value: stockAPI.formatLargeNumber(data.regularMarketVolume), description: 'Number of shares traded' },
            { metric: 'Market Cap', value: stockAPI.formatLargeNumber(data.marketCap), description: 'Total market value of shares' },
            { metric: 'Exchange', value: data.exchangeName || 'N/A', description: 'Stock exchange' },
            { metric: 'Currency', value: data.currency || 'USD', description: 'Trading currency' }
        ];

        // Add additional data if available
        if (data.summaryDetail) {
            const summary = data.summaryDetail;
            if (summary.dayHigh) {
                tableData.push({ metric: 'Day High', value: stockAPI.formatCurrency(summary.dayHigh.raw, data.currency), description: "Today's highest price" });
            }
            if (summary.dayLow) {
                tableData.push({ metric: 'Day Low', value: stockAPI.formatCurrency(summary.dayLow.raw, data.currency), description: "Today's lowest price" });
            }
            if (summary.fiftyTwoWeekHigh) {
                tableData.push({ metric: '52W High', value: stockAPI.formatCurrency(summary.fiftyTwoWeekHigh.raw, data.currency), description: '52-week high price' });
            }
            if (summary.fiftyTwoWeekLow) {
                tableData.push({ metric: '52W Low', value: stockAPI.formatCurrency(summary.fiftyTwoWeekLow.raw, data.currency), description: '52-week low price' });
            }
        }

        if (data.defaultKeyStatistics) {
            const stats = data.defaultKeyStatistics;
            if (stats.trailingPE) {
                tableData.push({ metric: 'P/E Ratio', value: stats.trailingPE.raw.toFixed(2), description: 'Price-to-earnings ratio' });
            }
            if (stats.dividendYield) {
                tableData.push({ metric: 'Dividend Yield', value: stockAPI.formatPercentage(stats.dividendYield.raw * 100), description: 'Annual dividend yield' });
            }
        }

        // Populate table
        tableData.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="fw-bold">${item.metric}</td>
                <td>${item.value}</td>
                <td class="text-muted">${item.description}</td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Export data to CSV
     */
    exportToCSV() {
        if (!this.currentData) {
            this.showError('No data available to export');
            return;
        }

        const tableRows = document.querySelectorAll('#dataTable tbody tr');
        const csvData = [];

        // Add header
        csvData.push(['Metric', 'Value', 'Description']);

        // Add data rows
        tableRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            csvData.push([
                cells[0].textContent.trim(),
                cells[1].textContent.trim(),
                cells[2].textContent.trim()
            ]);
        });

        // Convert to CSV string
        const csvContent = Papa.unparse(csvData);

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${this.currentSymbol}_stock_data_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Show loading indicator
     */
    showLoading() {
        document.getElementById('loadingIndicator').classList.remove('d-none');
        document.getElementById('searchBtn').disabled = true;
        document.getElementById('searchBtn').innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        document.getElementById('loadingIndicator').classList.add('d-none');
        document.getElementById('searchBtn').disabled = false;
        document.getElementById('searchBtn').innerHTML = '<i class="fas fa-search me-2"></i>Search';
    }

    /**
     * Show error message
     */
    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorAlert').classList.remove('d-none');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    /**
     * Hide error message
     */
    hideError() {
        document.getElementById('errorAlert').classList.add('d-none');
    }

    /**
     * Show main sections
     */
    showSections() {
        document.getElementById('stockOverview').classList.remove('d-none');
        document.getElementById('chartSection').classList.remove('d-none');
        document.getElementById('dataSection').classList.remove('d-none');
        
        // Add fade-in animation
        ['stockOverview', 'chartSection', 'dataSection'].forEach(id => {
            document.getElementById(id).classList.add('fade-in');
        });
    }

    /**
     * Show welcome message
     */
    showWelcomeMessage() {
        // This could be expanded to show a welcome message or tutorial
        console.log('Stock Dashboard initialized. Enter a stock symbol to get started.');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StockDashboard();
});

// Handle window resize for chart responsiveness
window.addEventListener('resize', () => {
    if (window.stockDashboard && window.stockDashboard.priceChart) {
        window.stockDashboard.priceChart.resize();
    }
});
