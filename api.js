/**
 * Stock API Service
 * Handles all API calls to fetch stock data
 */

class StockAPI {
    constructor() {
        // Using Yahoo Finance API through RapidAPI or similar service
        this.baseURL = 'https://query1.finance.yahoo.com/v8/finance/chart';
        this.quoteURL = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';
        
        // CORS proxy for Yahoo Finance (fallback options)
        this.corsProxies = [
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://api.codetabs.com/v1/proxy?quest='
        ];
        
        this.currentProxyIndex = 0;
    }

    /**
     * Fetch stock quote data
     * @param {string} symbol - Stock symbol (e.g., 'AAPL')
     * @returns {Promise<Object>} Stock quote data
     */
    async getStockQuote(symbol) {
        try {
            const url = `${this.baseURL}/${symbol.toUpperCase()}`;
            const response = await this.makeRequest(url);
            
            if (!response.data || !response.data.chart || !response.data.chart.result) {
                throw new Error('Invalid stock symbol or no data available');
            }

            const result = response.data.chart.result[0];
            const meta = result.meta;
            const quote = result.indicators.quote[0];
            
            return {
                symbol: meta.symbol,
                regularMarketPrice: meta.regularMarketPrice,
                previousClose: meta.previousClose,
                regularMarketChange: meta.regularMarketPrice - meta.previousClose,
                regularMarketChangePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
                regularMarketVolume: meta.regularMarketVolume,
                marketCap: meta.marketCap,
                currency: meta.currency,
                exchangeName: meta.exchangeName,
                longName: meta.longName || meta.symbol,
                timestamps: result.timestamp,
                prices: quote.close,
                volumes: quote.volume,
                highs: quote.high,
                lows: quote.low,
                opens: quote.open
            };
        } catch (error) {
            console.error('Error fetching stock quote:', error);
            throw new Error(`Failed to fetch data for ${symbol}. Please check the symbol and try again.`);
        }
    }

    /**
     * Fetch detailed stock information
     * @param {string} symbol - Stock symbol
     * @returns {Promise<Object>} Detailed stock information
     */
    async getStockDetails(symbol) {
        try {
            const modules = [
                'summaryDetail',
                'defaultKeyStatistics',
                'financialData',
                'calendarEvents',
                'upgradeDowngradeHistory'
            ].join(',');
            
            const url = `${this.quoteURL}/${symbol.toUpperCase()}?modules=${modules}`;
            const response = await this.makeRequest(url);
            
            if (!response.data || !response.data.quoteSummary || !response.data.quoteSummary.result) {
                throw new Error('Unable to fetch detailed information');
            }

            const result = response.data.quoteSummary.result[0];
            
            return {
                summaryDetail: result.summaryDetail || {},
                defaultKeyStatistics: result.defaultKeyStatistics || {},
                financialData: result.financialData || {},
                calendarEvents: result.calendarEvents || {},
                upgradeDowngradeHistory: result.upgradeDowngradeHistory || {}
            };
        } catch (error) {
            console.error('Error fetching stock details:', error);
            // Return empty object if detailed data fails
            return {};
        }
    }

    /**
     * Fetch historical stock data
     * @param {string} symbol - Stock symbol
     * @param {string} period - Time period (1d, 5d, 1mo, 3mo, 1y)
     * @returns {Promise<Object>} Historical stock data
     */
    async getHistoricalData(symbol, period = '1mo') {
        try {
            const url = `${this.baseURL}/${symbol.toUpperCase()}?range=${period}&interval=1d`;
            const response = await this.makeRequest(url);
            
            if (!response.data || !response.data.chart || !response.data.chart.result) {
                throw new Error('No historical data available');
            }

            const result = response.data.chart.result[0];
            const quote = result.indicators.quote[0];
            
            return {
                timestamps: result.timestamp,
                prices: quote.close,
                volumes: quote.volume,
                highs: quote.high,
                lows: quote.low,
                opens: quote.open
            };
        } catch (error) {
            console.error('Error fetching historical data:', error);
            throw new Error('Failed to fetch historical data');
        }
    }

    /**
     * Make HTTP request with CORS proxy fallback
     * @param {string} url - Target URL
     * @returns {Promise<Object>} Response data
     */
    async makeRequest(url) {
        const maxRetries = this.corsProxies.length;
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                let requestUrl = url;
                
                // Try direct request first, then use CORS proxies
                if (i > 0) {
                    const proxyIndex = (i - 1) % this.corsProxies.length;
                    requestUrl = this.corsProxies[proxyIndex] + encodeURIComponent(url);
                }

                const response = await axios.get(requestUrl, {
                    timeout: 10000,
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                return response;
            } catch (error) {
                lastError = error;
                console.warn(`Request attempt ${i + 1} failed:`, error.message);
                
                if (i < maxRetries - 1) {
                    await this.delay(1000 * (i + 1)); // Exponential backoff
                }
            }
        }

        throw lastError;
    }

    /**
     * Utility function to add delay
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Format number with appropriate suffixes
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    formatLargeNumber(num) {
        if (num === null || num === undefined) return 'N/A';
        
        const absNum = Math.abs(num);
        
        if (absNum >= 1e12) {
            return (num / 1e12).toFixed(2) + 'T';
        } else if (absNum >= 1e9) {
            return (num / 1e9).toFixed(2) + 'B';
        } else if (absNum >= 1e6) {
            return (num / 1e6).toFixed(2) + 'M';
        } else if (absNum >= 1e3) {
            return (num / 1e3).toFixed(2) + 'K';
        } else {
            return num.toFixed(2);
        }
    }

    /**
     * Format currency value
     * @param {number} value - Value to format
     * @param {string} currency - Currency code (default: USD)
     * @returns {string} Formatted currency
     */
    formatCurrency(value, currency = 'USD') {
        if (value === null || value === undefined) return 'N/A';
        
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        });
        
        return formatter.format(value);
    }

    /**
     * Format percentage
     * @param {number} value - Percentage value
     * @returns {string} Formatted percentage
     */
    formatPercentage(value) {
        if (value === null || value === undefined) return 'N/A';
        return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
    }

    /**
     * Validate stock symbol
     * @param {string} symbol - Stock symbol to validate
     * @returns {boolean} True if valid
     */
    validateSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') return false;
        
        // Basic validation: 1-5 characters, alphanumeric
        const regex = /^[A-Za-z0-9.-]{1,10}$/;
        return regex.test(symbol.trim());
    }
}

// Create global instance
const stockAPI = new StockAPI();
