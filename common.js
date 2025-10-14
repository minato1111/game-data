// =====================================
// 共通設定値
// =====================================
const CSV_FILE_PATH = 'Master_Data.csv';
const DEBUG_MODE = false; // 本番環境では false、開発時は true

// パフォーマンス設定
const PERFORMANCE_CONFIG = {
    CACHE_DURATION: 300000, // キャッシュ時間（5分）
    CHUNK_SIZE: 1000,       // チャンク処理サイズ
    MAX_ERROR_DISPLAY: 5,   // 表示する最大エラー数
    PAGINATION_SIZE: 50     // デフォルトページネーションサイズ
};

// =====================================
// グローバル変数
// =====================================
let allData = [];

// =====================================
// ユーティリティ関数
// =====================================

// 数値のフォーマット関数
function formatNumber(value) {
    if (value == null || value === '') return '';
    const num = parseInt(value.toString().replace(/,/g, '')) || 0;
    return num.toLocaleString();
}

// 数値のパース関数
function parseValue(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return value;
    return parseInt(value.toString().replace(/,/g, '')) || 0;
}

// 日付のバリデーション関数
function isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
}

// HTML エスケープ関数
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

// デバウンス関数
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

// DOM要素キャッシュ
const domCache = {};
const getElement = (id) => {
    if (!domCache[id]) {
        domCache[id] = document.getElementById(id);
    }
    return domCache[id];
};

// =====================================
// エラーハンドリング
// =====================================

// グローバルエラーハンドラー（Chrome拡張機能エラー除外版）
window.addEventListener('error', function(event) {
    const errorMessage = event.error?.message || event.message || '';
    if (errorMessage.includes('message channel closed') ||
        errorMessage.includes('Extension context invalidated') ||
        event.filename?.includes('extensions/') ||
        event.filename?.includes('chrome-extension://')) {
        if (DEBUG_MODE) console.warn('Chrome拡張機能エラーを無視:', errorMessage);
        event.preventDefault();
        return;
    }

    console.error('グローバルエラー:', event.error);
});

// Promise rejection ハンドラー（Chrome拡張機能エラー除外版）
window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    const reasonMessage = typeof reason === 'string' ? reason :
                         (reason?.message || JSON.stringify(reason || ''));

    if (reasonMessage.includes('message channel closed') ||
        reasonMessage.includes('Extension context invalidated') ||
        reasonMessage.includes('Could not establish connection') ||
        reasonMessage.includes('Receiving end does not exist')) {
        if (DEBUG_MODE) console.warn('Chrome拡張機能Promise拒否を無視:', reasonMessage);
        event.preventDefault();
        return;
    }

    console.error('未処理のPromise拒否:', event.reason);
});

// =====================================
// CSV読み込み関数
// =====================================

// CSVファイルを読み込む
async function loadCSVData() {
    try {
        if (DEBUG_MODE) console.log('CSV読み込み開始:', CSV_FILE_PATH);

        if (typeof Papa === 'undefined') {
            throw new Error('PapaParseライブラリが読み込まれていません');
        }

        const response = await fetch(CSV_FILE_PATH);

        if (DEBUG_MODE) {
            console.log('Fetch Response Status:', response.status);
            console.log('Fetch Response OK:', response.ok);
        }

        if (!response.ok) {
            throw new Error(`CSVファイルが見つかりません: ${CSV_FILE_PATH} (Status: ${response.status})`);
        }

        let csvText = await response.text();

        if (!csvText || typeof csvText !== 'string') {
            throw new Error('CSVファイルが空か無効です');
        }

        if (csvText.length < 10) {
            throw new Error('CSVファイルのサイズが小さすぎます');
        }

        // BOM検出と除去
        if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.substring(1);
            if (DEBUG_MODE) console.log('BOMを除去しました');
        }

        // PapaParseでCSVを解析
        let parsed;
        try {
            parsed = Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                delimiter: "",
                fastMode: false
            });
        } catch (parseError) {
            console.error('PapaParse実行エラー:', parseError);
            parsed = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true
            });
        }

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('CSV解析結果が無効です');
        }

        if (!parsed.data || !Array.isArray(parsed.data)) {
            throw new Error('CSVデータが正しく解析されませんでした');
        }

        if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
            console.warn('CSV解析時の警告:', parsed.errors.slice(0, PERFORMANCE_CONFIG.MAX_ERROR_DISPLAY));
        }

        if (parsed.data.length === 0) {
            throw new Error('CSVファイルにデータが含まれていません');
        }

        allData = parsed.data;

        if (DEBUG_MODE) console.log(`データ読み込み完了: ${allData.length}件`);

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

        return allData;

    } catch (error) {
        console.error('CSVファイル読み込みエラー:', error);
        throw error;
    }
}

// =====================================
// UI関連関数
// =====================================

// ローディング表示
function showLoading(elementId, message = '読み込み中...') {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = `
        <tr>
            <td colspan="15" class="loading">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </td>
        </tr>
    `;
}

// エラー表示
function showError(elementId, title, message, suggestions = []) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('エラー表示要素が見つかりません:', elementId);
        return;
    }

    let suggestionsHtml = '';
    if (suggestions.length > 0) {
        suggestionsHtml = `
            <br>
            <p><strong>解決方法:</strong></p>
            ${suggestions.map((s, i) => `<p>${i + 1}. ${escapeHtml(s)}</p>`).join('')}
        `;
    }

    element.innerHTML = `
        <tr>
            <td colspan="15" class="error-message">
                <h2>⚠️ ${escapeHtml(title)}</h2>
                <p>${escapeHtml(message)}</p>
                ${suggestionsHtml}
                <br>
                <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    🔄 ページを再読み込み
                </button>
            </td>
        </tr>
    `;
}

// 日付入力の初期設定
function setupDateInputs() {
    if (allData.length > 0) {
        const dates = allData.map(row => row.Data).filter(d => d).sort();
        const minDate = dates[0];
        const maxDate = dates[dates.length - 1];

        const formatDate = (dateStr) => {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const year = parts[0];
                const month = parts[1].padStart(2, '0');
                const day = parts[2].padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            return dateStr;
        };

        // データ一覧タブの日付入力
        const dataStartDate = document.getElementById('dataStartDate');
        const dataEndDate = document.getElementById('dataEndDate');
        if (dataStartDate && dataEndDate) {
            dataStartDate.min = formatDate(minDate);
            dataStartDate.max = formatDate(maxDate);
            dataEndDate.min = formatDate(minDate);
            dataEndDate.max = formatDate(maxDate);
        }

        // 成長ランキングタブの日付入力
        const growthStartDate = document.getElementById('growthStartDate');
        const growthEndDate = document.getElementById('growthEndDate');
        if (growthStartDate && growthEndDate) {
            growthStartDate.min = formatDate(minDate);
            growthStartDate.max = formatDate(maxDate);
            growthEndDate.min = formatDate(minDate);
            growthEndDate.max = formatDate(maxDate);
        }
    }
}

console.log('✅ common.js 読み込み完了');
