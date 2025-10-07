// グローバル変数
let masterData = [];
let currentTab = 'data-list';
let charts = {
    top300: null,
    personal: null
};

// KVKノルマ基準値
const KVK_QUOTAS = [
    { min: 45000000, max: 59999999, killQuota: 75000000, deadQuota: 198000, deathRate: 0.0033 },
    { min: 60000000, max: 64999999, killQuota: 150000000, deadQuota: 214500, deathRate: 0.0033 },
    { min: 65000000, max: 69999999, killQuota: 150000000, deadQuota: 231000, deathRate: 0.0033 },
    { min: 70000000, max: 74999999, killQuota: 187500000, deadQuota: 315000, deathRate: 0.0042 },
    { min: 75000000, max: 79999999, killQuota: 187500000, deadQuota: 336000, deathRate: 0.0042 },
    { min: 80000000, max: 84999999, killQuota: 200000000, deadQuota: 425000, deathRate: 0.0050 },
    { min: 85000000, max: 89999999, killQuota: 200000000, deadQuota: 450000, deathRate: 0.0050 },
    { min: 90000000, max: 94999999, killQuota: 300000000, deadQuota: 551000, deathRate: 0.0058 },
    { min: 95000000, max: 99999999, killQuota: 300000000, deadQuota: 580000, deathRate: 0.0058 },
    { min: 100000000, max: 149999999, killQuota: 600000000, deadQuota: 1005000, deathRate: 0.0067 },
    { min: 150000000, max: 199999999, killQuota: 600000000, deadQuota: 1340000, deathRate: 0.0067 }
];

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeFilters();
    loadCSVData();
});

// タブ切り替え
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // タブボタンの切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

    // タブコンテンツの切り替え
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    currentTab = tabId;
}

// フィルター初期化
function initializeFilters() {
    // データ一覧タブ
    document.getElementById('period-filter-list').addEventListener('change', (e) => {
        document.getElementById('custom-period-list').style.display =
            e.target.value === 'custom' ? 'flex' : 'none';
        updateDataList();
    });
    document.getElementById('start-date-list').addEventListener('change', updateDataList);
    document.getElementById('end-date-list').addEventListener('change', updateDataList);
    document.getElementById('display-count-list').addEventListener('change', updateDataList);
    document.getElementById('sort-column-list').addEventListener('change', updateDataList);
    document.getElementById('sort-order-list').addEventListener('change', updateDataList);
    document.getElementById('search-list').addEventListener('input', updateDataList);

    // 比較データタブ
    document.getElementById('period-filter-comp').addEventListener('change', (e) => {
        document.getElementById('custom-period-comp').style.display =
            e.target.value === 'custom' ? 'flex' : 'none';
        updateComparisonData();
    });
    document.getElementById('start-date-comp').addEventListener('change', updateComparisonData);
    document.getElementById('end-date-comp').addEventListener('change', updateComparisonData);
    document.getElementById('display-count-comp').addEventListener('change', updateComparisonData);
    document.getElementById('sort-column-comp').addEventListener('change', updateComparisonData);
    document.getElementById('sort-order-comp').addEventListener('change', updateComparisonData);
    document.getElementById('search-comp').addEventListener('input', updateComparisonData);

    // 上位300人統計タブ
    document.getElementById('chart-type-top300').addEventListener('change', updateTop300Chart);
    document.getElementById('metric-top300').addEventListener('change', updateTop300Chart);

    // 個人分析用タブ
    document.getElementById('player-search-btn').addEventListener('click', searchPlayer);
    document.getElementById('metric-personal').addEventListener('change', updatePersonalChart);

    // KVKノルマタブ
    document.getElementById('kvk-search-btn').addEventListener('click', searchKVKPlayer);
}

// CSVデータ読み込み
function loadCSVData() {
    Papa.parse('Master_Data.csv', {
        download: true,
        header: true,
        complete: (results) => {
            masterData = results.data.filter(row => row.date && row.date.trim() !== '');
            // データの数値変換
            masterData = masterData.map(row => ({
                no: row.no || '',
                date: row.date || '',
                id: row.id || '',
                name: row.name || '',
                power: parseNumber(row.power),
                alliance: row.alliance || '',
                t4kill: parseNumber(row.t4kill),
                t5kill: parseNumber(row.t5kill),
                totalkill: parseNumber(row.totalkill),
                dead: parseNumber(row.dead),
                troopspower: parseNumber(row.troopspower)
            }));
            updateDataList();
            updateComparisonData();
            updateTop300Chart();
        },
        error: (error) => {
            console.error('CSV読み込みエラー:', error);
            showError('データの読み込みに失敗しました。Master_Data.csvファイルが存在することを確認してください。');
        }
    });
}

// 数値パース関数
function parseNumber(value) {
    if (!value) return 0;
    const str = String(value).replace(/,/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

// 数値フォーマット関数
function formatNumber(num) {
    return num.toLocaleString('ja-JP');
}

// エラー表示
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.content').prepend(errorDiv);
}

// 期間フィルター適用
function applyPeriodFilter(data, periodType, startDate, endDate) {
    if (periodType === 'all') return data;

    const now = new Date();
    let filterDate;

    switch (periodType) {
        case '7days':
            filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30days':
            filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'custom':
            if (startDate && endDate) {
                return data.filter(row => {
                    const rowDate = new Date(row.date);
                    return rowDate >= new Date(startDate) && rowDate <= new Date(endDate);
                });
            }
            return data;
    }

    return data.filter(row => new Date(row.date) >= filterDate);
}

// データ一覧の更新
function updateDataList() {
    if (masterData.length === 0) return;

    const periodType = document.getElementById('period-filter-list').value;
    const startDate = document.getElementById('start-date-list').value;
    const endDate = document.getElementById('end-date-list').value;
    const displayCount = document.getElementById('display-count-list').value;
    const sortColumn = document.getElementById('sort-column-list').value;
    const sortOrder = document.getElementById('sort-order-list').value;
    const searchText = document.getElementById('search-list').value.toLowerCase();

    // フィルタリング
    let filteredData = applyPeriodFilter(masterData, periodType, startDate, endDate);

    // 検索
    if (searchText) {
        filteredData = filteredData.filter(row =>
            row.name.toLowerCase().includes(searchText) ||
            row.id.toLowerCase().includes(searchText)
        );
    }

    // ソート
    filteredData.sort((a, b) => {
        let aVal, bVal;
        switch (sortColumn) {
            case 'date':
                aVal = new Date(a.date);
                bVal = new Date(b.date);
                break;
            case 'power':
                aVal = a.power;
                bVal = b.power;
                break;
            case 't4kill':
                aVal = a.t4kill;
                bVal = b.t4kill;
                break;
            case 't5kill':
                aVal = a.t5kill;
                bVal = b.t5kill;
                break;
            case 'totalkill':
                aVal = a.totalkill;
                bVal = b.totalkill;
                break;
            case 'dead':
                aVal = a.dead;
                bVal = b.dead;
                break;
            case 'troopspower':
                aVal = a.troopspower;
                bVal = b.troopspower;
                break;
            default:
                return 0;
        }
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // 表示件数制限
    if (displayCount !== 'all') {
        filteredData = filteredData.slice(0, parseInt(displayCount));
    }

    // テーブル更新
    const tbody = document.getElementById('data-tbody');
    tbody.innerHTML = '';

    filteredData.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${row.date}</td>
            <td>${row.id}</td>
            <td>${row.name}</td>
            <td>${formatNumber(row.power)}</td>
            <td>${row.alliance}</td>
            <td>${formatNumber(row.t4kill)}</td>
            <td>${formatNumber(row.t5kill)}</td>
            <td>${formatNumber(row.totalkill)}</td>
            <td>${formatNumber(row.dead)}</td>
            <td>${formatNumber(row.troopspower)}</td>
        `;
        tbody.appendChild(tr);
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="no-data">データがありません</td></tr>';
    }
}

// 比較データの更新
function updateComparisonData() {
    if (masterData.length === 0) return;

    const periodType = document.getElementById('period-filter-comp').value;
    const startDate = document.getElementById('start-date-comp').value;
    const endDate = document.getElementById('end-date-comp').value;
    const displayCount = document.getElementById('display-count-comp').value;
    const sortColumn = document.getElementById('sort-column-comp').value;
    const sortOrder = document.getElementById('sort-order-comp').value;
    const searchText = document.getElementById('search-comp').value.toLowerCase();

    // プレイヤーごとにデータをグループ化
    const playerData = {};
    masterData.forEach(row => {
        if (!playerData[row.id]) {
            playerData[row.id] = {
                id: row.id,
                name: row.name,
                alliance: row.alliance,
                records: []
            };
        }
        playerData[row.id].records.push(row);
    });

    // 各プレイヤーの期間内データを取得
    const comparisonData = [];
    Object.values(playerData).forEach(player => {
        let filteredRecords = applyPeriodFilter(player.records, periodType, startDate, endDate);
        filteredRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (filteredRecords.length >= 2) {
            const startRecord = filteredRecords[0];
            const endRecord = filteredRecords[filteredRecords.length - 1];
            const growth = endRecord.power - startRecord.power;
            const rate = startRecord.power > 0 ? (growth / startRecord.power) * 100 : 0;

            comparisonData.push({
                id: player.id,
                name: player.name,
                alliance: player.alliance,
                startPower: startRecord.power,
                endPower: endRecord.power,
                growth: growth,
                rate: rate
            });
        }
    });

    // 検索
    let filteredData = comparisonData;
    if (searchText) {
        filteredData = filteredData.filter(row =>
            row.name.toLowerCase().includes(searchText) ||
            row.id.toLowerCase().includes(searchText)
        );
    }

    // ソート
    filteredData.sort((a, b) => {
        let aVal, bVal;
        switch (sortColumn) {
            case 'growth':
                aVal = a.growth;
                bVal = b.growth;
                break;
            case 'rate':
                aVal = a.rate;
                bVal = b.rate;
                break;
            case 'startpower':
                aVal = a.startPower;
                bVal = b.startPower;
                break;
            case 'endpower':
                aVal = a.endPower;
                bVal = b.endPower;
                break;
            default:
                return 0;
        }
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // 表示件数制限
    if (displayCount !== 'all') {
        filteredData = filteredData.slice(0, parseInt(displayCount));
    }

    // テーブル更新
    const tbody = document.getElementById('comparison-tbody');
    tbody.innerHTML = '';

    filteredData.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${row.id}</td>
            <td>${row.name}</td>
            <td>${row.alliance}</td>
            <td>${formatNumber(row.startPower)}</td>
            <td>${formatNumber(row.endPower)}</td>
            <td>${formatNumber(row.growth)}</td>
            <td>${row.rate.toFixed(2)}%</td>
        `;
        tbody.appendChild(tr);
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">データがありません</td></tr>';
    }
}

// 上位300人統計グラフの更新
function updateTop300Chart() {
    if (masterData.length === 0) return;

    const chartType = document.getElementById('chart-type-top300').value;
    const metric = document.getElementById('metric-top300').value;

    // 日付ごとにグループ化
    const dateGroups = {};
    masterData.forEach(row => {
        if (!dateGroups[row.date]) {
            dateGroups[row.date] = [];
        }
        dateGroups[row.date].push(row);
    });

    // 各日付でPower上位300人を抽出し、指標の合計を計算
    const chartData = [];
    Object.keys(dateGroups).sort().forEach(date => {
        const topPlayers = dateGroups[date]
            .sort((a, b) => b.power - a.power)
            .slice(0, 300);

        let value = 0;
        switch (metric) {
            case 'power':
                value = topPlayers.reduce((sum, p) => sum + p.power, 0);
                break;
            case 't4kill':
                value = topPlayers.reduce((sum, p) => sum + p.t4kill, 0);
                break;
            case 't5kill':
                value = topPlayers.reduce((sum, p) => sum + p.t5kill, 0);
                break;
            case 'totalkill':
                value = topPlayers.reduce((sum, p) => sum + p.totalkill, 0);
                break;
            case 'dead':
                value = topPlayers.reduce((sum, p) => sum + p.dead, 0);
                break;
            case 'troopspower':
                value = topPlayers.reduce((sum, p) => sum + p.troopspower, 0);
                break;
        }

        chartData.push({ date, value });
    });

    // グラフ描画
    const ctx = document.getElementById('top300-chart').getContext('2d');

    if (charts.top300) {
        charts.top300.destroy();
    }

    const metricLabels = {
        power: 'Power',
        t4kill: 'T4kill',
        t5kill: 'T5kill',
        totalkill: 'Total kill points',
        dead: 'Dead Troops',
        troopspower: 'Troops Power'
    };

    charts.top300 = new Chart(ctx, {
        type: chartType,
        data: {
            labels: chartData.map(d => d.date),
            datasets: [{
                label: `上位300人の${metricLabels[metric]}合計`,
                data: chartData.map(d => d.value),
                backgroundColor: chartType === 'bar' ? 'rgba(102, 126, 234, 0.6)' : 'rgba(102, 126, 234, 0.2)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                fill: chartType === 'line'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.parsed.y)}`;
                        }
                    }
                }
            }
        }
    });
}

// プレイヤー検索（個人分析用）
function searchPlayer() {
    const searchText = document.getElementById('player-search').value.toLowerCase();
    if (!searchText) {
        alert('プレイヤー名またはIDを入力してください');
        return;
    }

    const playerRecords = masterData.filter(row =>
        row.name.toLowerCase().includes(searchText) ||
        row.id.toLowerCase().includes(searchText)
    );

    if (playerRecords.length === 0) {
        alert('該当するプレイヤーが見つかりませんでした');
        return;
    }

    // プレイヤー情報表示
    const player = playerRecords[0];
    const playerInfo = document.getElementById('player-info');
    playerInfo.className = 'player-info show';
    playerInfo.innerHTML = `
        <h3>プレイヤー情報</h3>
        <div class="player-info-grid">
            <div class="info-item">
                <label>名前:</label>
                <span>${player.name}</span>
            </div>
            <div class="info-item">
                <label>ID:</label>
                <span>${player.id}</span>
            </div>
            <div class="info-item">
                <label>同盟:</label>
                <span>${player.alliance}</span>
            </div>
            <div class="info-item">
                <label>データ数:</label>
                <span>${playerRecords.length}件</span>
            </div>
        </div>
    `;

    updatePersonalChart(playerRecords);
}

// 個人分析グラフの更新
function updatePersonalChart(playerRecords = null) {
    if (!playerRecords) {
        const searchText = document.getElementById('player-search').value.toLowerCase();
        if (!searchText) return;

        playerRecords = masterData.filter(row =>
            row.name.toLowerCase().includes(searchText) ||
            row.id.toLowerCase().includes(searchText)
        );
    }

    if (playerRecords.length === 0) return;

    const metric = document.getElementById('metric-personal').value;

    // 日付順にソート
    playerRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

    // グラフデータ作成
    const chartData = playerRecords.map(record => {
        let value = 0;
        switch (metric) {
            case 'power':
                value = record.power;
                break;
            case 't4kill':
                value = record.t4kill;
                break;
            case 't5kill':
                value = record.t5kill;
                break;
            case 'totalkill':
                value = record.totalkill;
                break;
            case 'dead':
                value = record.dead;
                break;
            case 'troopspower':
                value = record.troopspower;
                break;
        }
        return { date: record.date, value };
    });

    // グラフ描画
    const ctx = document.getElementById('personal-chart').getContext('2d');

    if (charts.personal) {
        charts.personal.destroy();
    }

    const metricLabels = {
        power: 'Power',
        t4kill: 'T4kill',
        t5kill: 'T5kill',
        totalkill: 'Total kill points',
        dead: 'Dead Troops',
        troopspower: 'Troops Power'
    };

    charts.personal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => d.date),
            datasets: [{
                label: metricLabels[metric],
                data: chartData.map(d => d.value),
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.parsed.y)}`;
                        }
                    }
                }
            }
        }
    });
}

// KVKプレイヤー検索
function searchKVKPlayer() {
    const searchText = document.getElementById('kvk-player-search').value.toLowerCase();
    if (!searchText) {
        alert('プレイヤー名またはIDを入力してください');
        return;
    }

    const playerRecords = masterData.filter(row =>
        row.name.toLowerCase().includes(searchText) ||
        row.id.toLowerCase().includes(searchText)
    );

    if (playerRecords.length === 0) {
        alert('該当するプレイヤーが見つかりませんでした');
        return;
    }

    // 9/24以降のデータを抽出
    const kvkStartDate = new Date('2024-09-24');
    const kvkRecords = playerRecords.filter(row => new Date(row.date) >= kvkStartDate);
    kvkRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (kvkRecords.length === 0) {
        alert('9/24以降のデータがありません');
        return;
    }

    const startRecord = kvkRecords[0];
    const latestRecord = kvkRecords[kvkRecords.length - 1];

    // 撃破数と戦死数の増加量を計算
    const killIncrease = latestRecord.totalkill - startRecord.totalkill;
    const deadIncrease = latestRecord.dead - startRecord.dead;

    // Power帯に基づくノルマを取得
    const quota = getKVKQuota(latestRecord.power);

    if (!quota) {
        alert('該当するPower帯のノルマが見つかりませんでした');
        return;
    }

    // 達成率計算
    const killProgress = (killIncrease / quota.killQuota) * 100;
    const deadProgress = (deadIncrease / quota.deadQuota) * 100;

    // 表示
    const kvkResult = document.getElementById('kvk-result');
    kvkResult.className = 'kvk-result show';

    const playerInfoDiv = document.getElementById('kvk-player-info');
    playerInfoDiv.innerHTML = `
        <h3>プレイヤー情報</h3>
        <div class="player-info-grid">
            <div class="info-item">
                <label>名前:</label>
                <span>${latestRecord.name}</span>
            </div>
            <div class="info-item">
                <label>ID:</label>
                <span>${latestRecord.id}</span>
            </div>
            <div class="info-item">
                <label>現在のPower:</label>
                <span>${formatNumber(latestRecord.power)}</span>
            </div>
            <div class="info-item">
                <label>対象期間:</label>
                <span>9/24 ～ ${latestRecord.date}</span>
            </div>
        </div>
    `;

    const progressDiv = document.getElementById('kvk-progress');
    progressDiv.innerHTML = `
        <div class="progress-item">
            <h4>撃破ノルマ進捗</h4>
            <div class="progress-bar-container">
                <div class="progress-bar ${killProgress >= 100 ? 'completed' : ''}" style="width: ${Math.min(killProgress, 100)}%">
                    ${killProgress.toFixed(1)}%
                </div>
            </div>
            <div class="progress-values">
                <span>現在: ${formatNumber(killIncrease)}</span>
                <span>目標: ${formatNumber(quota.killQuota)}</span>
            </div>
        </div>

        <div class="progress-item">
            <h4>戦死ノルマ進捗</h4>
            <div class="progress-bar-container">
                <div class="progress-bar ${deadProgress >= 100 ? 'completed' : ''}" style="width: ${Math.min(deadProgress, 100)}%">
                    ${deadProgress.toFixed(1)}%
                </div>
            </div>
            <div class="progress-values">
                <span>現在: ${formatNumber(deadIncrease)}</span>
                <span>目標: ${formatNumber(quota.deadQuota)}</span>
            </div>
        </div>
    `;
}

// Power帯に基づくKVKノルマを取得
function getKVKQuota(power) {
    for (const quota of KVK_QUOTAS) {
        if (power >= quota.min && power <= quota.max) {
            return quota;
        }
    }
    return null;
}
