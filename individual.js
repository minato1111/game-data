// ========================================
// 個人分析ページ - individual.js
// ========================================

// ページ固有の変数
let currentPlayer = null;
let individualChartInstance = null;

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

        // URLパラメータからプレイヤー情報を取得
        const urlParams = new URLSearchParams(window.location.search);
        const playerId = urlParams.get('id');
        const playerName = urlParams.get('name');

        if (playerId || playerName) {
            // URLパラメータからプレイヤーを検索
            document.getElementById('playerSearch').value = playerName || playerId;
            searchPlayer();
        }

    } catch (error) {
        console.error('初期化エラー:', error);
        alert('データの読み込みに失敗しました: ' + error.message);
    }
});

// ========================================
// プレイヤー検索
// ========================================

/**
 * プレイヤーを検索
 */
function searchPlayer() {
    const searchTerm = document.getElementById('playerSearch').value.toLowerCase().trim();

    if (!searchTerm) {
        alert('プレイヤー名またはIDを入力してください');
        return;
    }

    // プレイヤーデータを検索
    const playerData = allData.filter(row => {
        return (
            (row.Name && row.Name.toString().toLowerCase().includes(searchTerm)) ||
            (row.ID && row.ID.toString().toLowerCase().includes(searchTerm))
        );
    });

    if (playerData.length === 0) {
        alert('該当するプレイヤーが見つかりません');
        return;
    }

    // 最新のデータを取得
    const latestData = playerData.sort((a, b) => {
        return new Date(b.Date) - new Date(a.Date);
    })[0];

    // そのプレイヤーの全データを取得
    const allPlayerData = allData.filter(row =>
        row.ID === latestData.ID || row.Name === latestData.Name
    );

    currentPlayer = {
        name: latestData.Name,
        id: latestData.ID,
        alliance: latestData.Alliance,
        data: allPlayerData
    };

    // プレイヤー情報を表示
    document.getElementById('playerInfo').style.display = 'block';
    document.getElementById('noPlayerData').style.display = 'none';
    document.getElementById('playerName').textContent = currentPlayer.name;
    document.getElementById('playerId').textContent = currentPlayer.id;
    document.getElementById('playerAlliance').textContent = currentPlayer.alliance || 'なし';

    // データ期間を表示
    const dates = allPlayerData.map(d => d.Date).sort();
    document.getElementById('playerDataRange').textContent =
        `${dates[0]} ～ ${dates[dates.length - 1]}`;

    // チャートを更新
    updateIndividualChart();
}

// ========================================
// チャート表示
// ========================================

/**
 * 個人分析チャートを更新
 */
function updateIndividualChart() {
    if (!currentPlayer) return;

    const metric = document.getElementById('individualMetric').value;
    const data = currentPlayer.data.sort((a, b) => {
        return new Date(a.Date) - new Date(b.Date);
    });

    const labels = data.map(d => d.Date);
    const values = data.map(d => {
        const val = d[metric] || '0';
        return parseInt(val.toString().replace(/,/g, '')) || 0;
    });

    // 成長率を計算
    const trend = values.length > 1 ?
        ((values[values.length - 1] - values[0]) / values[0] * 100).toFixed(2) : 0;

    const ctx = document.getElementById('individualChart').getContext('2d');

    if (individualChartInstance) {
        individualChartInstance.destroy();
    }

    individualChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: metric,
                data: values,
                borderColor: 'rgb(102, 126, 234)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.1,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgb(102, 126, 234)',
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
                    text: `${currentPlayer.name} - ${metric}の推移 (変化率: ${trend > 0 ? '+' : ''}${trend}%)`,
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: false
                },
                datalabels: {
                    display: function(context) {
                        // データポイントが多い場合は間引いて表示
                        const dataLength = context.dataset.data.length;
                        if (dataLength > 20) {
                            // 20個以上の場合は5個ごとに表示
                            return context.dataIndex % 5 === 0;
                        } else if (dataLength > 10) {
                            // 10-20個の場合は3個ごとに表示
                            return context.dataIndex % 3 === 0;
                        } else {
                            // 10個以下の場合は全て表示
                            return true;
                        }
                    },
                    align: function(context) {
                        // ジグザグに配置して重ならないようにする
                        return context.dataIndex % 2 === 0 ? 'top' : 'bottom';
                    },
                    backgroundColor: 'rgba(102, 126, 234, 0.9)',
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
                    padding: 3,
                    offset: 8
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 15
                    }
                },
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000000) {
                                return (value / 1000000000).toFixed(1) + 'B';
                            } else if (value >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'M';
                            }
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}
