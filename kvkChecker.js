// ========================================
// KVKノルマチェックページ - kvkChecker.js
// ========================================

// KVKノルマテーブル（Power帯別の目標値）
const KVK_NORMA_TABLE = [
    { minPower: 45000000, maxPower: 59999999, killTarget: 75000000, deathTarget: 198000, deathRate: 0.0033 },
    { minPower: 60000000, maxPower: 64999999, killTarget: 150000000, deathTarget: 214500, deathRate: 0.0033 },
    { minPower: 65000000, maxPower: 69999999, killTarget: 150000000, deathTarget: 231000, deathRate: 0.0033 },
    { minPower: 70000000, maxPower: 74999999, killTarget: 187500000, deathTarget: 315000, deathRate: 0.0042 },
    { minPower: 75000000, maxPower: 79999999, killTarget: 187500000, deathTarget: 336000, deathRate: 0.0042 },
    { minPower: 80000000, maxPower: 84999999, killTarget: 200000000, deathTarget: 425000, deathRate: 0.0050 },
    { minPower: 85000000, maxPower: 89999999, killTarget: 200000000, deathTarget: 450000, deathRate: 0.0050 },
    { minPower: 90000000, maxPower: 94999999, killTarget: 300000000, deathTarget: 551000, deathRate: 0.0058 },
    { minPower: 95000000, maxPower: 99999999, killTarget: 300000000, deathTarget: 580000, deathRate: 0.0058 },
    { minPower: 100000000, maxPower: 149999999, killTarget: 600000000, deathTarget: 1005000, deathRate: 0.0067 },
    { minPower: 150000000, maxPower: 199999999, killTarget: 600000000, deathTarget: 1340000, deathRate: 0.0067 },
    { minPower: 200000000, maxPower: 999999999, killTarget: 600000000, deathTarget: 1340000, deathRate: 0.0067 }
];

// Chart.jsインスタンス
window.kvkKillChartInstance = null;
window.kvkDeathChartInstance = null;

// ========================================
// 初期化
// ========================================

window.addEventListener('DOMContentLoaded', async () => {
    try {
        // CSVデータ読み込み
        await loadCSVData();

        // CSV情報表示
        await displayCSVInfo();

        // Chart.js プラグイン登録
        if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

    } catch (error) {
        console.error('初期化エラー:', error);
        alert('データの読み込みに失敗しました: ' + error.message);
    }
});

// ========================================
// Power帯からノルマを取得
// ========================================

/**
 * Power帯からKVKノルマを取得（戦死ノルマのみ9/24時点のPowerで計算）
 */
function getKvkNormaByPower(power, useDeathRateCalculation = false, startPower = null) {
    const powerNum = parseInt((power || '0').toString().replace(/,/g, '')) || 0;

    for (const norma of KVK_NORMA_TABLE) {
        if (powerNum >= norma.minPower && powerNum <= norma.maxPower) {
            let deathTarget;

            if (useDeathRateCalculation && startPower) {
                // 戦死ノルマのみ9/24時点のPowerでDeath Rateを使って計算
                const startPowerNum = parseInt((startPower || '0').toString().replace(/,/g, '')) || 0;
                deathTarget = Math.round(startPowerNum * norma.deathRate);
            } else {
                // 表示用の固定値
                deathTarget = norma.deathTarget;
            }

            return {
                killTarget: norma.killTarget,
                deathTarget: deathTarget,
                deathRate: norma.deathRate
            };
        }
    }

    // 該当しない場合はデフォルト値
    return { killTarget: 0, deathTarget: 0, deathRate: 0 };
}

// ========================================
// プレイヤー検索
// ========================================

/**
 * KVKプレイヤーを検索
 */
function searchKvkPlayer() {
    const searchTerm = document.getElementById('kvkPlayerSearch').value.toLowerCase().trim();

    if (!searchTerm) {
        alert('プレイヤー名またはIDを入力してください');
        return;
    }

    if (!allData || allData.length === 0) {
        alert('データが読み込まれていません。しばらくお待ちください。');
        return;
    }

    // プレイヤーデータを検索
    const playerData = allData.filter(row => {
        const nameMatch = row.Name && row.Name.toString().toLowerCase().includes(searchTerm);
        const idMatch = row.ID && row.ID.toString().toLowerCase().includes(searchTerm);
        return nameMatch || idMatch;
    });

    if (playerData.length === 0) {
        alert('該当するプレイヤーが見つかりません');
        return;
    }

    // 最新のプレイヤーデータを取得
    const latestData = playerData.sort((a, b) => {
        return new Date(b.Date) - new Date(a.Date);
    })[0];

    // 同じプレイヤーの全データを取得（IDまたは名前で照合）
    const allPlayerData = allData.filter(row =>
        row.ID === latestData.ID || row.Name === latestData.Name
    ).sort((a, b) => new Date(a.Date) - new Date(b.Date));

    // KVKノルマ進捗を計算
    calculateKvkProgress(latestData, allPlayerData);
}

// ========================================
// KVKノルマ進捗計算
// ========================================

/**
 * KVKノルマ進捗を計算
 */
function calculateKvkProgress(latestData, allPlayerData) {
    // 9/24のデータを探す（複数の日付形式に対応）
    const kvkStartDate = '2025/09/24';
    const altFormats = ['2025/9/24', '2025-09-24', '2025-9-24'];

    let startData = allPlayerData.find(row => row.Date === kvkStartDate);

    // 代替フォーマットでも検索
    if (!startData) {
        for (const format of altFormats) {
            startData = allPlayerData.find(row => row.Date === format);
            if (startData) break;
        }
    }

    if (!startData) {
        // 9/24のデータがない場合、最も古いデータを使用
        const oldestData = allPlayerData.length > 0 ? allPlayerData[0] : null;
        if (!oldestData) {
            alert('プレイヤーのデータが不足しています。');
            return;
        }
        startData = oldestData;
    }

    // 最新データ
    const currentData = latestData;

    // Power帯からノルマを取得（戦死ノルマのみ9/24時点のPowerで計算）
    const currentPower = parseInt((currentData.Power || '0').toString().replace(/,/g, '')) || 0;
    const startPower = parseInt((startData.Power || '0').toString().replace(/,/g, '')) || 0;
    const norma = getKvkNormaByPower(currentPower, true, startData.Power);

    // 開始時と現在の値を取得
    const startKills = parseInt((startData['Total Kill Points'] || '0').toString().replace(/,/g, '')) || 0;
    const currentKills = parseInt((currentData['Total Kill Points'] || '0').toString().replace(/,/g, '')) || 0;
    const startDeaths = parseInt((startData['Dead Troops'] || '0').toString().replace(/,/g, '')) || 0;
    const currentDeaths = parseInt((currentData['Dead Troops'] || '0').toString().replace(/,/g, '')) || 0;

    // 進捗を計算
    const killProgress = currentKills - startKills;
    const deathProgress = currentDeaths - startDeaths;

    // ノルマまでの残り
    const killRemaining = Math.max(0, norma.killTarget - killProgress);
    const deathRemaining = Math.max(0, norma.deathTarget - deathProgress);

    // 達成率を計算
    const killPercentage = norma.killTarget > 0 ? Math.min(100, (killProgress / norma.killTarget) * 100) : 0;
    const deathPercentage = norma.deathTarget > 0 ? Math.min(100, (deathProgress / norma.deathTarget) * 100) : 0;
    const overallPercentage = (killPercentage + deathPercentage) / 2;

    // UIを更新
    updateKvkProgressUI({
        player: currentData,
        norma: norma,
        startDate: '2025/09/24',
        currentDate: currentData.Date,
        startKills: startKills,
        currentKills: currentKills,
        startDeaths: startDeaths,
        currentDeaths: currentDeaths,
        killProgress: killProgress,
        deathProgress: deathProgress,
        killRemaining: killRemaining,
        deathRemaining: deathRemaining,
        killPercentage: killPercentage,
        deathPercentage: deathPercentage,
        overallPercentage: overallPercentage,
        allPlayerData: allPlayerData
    });
}

// ========================================
// KVKノルマチェッカーのUI更新
// ========================================

/**
 * KVK進捗UIを更新
 */
function updateKvkProgressUI(data) {
    // 検索ガイドを非表示、結果を表示
    const searchGuide = document.getElementById('kvkSearchGuide');
    const playerResult = document.getElementById('kvkPlayerResult');

    if (searchGuide) searchGuide.style.display = 'none';
    if (playerResult) playerResult.style.display = 'block';

    // プレイヤー基本情報
    document.getElementById('kvkPlayerName').textContent = data.player.Name || 'Unknown';
    document.getElementById('kvkPlayerId').textContent = data.player.ID || '-';
    document.getElementById('kvkPlayerAlliance').textContent = data.player.Alliance || 'なし';
    document.getElementById('kvkPlayerPower').textContent = formatKvkValue(data.player.Power);

    // 期間表示
    document.getElementById('kvkAnalysisPeriod').textContent = `${data.startDate} ～ ${data.currentDate}`;

    // 撃破ノルマ進捗
    document.getElementById('kvkKillProgress').textContent = `${formatKvkValue(data.killProgress)} / ${formatKvkValue(data.norma.killTarget)}`;
    document.getElementById('kvkKillProgressBar').style.width = `${data.killPercentage}%`;
    document.getElementById('kvkKillPercentage').textContent = `${data.killPercentage.toFixed(1)}%`;
    document.getElementById('kvkKillStart').textContent = formatKvkValue(data.startKills);
    document.getElementById('kvkKillTarget').textContent = formatKvkValue(data.norma.killTarget);
    document.getElementById('kvkKillCurrent').textContent = formatKvkValue(data.currentKills);

    // 戦死ノルマ進捗
    document.getElementById('kvkDeathProgress').textContent = `${formatKvkValue(data.deathProgress)} / ${formatKvkValue(data.norma.deathTarget)}`;
    document.getElementById('kvkDeathProgressBar').style.width = `${data.deathPercentage}%`;
    document.getElementById('kvkDeathPercentage').textContent = `${data.deathPercentage.toFixed(1)}%`;
    document.getElementById('kvkDeathStart').textContent = formatKvkValue(data.startDeaths);
    document.getElementById('kvkDeathTarget').textContent = formatKvkValue(data.norma.deathTarget);
    document.getElementById('kvkDeathCurrent').textContent = formatKvkValue(data.currentDeaths);

    // サマリー情報
    document.getElementById('kvkKillRemaining').textContent = data.killRemaining > 0 ? formatKvkValue(data.killRemaining) : '達成済み';
    document.getElementById('kvkDeathRemaining').textContent = data.deathRemaining > 0 ? formatKvkValue(data.deathRemaining) : '達成済み';
    document.getElementById('kvkOverallProgress').textContent = `${data.overallPercentage.toFixed(1)}%`;

    // ステータス表示
    updateKvkStatus('kvkKillStatus', data.killPercentage);
    updateKvkStatus('kvkDeathStatus', data.deathPercentage);
    updateKvkStatus('kvkOverallStatus', data.overallPercentage);

    // 日次進捗グラフを作成
    createKvkProgressCharts(data.player, data.allPlayerData);
}

/**
 * ステータスバッジを更新
 */
function updateKvkStatus(elementId, percentage) {
    const element = document.getElementById(elementId);

    if (percentage >= 100) {
        element.textContent = '達成済み';
        element.style.background = '#27ae60';
        element.style.color = 'white';
    } else if (percentage >= 80) {
        element.textContent = 'もう少し';
        element.style.background = '#f39c12';
        element.style.color = 'white';
    } else if (percentage >= 50) {
        element.textContent = '進行中';
        element.style.background = '#3498db';
        element.style.color = 'white';
    } else {
        element.textContent = '要努力';
        element.style.background = '#e74c3c';
        element.style.color = 'white';
    }
}

/**
 * 値をフォーマット（B/M/K単位）
 */
function formatKvkValue(value) {
    const num = parseInt((value || '0').toString().replace(/,/g, '')) || 0;

    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}

// ========================================
// KVK日次進捗グラフ
// ========================================

/**
 * KVK進捗チャートを作成
 */
function createKvkProgressCharts(playerData, allPlayerData) {
    if (!allPlayerData || allPlayerData.length === 0) {
        return;
    }

    // 9/24を起点とした日別データを準備
    const kvkStartDate = new Date('2025/09/24');
    const chartData = prepareKvkChartData(allPlayerData, kvkStartDate);

    if (chartData.dates.length === 0) {
        return;
    }

    // 撃破数グラフを作成
    createKvkKillChart(chartData);

    // 戦死数グラフを作成
    createKvkDeathChart(chartData);
}

/**
 * KVKチャート用データを準備
 */
function prepareKvkChartData(allPlayerData, startDate) {
    // 日付順にソート
    const sortedData = allPlayerData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    // 9/24以降のデータをフィルター
    const kvkData = sortedData.filter(row => {
        const rowDate = new Date(row.Date);
        return rowDate >= startDate;
    });

    if (kvkData.length === 0) return { dates: [], killProgress: [], deathProgress: [] };

    // 起点データ（9/24）
    const baseKills = parseInt((kvkData[0]['Total Kill Points'] || '0').toString().replace(/,/g, '')) || 0;
    const baseDeaths = parseInt((kvkData[0]['Dead Troops'] || '0').toString().replace(/,/g, '')) || 0;

    const dates = [];
    const killProgress = [];
    const deathProgress = [];

    kvkData.forEach(row => {
        const currentKills = parseInt((row['Total Kill Points'] || '0').toString().replace(/,/g, '')) || 0;
        const currentDeaths = parseInt((row['Dead Troops'] || '0').toString().replace(/,/g, '')) || 0;

        // 日付フォーマット
        const date = new Date(row.Date);
        const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;

        dates.push(formattedDate);
        killProgress.push(currentKills - baseKills);
        deathProgress.push(currentDeaths - baseDeaths);
    });

    return { dates, killProgress, deathProgress };
}

/**
 * 撃破数チャートを作成
 */
function createKvkKillChart(chartData) {
    const ctx = document.getElementById('kvkKillChart').getContext('2d');

    // 既存のチャートを破棄
    if (window.kvkKillChartInstance) {
        window.kvkKillChartInstance.destroy();
    }

    window.kvkKillChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.dates,
            datasets: [{
                label: '撃破数進捗',
                data: chartData.killProgress,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#e74c3c',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `撃破数: ${formatKvkValue(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatKvkValue(value);
                        }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                }
            },
            elements: {
                point: {
                    hoverBackgroundColor: '#c0392b'
                }
            }
        }
    });
}

/**
 * 戦死数チャートを作成
 */
function createKvkDeathChart(chartData) {
    const ctx = document.getElementById('kvkDeathChart').getContext('2d');

    // 既存のチャートを破棄
    if (window.kvkDeathChartInstance) {
        window.kvkDeathChartInstance.destroy();
    }

    window.kvkDeathChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.dates,
            datasets: [{
                label: '戦死数進捗',
                data: chartData.deathProgress,
                borderColor: '#f39c12',
                backgroundColor: 'rgba(243, 156, 18, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#f39c12',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `戦死数: ${formatKvkValue(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatKvkValue(value);
                        }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                }
            },
            elements: {
                point: {
                    hoverBackgroundColor: '#e67e22'
                }
            }
        }
    });
}
