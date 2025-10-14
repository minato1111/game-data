// ========================================
// 上位300人統計ページ - topStats.js
// ========================================

// Chart.js インスタンス
let overallChartInstance = null;
let overallBarChartInstance = null;

// ========================================
// 初期化
// ========================================

window.addEventListener('DOMContentLoaded', async () => {
    try {
        // CSVデータ読み込み
        await loadCSVData();

        // CSV情報表示
        await displayCSVInfo();

        // Chart.js datalabels プラグインの登録
        if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        // 初期チャートを表示
        updateOverallChart();

    } catch (error) {
        console.error('初期化エラー:', error);
        alert('データの読み込みに失敗しました: ' + error.message);
    }
});

// ========================================
// チャートデータ処理
// ========================================

/**
 * 日付でデータをグループ化
 */
function groupDataByDate(data) {
    const grouped = {};
    data.forEach(row => {
        const date = row.Date;
        if (!date) return;

        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(row);
    });
    return grouped;
}

/**
 * チャートデータを計算（上位300人の合計と平均）
 */
function calculateChartData(groupedData, metric) {
    const chartData = [];
    Object.keys(groupedData).sort().forEach(date => {
        const dayData = groupedData[date];

        // メトリクスでソート（降順）
        dayData.sort((a, b) => {
            const aVal = parseInt((a[metric] || '0').toString().replace(/,/g, '')) || 0;
            const bVal = parseInt((b[metric] || '0').toString().replace(/,/g, '')) || 0;
            return bVal - aVal;
        });

        // 上位300人を取得
        const top300 = dayData.slice(0, 300);

        // 合計を計算
        const total = top300.reduce((sum, row) => {
            return sum + (parseInt((row[metric] || '0').toString().replace(/,/g, '')) || 0);
        }, 0);

        const average = total / top300.length;

        chartData.push({
            date: date,
            total: total,
            average: average,
            count: top300.length
        });
    });
    return chartData;
}

/**
 * チャートデータを処理
 */
function processOverallChartData(metric) {
    const groupedData = groupDataByDate(allData);
    const chartData = calculateChartData(groupedData, metric);

    return {
        labels: chartData.map(d => d.date),
        totals: chartData.map(d => d.total),
        chartData: chartData
    };
}

// ========================================
// チャート表示
// ========================================

/**
 * チャートを更新
 */
function updateOverallChart() {
    const metric = document.getElementById('overallMetric').value;
    const { labels, totals } = processOverallChartData(metric);

    // 折れ線グラフ
    const lineCtx = document.getElementById('overallChart').getContext('2d');
    if (overallChartInstance) {
        overallChartInstance.destroy();
    }

    overallChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `上位300人の${metric}合計`,
                data: totals,
                borderColor: 'rgb(118, 75, 162)',
                backgroundColor: 'rgba(118, 75, 162, 0.1)',
                tension: 0.1,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgb(118, 75, 162)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `上位300人の${metric}統計`,
                    font: {
                        size: 16
                    }
                },
                datalabels: {
                    display: true,
                    align: 'top',
                    backgroundColor: 'rgba(118, 75, 162, 0.9)',
                    borderRadius: 4,
                    color: 'white',
                    font: {
                        weight: 'bold',
                        size: 10
                    },
                    formatter: function(value) {
                        if (value >= 1000000000) {
                            return (value / 1000000000).toFixed(1) + 'B';
                        } else if (value >= 1000000) {
                            return (value / 1000000).toFixed(1) + 'M';
                        } else if (value >= 1000) {
                            return (value / 1000).toFixed(0) + 'K';
                        }
                        return value.toLocaleString();
                    },
                    padding: 4,
                    offset: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000000) {
                                return (value / 1000000000).toFixed(0) + 'B';
                            } else if (value >= 1000000) {
                                return (value / 1000000).toFixed(0) + 'M';
                            }
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });

    // 棒グラフ
    const barCtx = document.getElementById('overallBarChart').getContext('2d');
    if (overallBarChartInstance) {
        overallBarChartInstance.destroy();
    }

    overallBarChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `上位300人の${metric}合計`,
                data: totals,
                backgroundColor: 'rgba(52, 152, 219, 0.8)',
                borderColor: 'rgb(52, 152, 219)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `上位300人の${metric}合計`,
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: false
                },
                datalabels: {
                    display: true,
                    align: 'end',
                    anchor: 'end',
                    backgroundColor: 'rgba(52, 152, 219, 0.9)',
                    borderRadius: 4,
                    color: 'white',
                    font: {
                        weight: 'bold',
                        size: 9
                    },
                    formatter: function(value) {
                        if (value >= 1000000000) {
                            return (value / 1000000000).toFixed(1) + 'B';
                        } else if (value >= 1000000) {
                            return (value / 1000000).toFixed(1) + 'M';
                        } else if (value >= 1000) {
                            return (value / 1000).toFixed(0) + 'K';
                        }
                        return value.toLocaleString();
                    },
                    padding: 3
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000000) {
                                return (value / 1000000000).toFixed(0) + 'B';
                            } else if (value >= 1000000) {
                                return (value / 1000000).toFixed(0) + 'M';
                            }
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// ========================================
// チャート切り替え
// ========================================

/**
 * 折れ線グラフを表示
 */
function showLineChart() {
    document.getElementById('overallChart').parentElement.style.display = 'block';
    document.getElementById('overallBarChart').parentElement.style.display = 'none';

    const buttons = document.querySelectorAll('.chart-controls button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

/**
 * 棒グラフを表示
 */
function showBarChart() {
    document.getElementById('overallChart').parentElement.style.display = 'none';
    document.getElementById('overallBarChart').parentElement.style.display = 'block';

    const buttons = document.querySelectorAll('.chart-controls button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}
