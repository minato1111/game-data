// ========================================
// データ一覧ページ - dataList.js
// ========================================

// ページ固有の変数
let filteredData = [];
let currentPage = 1;
let itemsPerPage = 100;
let sortColumn = 'Power';
let sortOrder = 'desc';

// ========================================
// 初期化
// ========================================

window.addEventListener('DOMContentLoaded', async () => {
    try {
        // CSVデータ読み込み
        await loadCSVData();

        // CSV情報表示
        await displayCSVInfo();

        // データ初期化
        filteredData = [...allData];

        // 日付入力の範囲設定
        setupDateInputs();

        // 最新データを表示（デフォルトでPowerの降順）
        sortData('Power', 'desc');

        // 初期表示
        displayData();
        updateFilteredStats();

    } catch (error) {
        console.error('初期化エラー:', error);
        const tbody = document.getElementById('tableBody');
        showError(tbody, 'データの読み込みに失敗しました');
    }
});

// ========================================
// 日付入力の初期設定
// ========================================

function setupDateInputs() {
    if (allData.length === 0) return;

    const dates = allData.map(row => row.Date).filter(d => d).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    const formatDateForInput = (dateStr) => {
        const parts = dateStr.split('/');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    };

    const dataStartInput = document.getElementById('dataStartDate');
    const dataEndInput = document.getElementById('dataEndDate');

    if (minDate && maxDate && dataStartInput && dataEndInput) {
        const formattedMin = formatDateForInput(minDate);
        const formattedMax = formatDateForInput(maxDate);

        dataStartInput.min = formattedMin;
        dataStartInput.max = formattedMax;
        dataEndInput.min = formattedMin;
        dataEndInput.max = formattedMax;
    }
}

// ========================================
// フィルター機能
// ========================================

/**
 * 日付フィルターのプリセット設定
 */
function setDataPreset(preset) {
    const dates = allData.map(row => row.Date).filter(d => d).sort();
    if (dates.length === 0) return;

    const latestDate = dates[dates.length - 1];
    let startDate = dates[0];

    if (preset === 'latest') {
        // 最新データのみ
        startDate = latestDate;
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
    }

    const formatDateForInput = (dateStr) => {
        const parts = dateStr.split('/');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    };

    document.getElementById('dataStartDate').value = formatDateForInput(startDate);
    document.getElementById('dataEndDate').value = formatDateForInput(latestDate);

    applyDataFilter();
}

/**
 * 日付フィルターの適用
 */
function applyDataFilter() {
    const startDate = document.getElementById('dataStartDate').value;
    const endDate = document.getElementById('dataEndDate').value;

    if (!startDate && !endDate) {
        alert('開始日または終了日を選択してください');
        return;
    }

    const formatToSlash = (dateStr) => {
        if (!dateStr) return null;
        return dateStr.replace(/-/g, '/');
    };

    const startFormatted = formatToSlash(startDate);
    const endFormatted = formatToSlash(endDate);

    filteredData = allData.filter(row => {
        const rowDate = row.Date;
        if (!rowDate) return false;

        const compareDate = new Date(rowDate);
        const start = startFormatted ? new Date(startFormatted) : new Date('1900/01/01');
        const end = endFormatted ? new Date(endFormatted) : new Date('2100/12/31');

        return compareDate >= start && compareDate <= end;
    });

    // フィルター表示インジケーター更新
    const indicator = document.getElementById('dateRangeIndicator');
    const rangeText = document.getElementById('dateRangeText');

    if (indicator && rangeText) {
        indicator.style.display = 'block';
        rangeText.textContent = `${startFormatted || '開始'} ～ ${endFormatted || '終了'}`;
    }

    // 検索フィルターも適用
    const searchTerm = document.getElementById('searchInput').value;
    if (searchTerm) {
        filteredData = searchPlayers(filteredData, searchTerm);
    }

    currentPage = 1;
    displayData();
    updateFilteredStats();
}

/**
 * 日付フィルターのクリア
 */
function clearDataFilter() {
    document.getElementById('dataStartDate').value = '';
    document.getElementById('dataEndDate').value = '';

    const indicator = document.getElementById('dateRangeIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }

    filteredData = [...allData];

    // 検索フィルターも適用
    const searchTerm = document.getElementById('searchInput').value;
    if (searchTerm) {
        filteredData = searchPlayers(filteredData, searchTerm);
    }

    currentPage = 1;
    displayData();
    updateFilteredStats();
}

/**
 * 検索フィルター（デバウンス付き）
 */
const filterBySearchDebounced = debounce(() => {
    const searchTerm = document.getElementById('searchInput').value;

    // 日付フィルターを適用
    const startDate = document.getElementById('dataStartDate').value;
    const endDate = document.getElementById('dataEndDate').value;

    if (startDate || endDate) {
        const formatToSlash = (dateStr) => {
            if (!dateStr) return null;
            return dateStr.replace(/-/g, '/');
        };

        const startFormatted = formatToSlash(startDate);
        const endFormatted = formatToSlash(endDate);

        filteredData = allData.filter(row => {
            const rowDate = row.Date;
            if (!rowDate) return false;

            const compareDate = new Date(rowDate);
            const start = startFormatted ? new Date(startFormatted) : new Date('1900/01/01');
            const end = endFormatted ? new Date(endFormatted) : new Date('2100/12/31');

            return compareDate >= start && compareDate <= end;
        });
    } else {
        filteredData = [...allData];
    }

    // 検索フィルター適用
    if (searchTerm) {
        filteredData = searchPlayers(filteredData, searchTerm);
    }

    currentPage = 1;
    displayData();
    updateFilteredStats();
}, PERFORMANCE_CONFIG.DEBOUNCE_DELAY);

// ========================================
// 表示制御
// ========================================

/**
 * 表示件数の更新
 */
function updateItemsPerPage() {
    itemsPerPage = parseInt(document.getElementById('dataLimit').value);
    currentPage = 1;
    displayData();
}

/**
 * 統計情報の更新
 */
function updateFilteredStats() {
    const totalRecordsElement = document.getElementById('totalRecords');
    if (totalRecordsElement) {
        totalRecordsElement.textContent =
            `${formatNumber(filteredData.length)} / ${formatNumber(allData.length)}`;
    }
}

// ========================================
// データ表示
// ========================================

/**
 * テーブルにデータを表示
 */
function displayData() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    const tbody = document.getElementById('tableBody');

    if (pageData.length === 0) {
        showNoData(tbody, 'データが見つかりません。検索条件を変更してください。');
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = pageData.map((row, index) => {
        const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #7f8c8d; background: #f8f9fa;">${rowNumber}</td>
                <td>${escapeHtml(row.Date || '')}</td>
                <td>${escapeHtml(row.ID || '')}</td>
                <td>
                    <a href="individual.html?id=${encodeURIComponent(row.ID || '')}&name=${encodeURIComponent(row.Name || '')}"
                       style="color: #3498db; text-decoration: none; cursor: pointer; transition: color 0.3s;"
                       onmouseover="this.style.color='#2980b9'"
                       onmouseout="this.style.color='#3498db'">
                        ${escapeHtml(row.Name || '')}
                    </a>
                </td>
                <td>${formatNumber(row.Power)}</td>
                <td><span class="alliance-badge">${escapeHtml(row.Alliance || '')}</span></td>
                <td>${formatNumber(row['T4-Kills'])}</td>
                <td>${formatNumber(row['T5-Kills'])}</td>
                <td>${formatNumber(row['Total Kill Points'])}</td>
                <td>${formatNumber(row['Dead Troops'])}</td>
                <td>${formatNumber(row['Troops Power'])}</td>
            </tr>
        `;
    }).join('');

    displayPagination();
}

/**
 * ページネーション表示
 */
function displayPagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const pagination = document.getElementById('pagination');

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    html += `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>前へ</button>`;

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        html += `<button onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span>...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button onclick="goToPage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span>...</span>`;
        html += `<button onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>次へ</button>`;
    html += `<span class="page-info">${formatNumber(filteredData.length)}件中 ${formatNumber((currentPage - 1) * itemsPerPage + 1)}-${formatNumber(Math.min(currentPage * itemsPerPage, filteredData.length))}件</span>`;

    pagination.innerHTML = html;
}

/**
 * ページ移動
 */
function goToPage(page) {
    currentPage = page;
    displayData();
    window.scrollTo(0, 0);
}

// ========================================
// ソート機能
// ========================================

/**
 * データのソート
 */
function sortData(column, order) {
    sortColumn = column;
    sortOrder = order;

    // 現在のフィルター条件を維持してソート
    filteredData.sort((a, b) => {
        let aVal = a[column] || '';
        let bVal = b[column] || '';

        // 数値列の処理
        if (['ID', 'Power', 'T4-Kills', 'T5-Kills', 'Total Kill Points', 'Dead Troops', 'Troops Power'].includes(column)) {
            aVal = parseInt(aVal.toString().replace(/,/g, '')) || 0;
            bVal = parseInt(bVal.toString().replace(/,/g, '')) || 0;
        }

        // 日付列の処理
        if (column === 'Date') {
            aVal = parseDate(aVal || '1900/01/01');
            bVal = parseDate(bVal || '1900/01/01');
        }

        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
    });

    currentPage = 1;
    displayData();
    updateSortIndicators();
}

/**
 * ソートインジケーターの更新
 */
function updateSortIndicators() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.dataset.column === sortColumn) {
            th.classList.add(`sorted-${sortOrder}`);
        }
    });

    const dataSortColumn = document.getElementById('dataSortColumn');
    const dataSortOrder = document.getElementById('dataSortOrder');

    if (dataSortColumn) dataSortColumn.value = sortColumn;
    if (dataSortOrder) dataSortOrder.value = sortOrder;
}

/**
 * ソート列とソート順をセレクトボックスから適用
 */
function applySortFromSelect() {
    const column = document.getElementById('dataSortColumn').value;
    const order = document.getElementById('dataSortOrder').value;

    if (column && order) {
        sortData(column, order);
    }
}
