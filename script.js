// =====================================
// ROK Kingdom Data 分析ツール - 修正版
// =====================================

const CSV_FILE_PATH = 'Master_Data.csv';
const DEBUG_MODE = true; // デバッグ用

// パフォーマンス設定
const PERFORMANCE_CONFIG = {
    CACHE_DURATION: 300000,
    CHUNK_SIZE: 1000,
    MAX_ERROR_DISPLAY: 5,
    PAGINATION_SIZE: 50,
    DEBOUNCE_DELAY: 500,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

// ユーティリティ関数
function formatNumber(value) {
    if (value == null || value === '') return '';
    const num = parseInt(value.toString().replace(/,/g, '')) || 0;
    return num.toLocaleString();
}

function isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
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

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// DOM要素キャッシュ（改善版）
const domCache = {};
const getElement = (id) => {
    if (!domCache[id]) {
        const element = document.getElementById(id);
        if (element) {
            domCache[id] = element;
        }
        return element;
    }
    if (!document.contains(domCache[id])) {
        delete domCache[id];
        return document.getElementById(id);
    }
    return domCache[id];
};

const clearDOMCache = () => {
    Object.keys(domCache).forEach(key => {
        if (!document.contains(domCache[key])) {
            delete domCache[key];
        }
    });
};

// 定期的なメモリクリーンアップ
setInterval(() => {
    clearDOMCache();
    if (DEBUG_MODE) {
        console.log('DOM cache cleared. Current cache size:', Object.keys(domCache).length);
    }
}, 5 * 60 * 1000);

// グローバル変数
let allData = [];
let filteredData = [];
let currentPage = 1;
let itemsPerPage = 50;
let sortColumn = '';
let sortOrder = 'asc';

// ローディング表示
function showLoading(message = '読み込み中...') {
    const tbody = document.getElementById('tableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="loading">
                    <div class="loading-spinner"></div>
                    <p>${message}</p>
                </td>
            </tr>
        `;
    }
}

// エラー表示
function showError(title, message, suggestions = []) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    let suggestionsHtml = '';
    if (suggestions.length > 0) {
        suggestionsHtml = `
            <div style="margin-top: 15px;">
                <strong>解決方法:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    ${suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="11" class="error-message">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(message)}</p>
                ${suggestionsHtml}
                <button onclick="location.reload()">ページを再読み込み</button>
            </td>
        </tr>
    `;
}

// CSV読み込み
async function loadCSVData() {
    showLoading('CSVファイルを読み込み中...');

    try {
        if (DEBUG_MODE) console.log('CSV読み込み開始:', CSV_FILE_PATH);

        if (typeof Papa === 'undefined') {
            throw new Error('PapaParseライブラリが読み込まれていません');
        }

        const response = await fetch(CSV_FILE_PATH);
        if (!response.ok) {
            throw new Error(`CSVファイル取得エラー: ${response.status}`);
        }

        const csvText = await response.text();
        if (!csvText || csvText.length < 10) {
            throw new Error('CSVファイルが空か無効です');
        }

        const parsed = await new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data && results.data.length > 0) {
                        resolve(results.data);
                    } else {
                        reject(new Error('CSVデータが空です'));
                    }
                },
                error: reject
            });
        });

        allData = parsed;
        filteredData = [...allData];

        // 統計情報を計算してUI更新
        updateStatistics();
        displayData();

        if (DEBUG_MODE) {
            console.log('CSV読み込み完了:', allData.length);
        }

    } catch (error) {
        console.error('CSV読み込みエラー:', error);
        showError(
            'データ読み込みエラー',
            error.message,
            ['ページを再読み込みしてください', 'ブラウザのキャッシュをクリアしてください']
        );
    }
}

// 統計情報更新
function updateStatistics() {
    const totalRecords = allData.length;
    const lastUpdate = totalRecords > 0 ? allData[allData.length - 1].Data : null;

    // Power上位300人の合計
    const powerData = allData
        .map(item => ({
            ...item,
            PowerNum: parseInt(item.Power?.toString().replace(/,/g, '')) || 0
        }))
        .sort((a, b) => b.PowerNum - a.PowerNum)
        .slice(0, 300);

    const top300Power = powerData.reduce((sum, item) => sum + item.PowerNum, 0);

    // UI更新
    const elements = {
        totalRecords: getElement('totalRecords'),
        top300Power: getElement('top300Power'),
        lastUpdate: getElement('lastUpdate'),
        updateDate: getElement('updateDate'),
        dataCount: getElement('dataCount')
    };

    if (elements.totalRecords) elements.totalRecords.textContent = formatNumber(totalRecords);
    if (elements.top300Power) elements.top300Power.textContent = formatNumber(top300Power);
    if (elements.lastUpdate) elements.lastUpdate.textContent = lastUpdate || '-';
    if (elements.updateDate) elements.updateDate.textContent = lastUpdate || '不明';
    if (elements.dataCount) elements.dataCount.textContent = formatNumber(totalRecords);
}

// データ表示
function displayData() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="no-data">
                    <h2>データが見つかりません</h2>
                    <p>検索条件を確認してください</p>
                </td>
            </tr>
        `;
        return;
    }

    const rows = pageData.map((row, index) => {
        const globalIndex = startIndex + index + 1;
        return `
            <tr>
                <td style="text-align: center;">${globalIndex}</td>
                <td>${escapeHtml(row.Data || '')}</td>
                <td>${escapeHtml(row.ID || '')}</td>
                <td>${escapeHtml(row.Name || '')}</td>
                <td style="text-align: right;">${formatNumber(row.Power || 0)}</td>
                <td><span class="alliance-badge">${escapeHtml(row.Alliance || '')}</span></td>
                <td style="text-align: right;">${formatNumber(row['T4-Kills'] || 0)}</td>
                <td style="text-align: right;">${formatNumber(row['T5-Kills'] || 0)}</td>
                <td style="text-align: right;">${formatNumber(row['Total Kill Points'] || 0)}</td>
                <td style="text-align: right;">${formatNumber(row['Dead Troops'] || 0)}</td>
                <td style="text-align: right;">${formatNumber(row['Troops Power'] || 0)}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;
    updatePagination();
}

// ページネーション更新
function updatePagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHTML = '';

    // 前のページボタン
    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    paginationHTML += `<button ${prevDisabled} onclick="changePage(${currentPage - 1})">前へ</button>`;

    // ページ番号
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        paginationHTML += `<button class="${activeClass}" onclick="changePage(${i})">${i}</button>`;
    }

    // 次のページボタン
    const nextDisabled = currentPage === totalPages ? 'disabled' : '';
    paginationHTML += `<button ${nextDisabled} onclick="changePage(${currentPage + 1})">次へ</button>`;

    // ページ情報
    paginationHTML += `<span class="page-info">${currentPage} / ${totalPages} ページ</span>`;

    pagination.innerHTML = paginationHTML;
}

// ページ変更
function changePage(page) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    displayData();
}

// 検索機能
function filterDataBySearch() {
    const searchInput = getElement('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (!searchTerm) {
        filteredData = [...allData];
    } else {
        filteredData = allData.filter(row => {
            return (
                (row.Name && row.Name.toLowerCase().includes(searchTerm)) ||
                (row.ID && row.ID.toString().includes(searchTerm)) ||
                (row.Alliance && row.Alliance.toLowerCase().includes(searchTerm))
            );
        });
    }

    currentPage = 1;
    displayData();
}

// イベントリスナー設定
function setupEventListeners() {
    const debouncedSearch = debounce(filterDataBySearch, PERFORMANCE_CONFIG.DEBOUNCE_DELAY);
    const searchInput = getElement('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debouncedSearch);
    }
}

// エラーハンドラー
window.addEventListener('error', function(event) {
    const ignoredErrors = [
        'message channel closed',
        'Non-Error promise rejection captured',
        'Script error',
        'ResizeObserver loop limit exceeded'
    ];

    const errorMessage = event.error?.message || event.message || '';

    if (ignoredErrors.some(ignored => errorMessage.includes(ignored))) {
        if (DEBUG_MODE) {
            console.warn('無視されたエラー:', errorMessage);
        }
        return;
    }

    console.error('アプリケーションエラー:', {
        message: errorMessage,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack
    });

    if (errorMessage) {
        showError(
            'システムエラー',
            '予期しないエラーが発生しました。',
            ['ページを再読み込みしてください', 'ブラウザのキャッシュをクリアしてください']
        );
    }
});

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    if (DEBUG_MODE) console.log('DOM読み込み完了');

    setupEventListeners();
    loadCSVData();
});

console.log('ROK Kingdom Data - 修正版 読み込み完了');