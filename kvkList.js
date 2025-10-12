// =====================================
// 設定値
// =====================================
const CSV_FILE_PATH = 'Master_Data.csv';
const DEBUG_MODE = false;

// =====================================
// グローバル変数
// =====================================
let allData = [];
let kvkListData = [];

// =====================================
// ユーティリティ関数
// =====================================
function formatNumber(value) {
    if (value == null || value === '') return '';
    const num = parseInt(value.toString().replace(/,/g, '')) || 0;
    return num.toLocaleString();
}

function escapeHtml(text) {
    if (text == null) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

function parseValue(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return value;
    return parseInt(value.toString().replace(/,/g, '')) || 0;
}

// =====================================
// Power帯別ノルマ取得
// =====================================
function getKvkQuota(power) {
    const quotas = [
        { min: 150000000, max: 199999999, band: '150M-199.9M', killQuota: 600000000, deathQuota: 1340000 },
        { min: 100000000, max: 149999999, band: '100M-149.9M', killQuota: 600000000, deathQuota: 1005000 },
        { min: 95000000, max: 99999999, band: '95M-99.9M', killQuota: 300000000, deathQuota: 580000 },
        { min: 90000000, max: 94999999, band: '90M-94.9M', killQuota: 300000000, deathQuota: 551000 },
        { min: 85000000, max: 89999999, band: '85M-89.9M', killQuota: 200000000, deathQuota: 450000 },
        { min: 80000000, max: 84999999, band: '80M-84.9M', killQuota: 200000000, deathQuota: 425000 },
        { min: 75000000, max: 79999999, band: '75M-79.9M', killQuota: 187500000, deathQuota: 336000 },
        { min: 70000000, max: 74999999, band: '70M-74.9M', killQuota: 187500000, deathQuota: 315000 },
        { min: 65000000, max: 69999999, band: '65M-69.9M', killQuota: 150000000, deathQuota: 231000 },
        { min: 60000000, max: 64999999, band: '60M-64.9M', killQuota: 150000000, deathQuota: 214500 },
        { min: 45000000, max: 59999999, band: '45M-59.9M', killQuota: 75000000, deathQuota: 198000 }
    ];

    for (const quota of quotas) {
        if (power >= quota.min && power <= quota.max) {
            return quota;
        }
    }

    return { min: 0, max: 44999999, band: '45M未満', killQuota: 0, deathQuota: 0 };
}

// =====================================
// プログレスバー作成
// =====================================
function createProgressBar(progress, current, target, color) {
    const percentage = Math.min(100, Math.max(0, progress));
    const isAchieved = progress >= 100;

    return `
        <div style="width: 100%;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px;">
                <span style="color: #7f8c8d;">${formatNumber(current)}</span>
                <span style="color: ${color}; font-weight: 600;">${percentage.toFixed(1)}%</span>
            </div>
            <div style="background: #e0e0e0; border-radius: 8px; height: 8px; overflow: hidden; position: relative;">
                <div style="background: ${isAchieved ? '#27ae60' : color}; height: 100%; width: ${percentage}%; transition: width 0.3s ease; border-radius: 8px;"></div>
            </div>
            <div style="font-size: 10px; color: #7f8c8d; margin-top: 2px; text-align: right;">目標: ${formatNumber(target)}</div>
        </div>
    `;
}

// =====================================
// CSVデータ読み込み
// =====================================
async function loadCSVData() {
    try {
        console.log('CSV読み込み開始:', CSV_FILE_PATH);

        const response = await fetch(CSV_FILE_PATH);
        if (!response.ok) {
            throw new Error(`CSVファイルが見つかりません: ${CSV_FILE_PATH}`);
        }

        let csvText = await response.text();

        // BOM除去
        if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.substring(1);
        }

        // PapaParseでCSVを解析
        const parsed = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });

        if (!parsed || !parsed.data || !Array.isArray(parsed.data)) {
            throw new Error('CSVデータが正しく解析されませんでした');
        }

        allData = parsed.data;

        console.log(`データ読み込み完了: ${allData.length}件`);

        // 更新日時を設定
        const now = new Date();
        const updateDateElement = document.getElementById('updateDate');
        const dataCountElement = document.getElementById('dataCount');

        if (updateDateElement) {
            updateDateElement.textContent = now.toLocaleString('ja-JP');
        }
        if (dataCountElement) {
            dataCountElement.textContent = allData.length.toLocaleString();
        }

        // KVKノルマ一覧を初期化
        initKvkList();

    } catch (error) {
        console.error('CSVファイル読み込みエラー:', error);
        const tbody = document.getElementById('kvkListTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 60px 20px; color: #e74c3c;">
                        <h3>⚠️ CSVファイルの読み込みに失敗しました</h3>
                        <p>${escapeHtml(error.message)}</p>
                        <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            🔄 ページを再読み込み
                        </button>
                    </td>
                </tr>
            `;
        }
    }
}

// =====================================
// KVKノルマ一覧初期化
// =====================================
function initKvkList() {
    console.log('🚀 KVKノルマ一覧初期化開始');

    const kvkStartDate = '2025/09/24';

    // プレイヤーごとにグループ化
    const playerDataMap = new Map();

    allData.forEach(row => {
        const playerId = row.ID;
        if (!playerId) return;

        if (!playerDataMap.has(playerId)) {
            playerDataMap.set(playerId, []);
        }
        playerDataMap.get(playerId).push(row);
    });

    console.log('プレイヤー数:', playerDataMap.size);

    // 各プレイヤーの9/24からの増加を計算
    kvkListData = [];

    playerDataMap.forEach((records, playerId) => {
        records.sort((a, b) => new Date(a.Data) - new Date(b.Data));

        const kvkRecords = records.filter(r => r.Data >= kvkStartDate);
        if (kvkRecords.length === 0) return;

        const startRecord = kvkRecords[0];
        const latestRecord = kvkRecords[kvkRecords.length - 1];

        const t4Increase = parseValue(latestRecord['T4-Kills']) - parseValue(startRecord['T4-Kills']);
        const t5Increase = parseValue(latestRecord['T5-Kills']) - parseValue(startRecord['T5-Kills']);
        const killPointsIncrease = parseValue(latestRecord['Total Kill Points']) - parseValue(startRecord['Total Kill Points']);
        const deadTroopsIncrease = parseValue(latestRecord['Dead Troops']) - parseValue(startRecord['Dead Troops']);

        const currentPower = parseValue(latestRecord.Power);
        const quota = getKvkQuota(currentPower);

        const killProgress = quota.killQuota > 0 ? (killPointsIncrease / quota.killQuota) * 100 : 0;
        const deathProgress = quota.deathQuota > 0 ? (deadTroopsIncrease / quota.deathQuota) * 100 : 0;

        const killAchieved = killPointsIncrease >= quota.killQuota;
        const deathAchieved = deadTroopsIncrease >= quota.deathQuota;
        const bothAchieved = killAchieved && deathAchieved;

        kvkListData.push({
            id: playerId,
            name: latestRecord.Name,
            alliance: latestRecord.Alliance || 'no alliance',
            power: currentPower,
            powerBand: quota.band,
            t4Increase: t4Increase,
            t5Increase: t5Increase,
            killPointsIncrease: killPointsIncrease,
            deadTroopsIncrease: deadTroopsIncrease,
            killQuota: quota.killQuota,
            deathQuota: quota.deathQuota,
            killProgress: killProgress,
            deathProgress: deathProgress,
            killRemaining: Math.max(0, quota.killQuota - killPointsIncrease),
            deathRemaining: Math.max(0, quota.deathQuota - deadTroopsIncrease),
            killAchieved: killAchieved,
            deathAchieved: deathAchieved,
            bothAchieved: bothAchieved
        });
    });

    console.log('✅ KVKノルマ一覧データ件数:', kvkListData.length);

    // 期間表示を更新
    const periodElem = document.getElementById('kvkListPeriod');
    if (periodElem && allData.length > 0) {
        const dates = allData.map(row => row.Data).filter(d => d).sort();
        const latestDate = dates[dates.length - 1];
        periodElem.textContent = `9/24 - ${latestDate}`;
    }

    updateKvkList();
}

// =====================================
// KVKノルマ一覧更新
// =====================================
function updateKvkList() {
    console.log('🔄 updateKvkList実行');
    const tbody = document.getElementById('kvkListTableBody');
    if (!tbody) {
        console.error('❌ kvkListTableBodyが見つかりません');
        return;
    }

    if (kvkListData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 60px 20px; color: #7f8c8d;">
                    <h3>データがありません</h3>
                    <p>CSVファイルを読み込んでください</p>
                </td>
            </tr>
        `;
        return;
    }

    // フィルター処理
    const filterValue = document.getElementById('kvkListFilter')?.value || 'all';
    const searchValue = (document.getElementById('kvkListSearch')?.value || '').toLowerCase();

    let filteredList = kvkListData.filter(player => {
        if (searchValue) {
            const searchMatch =
                player.name.toLowerCase().includes(searchValue) ||
                player.id.toString().includes(searchValue) ||
                player.alliance.toLowerCase().includes(searchValue);
            if (!searchMatch) return false;
        }

        if (filterValue === 'achieved') return player.bothAchieved;
        if (filterValue === 'kill-achieved') return player.killAchieved;
        if (filterValue === 'death-achieved') return player.deathAchieved;
        if (filterValue === 'not-achieved') return !player.killAchieved || !player.deathAchieved;

        return true;
    });

    // ソート処理
    const sortValue = document.getElementById('kvkListSort')?.value || 'power-desc';

    filteredList.sort((a, b) => {
        switch (sortValue) {
            case 'power-desc': return b.power - a.power;
            case 'power-asc': return a.power - b.power;
            case 'kill-progress': return b.killProgress - a.killProgress;
            case 'death-progress': return b.deathProgress - a.deathProgress;
            case 'name': return a.name.localeCompare(b.name);
            default: return 0;
        }
    });

    // 統計を更新
    updateKvkListStats(filteredList);

    console.log('フィルター後の件数:', filteredList.length);

    if (filteredList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 60px 20px; color: #7f8c8d;">
                    <h3>該当するデータがありません</h3>
                    <p>フィルター条件を変更してください</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredList.map((player, index) => {
        let achievementBadge = '';
        if (player.bothAchieved) {
            achievementBadge = '<span style="background: #27ae60; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">✓ 達成</span>';
        } else if (player.killAchieved) {
            achievementBadge = '<span style="background: #e74c3c; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">撃破のみ</span>';
        } else if (player.deathAchieved) {
            achievementBadge = '<span style="background: #f39c12; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">戦死のみ</span>';
        } else {
            achievementBadge = '<span style="background: #95a5a6; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">未達成</span>';
        }

        return `
            <tr style="border-bottom: 1px solid #e0e0e0; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background=''">
                <td style="padding: 12px 15px; text-align: center; font-weight: 500; color: #7f8c8d;">${index + 1}</td>
                <td style="padding: 12px 15px; text-align: center; font-family: monospace; color: #34495e;">${escapeHtml(player.id)}</td>
                <td style="padding: 12px 15px; font-weight: 600; color: #2c3e50;">${escapeHtml(player.name)}</td>
                <td style="padding: 12px 15px; text-align: center;">
                    <div style="font-weight: 600; color: #3498db;">${formatNumber(player.power)}</div>
                    <div style="font-size: 11px; color: #7f8c8d;">${player.powerBand}</div>
                </td>
                <td style="padding: 12px 15px; text-align: right; color: #34495e;">${formatNumber(player.t4Increase)}</td>
                <td style="padding: 12px 15px; text-align: right; color: #34495e;">${formatNumber(player.t5Increase)}</td>
                <td style="padding: 12px 15px; text-align: right; font-weight: 600; color: #e74c3c;">${formatNumber(player.killPointsIncrease)}</td>
                <td style="padding: 12px 15px; text-align: right; font-weight: 600; color: #f39c12;">${formatNumber(player.deadTroopsIncrease)}</td>
                <td style="padding: 12px 15px;">
                    ${createProgressBar(player.killProgress, player.killPointsIncrease, player.killQuota, '#e74c3c')}
                </td>
                <td style="padding: 12px 15px;">
                    ${createProgressBar(player.deathProgress, player.deadTroopsIncrease, player.deathQuota, '#f39c12')}
                </td>
                <td style="padding: 12px 15px; text-align: center;">${achievementBadge}</td>
            </tr>
        `;
    }).join('');

    console.log('✅ テーブル描画完了: ' + filteredList.length + '件');
}

// =====================================
// 統計更新
// =====================================
function updateKvkListStats(filteredList) {
    const countElem = document.getElementById('kvkListCount');
    const killAchieversElem = document.getElementById('kvkListKillAchievers');
    const deathAchieversElem = document.getElementById('kvkListDeathAchievers');

    if (countElem) {
        countElem.textContent = `${filteredList.length}人`;
    }

    if (killAchieversElem) {
        const killAchievers = filteredList.filter(p => p.killAchieved).length;
        const killRate = filteredList.length > 0 ? ((killAchievers / filteredList.length) * 100).toFixed(1) : 0;
        killAchieversElem.textContent = `${killAchievers}人 (${killRate}%)`;
    }

    if (deathAchieversElem) {
        const deathAchievers = filteredList.filter(p => p.deathAchieved).length;
        const deathRate = filteredList.length > 0 ? ((deathAchievers / filteredList.length) * 100).toFixed(1) : 0;
        deathAchieversElem.textContent = `${deathAchievers}人 (${deathRate}%)`;
    }
}

// =====================================
// ページ読み込み時の処理
// =====================================
window.addEventListener('DOMContentLoaded', () => {
    console.log('🟢 DOM読み込み完了');
    loadCSVData();
});

console.log('🟢 kvkList.js 読み込み完了');
