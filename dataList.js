// =====================================
// データ一覧ページ専用JavaScript
// =====================================

// =====================================
// グローバル変数
// =====================================
let filteredData = [];
let currentPage = 1;
let itemsPerPage = 50;
let sortColumn = '';
let sortOrder = 'desc';
let currentDateFilter = {
    start: null,
    end: null
};

// =====================================
// 初期化
// =====================================
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🟢 dataList.js 読み込み開始');

    try {
        showLoading('tableBody', 'CSVファイルを読み込み中...');

        // CSVデータ読み込み（common.jsの関数を使用）
        await loadCSVData();

        filteredData = [...allData];

        // 統計情報を更新
        updateStats();

        // 日付入力の初期設定
        setupDateInputs();

        // データを表示
        displayData();

        console.log('✅ データ一覧ページ初期化完了');

    } catch (error) {
        console.error('初期化エラー:', error);
        showError(
            'tableBody',
            'データの読み込みに失敗しました',
            error.message,
            [
                'CSVファイル（Master_Data.csv）が同じフォルダにあることを確認',
                'ファイル名が正しいことを確認',
                'ブラウザのデベロッパーツールでネットワークエラーを確認'
            ]
        );
    }
});

// =====================================
// 統計情報更新
// =====================================
function updateStats() {
    // 総レコード数
    const totalRecordsElem = document.getElementById('totalRecords');
    if (totalRecordsElem) {
        totalRecordsElem.textContent = allData.length.toLocaleString();
    }

    // 最終データ日とPower上位300位合計
    if (allData.length > 0) {
        const dates = allData.map(row => row.Data).filter(d => d).sort();
        const lastDate = dates[dates.length - 1];

        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            lastUpdate.textContent = lastDate;
        }

        // 最終データ日のデータを抽出
        const lastDateData = allData.filter(row => row.Data === lastDate);

        // Powerでソートして上位300人を抽出
        const top300 = lastDateData
            .sort((a, b) => parseValue(b.Power) - parseValue(a.Power))
            .slice(0, 300);

        const top300PowerTotal = top300.reduce((sum, row) => sum + parseValue(row.Power), 0);

        const top300PowerElem = document.getElementById('top300Power');
        if (top300PowerElem) {
            top300PowerElem.textContent = formatNumber(top300PowerTotal);
        }
    }
}

// =====================================
// データフィルター関数
// =====================================
function filterData() {
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const dataMetric = document.getElementById('dataMetric').value;

    filteredData = allData.filter(row => {
        // 検索フィルター
        const searchMatch = !searchInput ||
            (row.Name && row.Name.toLowerCase().includes(searchInput)) ||
            (row.ID && row.ID.toString().includes(searchInput)) ||
            (row.Alliance && row.Alliance.toLowerCase().includes(searchInput));

        if (!searchMatch) return false;

        // 期間フィルター
        if (currentDateFilter.start && row.Data < currentDateFilter.start) return false;
        if (currentDateFilter.end && row.Data > currentDateFilter.end) return false;

        // 指標フィルター（特定の指標のみ表示する場合）
        // この機能は表示時に列を非表示にする方が適切なので、ここでは全て通過

        return true;
    });

    // ページを1に戻す
    currentPage = 1;

    displayData();
}

// =====================================
// 期間フィルター関数
// =====================================
function applyDataFilter() {
    const startDate = document.getElementById('dataStartDate').value;
    const endDate = document.getElementById('dataEndDate').value;

    if (startDate || endDate) {
        currentDateFilter.start = startDate ? startDate.replace(/-/g, '/') : null;
        currentDateFilter.end = endDate ? endDate.replace(/-/g, '/') : null;

        // 期間インジケーター表示
        const indicator = document.getElementById('dateRangeIndicator');
        const rangeText = document.getElementById('dateRangeText');
        if (indicator && rangeText) {
            indicator.style.display = 'block';
            rangeText.textContent = `${currentDateFilter.start || '最初'} ～ ${currentDateFilter.end || '最新'}`;
        }
    }

    filterData();
}

function clearDataFilter() {
    document.getElementById('dataStartDate').value = '';
    document.getElementById('dataEndDate').value = '';
    currentDateFilter = { start: null, end: null };

    const indicator = document.getElementById('dateRangeIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }

    filterData();
}

function setDataPreset(preset) {
    const dates = allData.map(row => row.Data).filter(d => d).sort();
    const maxDate = dates[dates.length - 1];

    const dataEndDate = document.getElementById('dataEndDate');
    const dataStartDate = document.getElementById('dataStartDate');

    // 日付を YYYY-MM-DD 形式に変換
    const formatDateForInput = (dateStr) => {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return dateStr;
    };

    switch (preset) {
        case 'latest':
            dataStartDate.value = formatDateForInput(maxDate);
            dataEndDate.value = formatDateForInput(maxDate);
            break;
        case 'week':
            const weekAgo = new Date(maxDate);
            weekAgo.setDate(weekAgo.getDate() - 7);
            dataStartDate.value = formatDateForInput(weekAgo.toISOString().split('T')[0].replace(/-/g, '/'));
            dataEndDate.value = formatDateForInput(maxDate);
            break;
        case 'month':
            const monthAgo = new Date(maxDate);
            monthAgo.setDate(monthAgo.getDate() - 30);
            dataStartDate.value = formatDateForInput(monthAgo.toISOString().split('T')[0].replace(/-/g, '/'));
            dataEndDate.value = formatDateForInput(maxDate);
            break;
        case 'all':
            dataStartDate.value = '';
            dataEndDate.value = '';
            break;
    }

    applyDataFilter();
}

// =====================================
// ソート機能
// =====================================
function sortTable(column) {
    // 同じ列をクリックした場合は昇順/降順を切り替え
    if (sortColumn === column) {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortOrder = 'desc';
    }

    // セレクトボックスを更新
    const sortColumnSelect = document.getElementById('dataSortColumn');
    const sortOrderSelect = document.getElementById('dataSortOrder');
    if (sortColumnSelect) sortColumnSelect.value = column;
    if (sortOrderSelect) sortOrderSelect.value = sortOrder;

    displayData();
}

function updateDataDisplay() {
    filterData();
}

function updateItemsPerPage() {
    const dataLimit = document.getElementById('dataLimit');
    if (dataLimit) {
        itemsPerPage = parseInt(dataLimit.value) || 50;
        currentPage = 1;
        displayData();
    }
}

// =====================================
// データ表示
// =====================================
function displayData() {
    // ソート処理
    const sortColumnSelect = document.getElementById('dataSortColumn');
    const sortOrderSelect = document.getElementById('dataSortOrder');

    if (sortColumnSelect && sortColumnSelect.value) {
        sortColumn = sortColumnSelect.value;
        sortOrder = sortOrderSelect ? sortOrderSelect.value : 'desc';
    }

    if (sortColumn) {
        filteredData.sort((a, b) => {
            let aVal = a[sortColumn];
            let bVal = b[sortColumn];

            // 数値列の場合
            if (['Power', 'T4-Kills', 'T5-Kills', 'Total Kill Points', 'Dead Troops', 'Troops Power'].includes(sortColumn)) {
                aVal = parseValue(aVal);
                bVal = parseValue(bVal);
            }

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }

    // ページネーション
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    // テーブルボディを更新
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    if (pageData.length === 0) {
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

    tbody.innerHTML = pageData.map((row, index) => `
        <tr>
            <td style="text-align: center;">${startIndex + index + 1}</td>
            <td>${escapeHtml(row.Data)}</td>
            <td>${escapeHtml(row.ID)}</td>
            <td>${escapeHtml(row.Name)}</td>
            <td style="text-align: right;">${formatNumber(row.Power)}</td>
            <td><span class="alliance-badge">${escapeHtml(row.Alliance || 'no alliance')}</span></td>
            <td style="text-align: right;">${formatNumber(row['T4-Kills'])}</td>
            <td style="text-align: right;">${formatNumber(row['T5-Kills'])}</td>
            <td style="text-align: right;">${formatNumber(row['Total Kill Points'])}</td>
            <td style="text-align: right;">${formatNumber(row['Dead Troops'])}</td>
            <td style="text-align: right;">${formatNumber(row['Troops Power'])}</td>
        </tr>
    `).join('');

    // ページネーション更新
    updatePagination();
}

// =====================================
// ページネーション
// =====================================
function updatePagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHTML = '';

    // 前へボタン
    paginationHTML += `
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            ‹ 前へ
        </button>
    `;

    // ページ番号ボタン
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        paginationHTML += `<button onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="page-info">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="changePage(${i})" ${i === currentPage ? 'class="active"' : ''}>
                ${i}
            </button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="page-info">...</span>`;
        }
        paginationHTML += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    // 次へボタン
    paginationHTML += `
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            次へ ›
        </button>
    `;

    // ページ情報
    paginationHTML += `
        <span class="page-info">
            ${currentPage} / ${totalPages} ページ (全 ${filteredData.length.toLocaleString()} 件)
        </span>
    `;

    pagination.innerHTML = paginationHTML;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    displayData();

    // ページトップにスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

console.log('✅ dataList.js 読み込み完了');
