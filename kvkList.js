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
let currentSort = { column: 'power', direction: 'desc' };
let currentPeriod = 'all'; // 現在選択中の期間

// =====================================
// 期間設定
// =====================================
const PERIOD_CONFIG = {
    all: {
        label: '全期間 (9/24～最新)',
        startDate: '2025/09/24',
        endDate: null // nullの場合は最新データまで
    },
    zone5: {
        label: 'ゾーン5 (10/8～10/12)',
        startDate: '2025/10/08',
        endDate: '2025/10/12'
    },
    darkness: {
        label: '暗黒戦 (10/18～10/24)',
        startDate: '2025/10/18',
        endDate: '2025/10/24'
    },
    gate7: {
        label: '関所7戦 (10/29～10/30)',
        startDate: '2025/10/29',
        endDate: '2025/10/30'
    }
};

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
            <div style="display: flex; justify-content: center; align-items: center; gap: 4px; margin-bottom: 3px;">
                <span style="color: ${color}; font-weight: 600; font-size: 13px;">${percentage.toFixed(1)}%</span>
            </div>
            <div style="background: #e0e0e0; border-radius: 8px; height: 8px; overflow: hidden; position: relative;">
                <div style="background: ${isAchieved ? '#27ae60' : color}; height: 100%; width: ${percentage}%; transition: width 0.3s ease; border-radius: 8px;"></div>
            </div>
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
// 期間設定関数
// =====================================
function setKvkPeriod(period) {
    console.log('🔄 期間変更:', period);
    currentPeriod = period;

    // ボタンのアクティブ状態を更新
    document.querySelectorAll('[id^="periodBtn"]').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`periodBtn${period.charAt(0).toUpperCase() + period.slice(1)}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // データを再計算
    initKvkList();
}

// =====================================
// KVKノルマ一覧初期化
// =====================================
function initKvkList() {
    console.log('🚀 KVKノルマ一覧初期化開始');

    const periodConfig = PERIOD_CONFIG[currentPeriod];
    const kvkStartDate = periodConfig.startDate;
    const kvkEndDate = periodConfig.endDate;

    console.log('集計期間:', kvkStartDate, '～', kvkEndDate || '最新');

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

    // 各プレイヤーの指定期間の増加を計算
    kvkListData = [];

    playerDataMap.forEach((records, playerId) => {
        records.sort((a, b) => new Date(a.Data) - new Date(b.Data));

        // 【全期間のデータ】9/24からの累計を取得（ノルマ基準用）
        const allPeriodRecords = records.filter(r => r.Data >= '2025/09/24');
        if (allPeriodRecords.length === 0) return;

        const allPeriodStartRecord = allPeriodRecords[0];
        const allPeriodLatestRecord = allPeriodRecords[allPeriodRecords.length - 1];

        // 9/24時点のPowerが45M未満のプレイヤーはスキップ
        const startPower = parseValue(allPeriodStartRecord.Power);
        if (startPower < 45000000) return;

        // 【全期間の増加量】（ノルマ判定用・表示用共通）
        const allPeriodKillPointsIncrease = parseValue(allPeriodLatestRecord['Total Kill Points']) - parseValue(allPeriodStartRecord['Total Kill Points']);
        const allPeriodDeadTroopsIncrease = parseValue(allPeriodLatestRecord['Dead Troops']) - parseValue(allPeriodStartRecord['Dead Troops']);
        const allPeriodT4Increase = parseValue(allPeriodLatestRecord['T4-Kills']) - parseValue(allPeriodStartRecord['T4-Kills']);
        const allPeriodT5Increase = parseValue(allPeriodLatestRecord['T5-Kills']) - parseValue(allPeriodStartRecord['T5-Kills']);

        // 最新データを取得（名前、同盟、Power用）
        const latestRecord = allPeriodLatestRecord;

        // 現在のPowerとノルマ基準
        const currentPower = parseValue(latestRecord.Power);
        const quota = getKvkQuota(currentPower);

        // ノルマ達成判定（全期間の増加量で計算）
        const killProgress = quota.killQuota > 0 ? (allPeriodKillPointsIncrease / quota.killQuota) * 100 : 0;
        const deathProgress = quota.deathQuota > 0 ? (allPeriodDeadTroopsIncrease / quota.deathQuota) * 100 : 0;

        const killAchieved = allPeriodKillPointsIncrease >= quota.killQuota;
        const deathAchieved = allPeriodDeadTroopsIncrease >= quota.deathQuota;
        const bothAchieved = killAchieved && deathAchieved;

        kvkListData.push({
            id: playerId,
            name: latestRecord.Name,
            alliance: latestRecord.Alliance || 'no alliance',
            power: currentPower,
            powerBand: quota.band,
            // 全期間の増加量（表示用・ノルマ計算用共通）
            t4Increase: allPeriodT4Increase,
            t5Increase: allPeriodT5Increase,
            killPointsIncrease: allPeriodKillPointsIncrease,
            deadTroopsIncrease: allPeriodDeadTroopsIncrease,
            // ノルマ基準値と達成状況
            killQuota: quota.killQuota,
            deathQuota: quota.deathQuota,
            killProgress: killProgress,
            deathProgress: deathProgress,
            killRemaining: Math.max(0, quota.killQuota - allPeriodKillPointsIncrease),
            deathRemaining: Math.max(0, quota.deathQuota - allPeriodDeadTroopsIncrease),
            killAchieved: killAchieved,
            deathAchieved: deathAchieved,
            bothAchieved: bothAchieved
        });
    });

    console.log('✅ KVKノルマ一覧データ件数:', kvkListData.length);

    // 期間表示を更新（常に全期間を表示）
    const periodElem = document.getElementById('kvkListPeriod');
    if (periodElem) {
        const dates = allData.map(row => row.Data).filter(d => d).sort();
        if (dates.length > 0) {
            const latestDate = dates[dates.length - 1];
            const startFormatted = '9/24';
            const latestFormatted = latestDate.substring(5).replace('/', '/');
            periodElem.textContent = `${startFormatted} - ${latestFormatted}`;
        }
    }

    updateKvkList();
}

// =====================================
// テーブルソート機能
// =====================================
function sortTable(column) {
    // 同じ列をクリックした場合は昇順/降順を切り替え
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'desc';
    }

    // 列ヘッダークリック時は、セレクトボックスを空にして手動ソートを有効化
    const sortSelect = document.getElementById('kvkListSort');
    if (sortSelect) {
        sortSelect.value = '';
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
    const sortValue = document.getElementById('kvkListSort')?.value || '';

    // セレクトボックスのソート値が設定されている場合はそれを使用
    if (sortValue) {
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
    } else {
        // 列クリックでのソート（currentSort変数を使用）
        filteredList.sort((a, b) => {
            let comparison = 0;

            switch (currentSort.column) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'power':
                    comparison = a.power - b.power;
                    break;
                case 't4':
                    comparison = a.t4Increase - b.t4Increase;
                    break;
                case 't5':
                    comparison = a.t5Increase - b.t5Increase;
                    break;
                case 'killPoints':
                    comparison = a.killPointsIncrease - b.killPointsIncrease;
                    break;
                case 'deadTroops':
                    comparison = a.deadTroopsIncrease - b.deadTroopsIncrease;
                    break;
                case 'killProgress':
                    comparison = a.killProgress - b.killProgress;
                    break;
                case 'deathProgress':
                    comparison = a.deathProgress - b.deathProgress;
                    break;
                case 'achievement':
                    // 達成状況でソート: 両方達成 > 撃破のみ > 戦死のみ > 未達成
                    const getAchievementScore = (p) => {
                        if (p.bothAchieved) return 4;
                        if (p.killAchieved) return 3;
                        if (p.deathAchieved) return 2;
                        return 1;
                    };
                    comparison = getAchievementScore(a) - getAchievementScore(b);
                    break;
                default:
                    comparison = a.power - b.power;
            }

            // 昇順/降順を適用
            return currentSort.direction === 'desc' ? -comparison : comparison;
        });
    }

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
            achievementBadge = '<span style="background: #27ae60; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">✓達成</span>';
        } else if (player.killAchieved) {
            achievementBadge = '<span style="background: #e74c3c; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">撃破</span>';
        } else if (player.deathAchieved) {
            achievementBadge = '<span style="background: #f39c12; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">戦死</span>';
        } else {
            achievementBadge = '<span style="background: #95a5a6; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">未達成</span>';
        }

        return `
            <tr style="border-bottom: 1px solid #e0e0e0; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background=''">
                <td style="padding: 12px 8px; text-align: center; font-weight: 500; color: #7f8c8d;">${index + 1}</td>
                <td style="padding: 12px 8px; text-align: center; color: #34495e;">${escapeHtml(player.id)}</td>
                <td style="padding: 12px 10px; text-align: center; word-break: break-word;">
                    <a href="index.html#individual-${escapeHtml(player.id)}" style="font-weight: 600; color: #3498db; text-decoration: none; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#2980b9'" onmouseout="this.style.color='#3498db'">${escapeHtml(player.name)}</a>
                </td>
                <td style="padding: 12px 8px; text-align: center;">
                    <div style="font-weight: 600; color: #3498db;">${formatNumber(player.power)}</div>
                    <div style="font-size: 11px; color: #7f8c8d;">${player.powerBand}</div>
                </td>
                <td style="padding: 12px 8px; text-align: center; color: #34495e;">${formatNumber(player.t4Increase)}</td>
                <td style="padding: 12px 8px; text-align: center; color: #34495e;">${formatNumber(player.t5Increase)}</td>
                <td style="padding: 12px 8px; text-align: center; font-weight: 600; color: #e74c3c;">${formatNumber(player.killPointsIncrease)}</td>
                <td style="padding: 12px 8px; text-align: center; font-weight: 600; color: #f39c12;">${formatNumber(player.deadTroopsIncrease)}</td>
                <td style="padding: 12px 10px;">
                    ${createProgressBar(player.killProgress, player.killPointsIncrease, player.killQuota, '#e74c3c')}
                </td>
                <td style="padding: 12px 10px;">
                    ${createProgressBar(player.deathProgress, player.deadTroopsIncrease, player.deathQuota, '#f39c12')}
                </td>
                <td style="padding: 12px 8px; text-align: center;">${achievementBadge}</td>
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
