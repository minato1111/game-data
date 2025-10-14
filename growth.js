// ========================================
// 成長ランキングページ - growth.js
// ========================================

// ページ固有の変数
let allGrowthData = [];
let currentGrowthData = [];
let filteredGrowthData = [];
let growthSortColumn = 'difference';
let growthSortOrder = 'desc';

// ========================================
// 初期化
// ========================================

window.addEventListener('DOMContentLoaded', async () => {
    try {
        // CSVデータ読み込み
        await loadCSVData();

        // CSV情報表示
        await displayCSVInfo();

    } catch (error) {
        console.error('初期化エラー:', error);
        const tbody = document.getElementById('growthTableBody');
        showError(tbody, 'データの読み込みに失敗しました');
    }
});

// ========================================
// プリセット期間の設定
// ========================================

function setGrowthPreset(preset) {
    const dates = allData.map(row => row.Date).filter(d => d).sort();
    if (dates.length === 0) return;

    const latestDate = dates[dates.length - 1];
    let startDate = dates[0];

    if (preset === 'latest') {
        // 最新データ（最新日と前回のデータ日を比較）
        const uniqueDates = [...new Set(dates)].sort();
        if (uniqueDates.length >= 2) {
            startDate = uniqueDates[uniqueDates.length - 2];
        } else {
            startDate = uniqueDates[0];
        }
    } else if (preset === 'week') {
        // 7日前を計算
        const latest = new Date(latestDate);
        const weekAgo = new Date(latest);
        weekAgo.setDate(latest.getDate() - 7);

        startDate = dates.reduce((prev, curr) => {
            return Math.abs(new Date(curr) - weekAgo) < Math.abs(new Date(prev) - weekAgo) ? curr : prev;
        });
    } else if (preset === 'month') {
        // 30日前を計算
        const latest = new Date(latestDate);
        const monthAgo = new Date(latest);
        monthAgo.setDate(latest.getDate() - 30);

        startDate = dates.reduce((prev, curr) => {
            return Math.abs(new Date(curr) - monthAgo) < Math.abs(new Date(prev) - monthAgo) ? curr : prev;
        });
    } else if (preset === 'all') {
        // 全期間
        startDate = dates[0];
    }

    const formatDateForInput = (dateStr) => {
        const parts = dateStr.split('/');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    };

    document.getElementById('growthStartDate').value = formatDateForInput(startDate);
    document.getElementById('growthEndDate').value = formatDateForInput(latestDate);

    applyGrowthFilter();
}

// ========================================
// 成長フィルターの適用・クリア
// ========================================

function applyGrowthFilter() {
    const startDate = document.getElementById('growthStartDate').value;
    const endDate = document.getElementById('growthEndDate').value;

    if (!startDate || !endDate) {
        alert('開始日と終了日を選択してください');
        return;
    }

    // 期間情報を表示
    const startFormatted = startDate.replace(/-/g, '/');
    const endFormatted = endDate.replace(/-/g, '/');

    document.getElementById('growthPeriodDisplay').textContent = `${startFormatted} ～ ${endFormatted}`;

    updateGrowthRanking();
}

function clearGrowthFilter() {
    document.getElementById('growthStartDate').value = '';
    document.getElementById('growthEndDate').value = '';
    document.getElementById('growthPeriodDisplay').textContent = '未選択';
    document.getElementById('growthAnalysisCount').textContent = '0';
    document.getElementById('growthTopPlayer').textContent = '-';

    // テーブルを初期状態に戻す
    document.getElementById('growthTableBody').innerHTML = `
        <tr>
            <td colspan="9" style="text-align: center; padding: 60px 20px; color: #7f8c8d;">
                <h3>期間を選択して「適用」をクリックしてください</h3>
                <p>またはプリセットボタンから期間を選択できます</p>
            </td>
        </tr>
    `;
}

// ========================================
// 成長ランキングの更新
// ========================================

function updateGrowthRanking() {
    const startDate = document.getElementById('growthStartDate').value;
    const endDate = document.getElementById('growthEndDate').value;

    if (!startDate || !endDate) {
        return;
    }

    const startFormatted = startDate.replace(/-/g, '/');
    const endFormatted = endDate.replace(/-/g, '/');
    const metric = document.getElementById('growthMetric').value;
    const limit = parseInt(document.getElementById('growthLimit').value);
    const sortBy = document.getElementById('growthSort').value;
    const filterType = document.getElementById('growthFilter').value;

    // 開始日と終了日のデータを取得
    const startData = allData.filter(row => row.Date === startFormatted);
    const endData = allData.filter(row => row.Date === endFormatted);

    if (startData.length === 0 || endData.length === 0) {
        document.getElementById('growthTableBody').innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 60px 20px; color: #7f8c8d;">
                    <h3>選択した期間のデータが見つかりません</h3>
                    <p>開始日: ${startFormatted} (${startData.length}件)</p>
                    <p>終了日: ${endFormatted} (${endData.length}件)</p>
                </td>
            </tr>
        `;
        allGrowthData = [];
        currentGrowthData = [];
        filteredGrowthData = [];
        return;
    }

    // プレイヤーごとの成長を計算
    const growthData = [];
    const endDataMap = {};

    // 終了日のデータをIDでマッピング
    endData.forEach(row => {
        if (row.ID) {
            endDataMap[row.ID] = row;
        }
    });

    // 開始日のデータを基準に成長を計算
    startData.forEach(startRow => {
        if (!startRow.ID) return;

        const endRow = endDataMap[startRow.ID];
        if (!endRow) return;

        const startValue = parseInt((startRow[metric] || '0').toString().replace(/,/g, '')) || 0;
        const endValue = parseInt((endRow[metric] || '0').toString().replace(/,/g, '')) || 0;
        const difference = endValue - startValue;
        const growthRate = startValue > 0 ? (difference / startValue * 100) : 0;

        // フィルター適用
        if (filterType === 'growth' && difference <= 0) return;
        if (filterType === 'decline' && difference >= 0) return;

        // 期間の日数を計算
        const startDateObj = new Date(startFormatted);
        const endDateObj = new Date(endFormatted);
        const days = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) || 1;
        const dailyAverage = difference / days;

        growthData.push({
            id: startRow.ID,
            name: endRow.Name || startRow.Name || 'Unknown',
            alliance: endRow.Alliance || startRow.Alliance || '',
            startValue: startValue,
            endValue: endValue,
            difference: difference,
            growthRate: growthRate,
            dailyAverage: dailyAverage,
            days: days
        });
    });

    // 全データを保存（ソート・検索用）
    allGrowthData = [...growthData];

    // ソート
    if (sortBy === 'amount') {
        growthData.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    } else if (sortBy === 'rate') {
        growthData.sort((a, b) => Math.abs(b.growthRate) - Math.abs(a.growthRate));
    } else if (sortBy === 'current') {
        growthData.sort((a, b) => b.endValue - a.endValue);
    }

    // 表示数制限
    const displayData = growthData.slice(0, limit);
    currentGrowthData = displayData;
    filteredGrowthData = [...displayData];

    // データ件数を更新
    document.getElementById('growthAnalysisCount').textContent = displayData.length;

    // 最大成長者を表示
    if (displayData.length > 0 && sortBy === 'amount') {
        const topPlayer = displayData[0];
        const formatValue = (value) => {
            if (Math.abs(value) >= 1000000000) return (value / 1000000000).toFixed(2) + 'B';
            if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value.toLocaleString();
        };
        const symbol = topPlayer.difference > 0 ? '+' : '';
        document.getElementById('growthTopPlayer').textContent =
            `${topPlayer.name} (${symbol}${formatValue(topPlayer.difference)})`;
    }

    // テーブルに表示
    displayGrowthTable(displayData);
}

// ========================================
// 成長ランキングテーブルの表示
// ========================================

function displayGrowthTable(data) {
    const tbody = document.getElementById('growthTableBody');

    if (data.length === 0) {
        showNoData(tbody, 'データが見つかりません');
        return;
    }

    tbody.innerHTML = data.map((row, index) => {
        const formatValue = (value) => {
            if (Math.abs(value) >= 1000000000) return (value / 1000000000).toFixed(2) + 'B';
            if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K';
            return formatNumber(value);
        };

        const diffColor = row.difference > 0 ? '#27ae60' : row.difference < 0 ? '#e74c3c' : '#7f8c8d';
        const diffSymbol = row.difference > 0 ? '+' : '';

        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #7f8c8d; background: #f8f9fa;">${index + 1}</td>
                <td style="text-align: center;">${escapeHtml(row.id || '')}</td>
                <td>
                    <a href="individual.html?id=${encodeURIComponent(row.id || '')}&name=${encodeURIComponent(row.name || '')}"
                       style="color: #3498db; text-decoration: none; cursor: pointer;"
                       onmouseover="this.style.color='#2980b9'"
                       onmouseout="this.style.color='#3498db'">
                        ${escapeHtml(row.name)}
                    </a>
                </td>
                <td><span class="alliance-badge">${escapeHtml(row.alliance)}</span></td>
                <td style="text-align: right;">${formatNumber(row.startValue)}</td>
                <td style="text-align: right;">${formatNumber(row.endValue)}</td>
                <td style="text-align: right; color: ${diffColor}; font-weight: 600;">
                    ${diffSymbol}${formatValue(row.difference)}
                </td>
                <td style="text-align: right; color: ${diffColor}; font-weight: 600;">
                    ${diffSymbol}${row.growthRate.toFixed(2)}%
                </td>
                <td style="text-align: right;">${formatValue(row.dailyAverage)}</td>
            </tr>
        `;
    }).join('');
}

// ========================================
// ソート機能
// ========================================

function sortGrowthTable(column) {
    // データが存在するかチェック
    if (!allGrowthData || allGrowthData.length === 0) {
        return;
    }

    // ソート順を切り替え
    if (growthSortColumn === column) {
        growthSortOrder = growthSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        growthSortColumn = column;
        growthSortOrder = ['difference', 'growthRate', 'endValue', 'startValue', 'dailyAverage'].includes(column) ? 'desc' : 'asc';
    }

    // 全データをソート
    const sortedData = [...allGrowthData];
    sortedData.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];

        // 数値系フィールドの場合は数値として比較
        if (['difference', 'growthRate', 'endValue', 'startValue', 'dailyAverage'].includes(column)) {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else if (column === 'id') {
            aVal = parseInt(aVal) || 0;
            bVal = parseInt(bVal) || 0;
        } else if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = typeof bVal === 'string' ? bVal.toLowerCase() : String(bVal).toLowerCase();
        }

        if (aVal < bVal) return growthSortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return growthSortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    // 表示制限を適用
    const limit = parseInt(document.getElementById('growthLimit').value);
    const displayData = limit === 9999 ? sortedData : sortedData.slice(0, limit);

    // 検索フィルターが適用されている場合は検索条件も適用
    const searchTerm = document.getElementById('growthSearchInput').value.toLowerCase().trim();
    let finalData = displayData;

    if (searchTerm) {
        finalData = displayData.filter(row => {
            return (
                (row.name && row.name.toLowerCase().includes(searchTerm)) ||
                (row.id && row.id.toString().includes(searchTerm)) ||
                (row.alliance && row.alliance.toLowerCase().includes(searchTerm))
            );
        });
    }

    currentGrowthData = finalData;
    filteredGrowthData = [...finalData];

    displayGrowthTable(finalData);
}

// ========================================
// 検索機能
// ========================================

function filterGrowthBySearch() {
    const searchTerm = document.getElementById('growthSearchInput').value.toLowerCase().trim();

    if (!searchTerm) {
        // 検索キーワードがない場合は現在の表示データを復元
        filteredGrowthData = [...currentGrowthData];
    } else {
        // 検索フィルターを適用
        filteredGrowthData = currentGrowthData.filter(row => {
            return (
                (row.name && row.name.toLowerCase().includes(searchTerm)) ||
                (row.id && row.id.toString().includes(searchTerm)) ||
                (row.alliance && row.alliance.toLowerCase().includes(searchTerm))
            );
        });
    }

    displayGrowthTable(filteredGrowthData);
}
