// =====================================
// 設定値（最適化済み）
// =====================================
const CSV_FILE_PATH = 'Master_Data.csv';  // 同じフォルダにCSVファイルを配置
const DEBUG_MODE = false; // 本番環境では false、開発時は true

// パフォーマンス設定
const PERFORMANCE_CONFIG = {
    CACHE_DURATION: 300000, // キャッシュ時間（5分）
    CHUNK_SIZE: 1000,       // チャンク処理サイズ
    MAX_ERROR_DISPLAY: 5,   // 表示する最大エラー数
    PAGINATION_SIZE: 50     // デフォルトページネーションサイズ
};

// =====================================
// ユーティリティ関数
// =====================================
// 数値のフォーマット関数（パフォーマンス向上版）
function formatNumber(value) {
    if (value == null || value === '') return '';
    const num = parseInt(value.toString().replace(/,/g, '')) || 0;
    return num.toLocaleString();
}

// 日付のバリデーション関数
function isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
}

// HTML エスケープ関数（高速版）
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

// デバウンス関数（パフォーマンス向上）
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


// グローバル変数
let allData = [];
let filteredData = [];
let currentPage = 1;
let itemsPerPage = 50;
let sortColumn = '';
let sortOrder = 'asc';
let individualChartInstance = null;
let overallChartInstance = null;
let overallBarChartInstance = null;
let currentPlayer = null;
let currentGrowthData = [];  // 成長ランキングのデータを保存
let filteredGrowthData = []; // フィルター適用後の成長データ
let allGrowthData = []; // 全成長データ（ソート用）
let growthSortColumn = '';   // 成長ランキングのソート列
let growthSortOrder = 'desc'; // 成長ランキングのソート順

// ローディング表示関数
function showLoading(message = '読み込み中...') {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="11" class="loading">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </td>
        </tr>
    `;
}

// ローディング非表示関数
function hideLoading() {
    // ローディングを非表示にしてデータ表示を更新
    if (allData.length > 0) {
        displayData();
    }
}

// エラー表示関数（改善版）
function showError(title, message, suggestions = []) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) {
        console.error('tableBodyが見つかりません');
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

    tbody.innerHTML = `
        <tr>
            <td colspan="11" class="error-message">
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

// グローバルエラーハンドラー追加（Chrome拡張機能エラー除外版）
window.addEventListener('error', function(event) {
    // Chrome拡張機能のエラーを除外
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
    if (!DEBUG_MODE && event.error) {
        showError(
            'アプリケーションエラー',
            '予期しないエラーが発生しました。',
            ['ページを再読み込みしてください', 'ブラウザのキャッシュをクリアしてください']
        );
    }
});

// Promise rejection ハンドラー（Chrome拡張機能エラー除外版）
window.addEventListener('unhandledrejection', function(event) {
    // Chrome拡張機能のエラーを除外
    const reason = event.reason;
    const reasonMessage = typeof reason === 'string' ? reason :
                         (reason?.message || JSON.stringify(reason || ''));

    if (reasonMessage.includes('message channel closed') ||
        reasonMessage.includes('Extension context invalidated') ||
        reasonMessage.includes('Could not establish connection') ||
        reasonMessage.includes('Receiving end does not exist')) {
        if (DEBUG_MODE) console.warn('Chrome拡張機能Promise拒否を無視:', reasonMessage);
        event.preventDefault(); // エラー表示を防ぐ
        return;
    }

    console.error('未処理のPromise拒否:', event.reason);
    if (!DEBUG_MODE && event.reason) {
        showError(
            'データ処理エラー',
            'データ処理中にエラーが発生しました。',
            ['ネットワーク接続を確認してください', 'しばらく待ってから再試行してください']
        );
    }
});

// URLハッシュからタブを切り替える関数
function switchToHashTab() {
    const hash = window.location.hash.substring(1); // #を除去
    if (hash) {
        // ハッシュがある場合は該当タブに切り替え
        switchTab(hash);
    }
}

// ページ読み込み時の処理
window.addEventListener('DOMContentLoaded', () => {
    console.log('🟢 DOM読み込み開始');

    // メインコンテンツを表示
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.style.display = 'block';
    }

    // Chart.jsのdatalabelsプラグインを登録
    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
        // デフォルトでは無効化（個別のチャートで有効化）
        Chart.defaults.plugins.datalabels = {
            display: false
        };
    }

    // データの読み込みを開始
    loadCSVData();
    setupEventListeners();

    // URLハッシュがある場合はそのタブに切り替え
    switchToHashTab();
});

// ハッシュ変更時の処理
window.addEventListener('hashchange', () => {
    switchToHashTab();
});

// CSVファイルを読み込む（エラー処理強化版）
async function loadCSVData() {
    // ローディング表示を開始
    showLoading('CSVファイルを読み込み中...');

    try {
        if (DEBUG_MODE) console.log('CSV読み込み開始:', CSV_FILE_PATH);

        // PapaParseライブラリの存在確認
        if (typeof Papa === 'undefined') {
            throw new Error('PapaParseライブラリが読み込まれていません');
        }

        // CSVファイルを取得（シンプル版）
        const response = await fetch(CSV_FILE_PATH);

        if (DEBUG_MODE) {
            console.log('Fetch Response Status:', response.status);
            console.log('Fetch Response OK:', response.ok);
            console.log('Content-Type:', response.headers.get('content-type'));
        }

        if (!response.ok) {
            throw new Error(`CSVファイルが見つかりません: ${CSV_FILE_PATH} (Status: ${response.status})`);
        }

        let csvText = await response.text();

        // CSVテキストの基本チェック
        if (!csvText || typeof csvText !== 'string') {
            throw new Error('CSVファイルが空か無効です');
        }

        if (csvText.length < 10) {
            throw new Error('CSVファイルのサイズが小さすぎます');
        }

        // BOM検出と除去（常に実行）
        if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.substring(1);
            if (DEBUG_MODE) console.log('BOMを除去しました');
        }

        if (DEBUG_MODE) {
            console.log('CSVテキスト前半100文字:', csvText.substring(0, 100));
            console.log('CSVファイルサイズ:', csvText.length);
            console.log('先頭文字の文字コード:', csvText.substring(0, 10).split('').map(c => c.charCodeAt(0)));
        }

        // PapaParseでCSVを解析（デバッグ詳細版）
        let parsed;
        try {
            if (DEBUG_MODE) console.log('=== PapaParse実行開始 ===');

            parsed = Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                delimiter: "", // 自動検出
                fastMode: false
            });

            if (DEBUG_MODE) {
                console.log('=== PapaParse実行完了 ===');
                console.log('Papa.parse直後のparsed:', parsed);
                console.log('parsed変数の状態:', {
                    'parsed !== undefined': parsed !== undefined,
                    'parsed !== null': parsed !== null,
                    'typeof parsed': typeof parsed,
                    'Object.keys(parsed)': parsed ? Object.keys(parsed) : 'N/A',
                    'parsed.constructor': parsed ? parsed.constructor.name : 'N/A'
                });

                // parsed内のプロパティを詳細チェック
                if (parsed && typeof parsed === 'object') {
                    console.log('parsed詳細プロパティ:');
                    for (const [key, value] of Object.entries(parsed)) {
                        console.log(`  ${key}:`, typeof value, Array.isArray(value) ? `[配列:${value.length}要素]` : value);
                    }
                }
            }

            if (DEBUG_MODE) {
                console.log('PapaParse戻り値の型:', typeof parsed);
                console.log('PapaParse戻り値:', parsed);
                console.log('parsed.data存在:', parsed && parsed.data ? 'あり' : 'なし');
                console.log('parsed.errors存在:', parsed && parsed.errors ? 'あり' : 'なし');
            }

        } catch (parseError) {
            console.error('PapaParse実行エラー:', parseError);
            // より安全なフォールバック処理
            try {
                // 最小限の設定でリトライ
                parsed = Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true
                });
                if (DEBUG_MODE) console.log('リトライ成功:', parsed);
            } catch (retryError) {
                console.error('リトライも失敗:', retryError);
                // 最後の手段: 手動CSV解析
                try {
                    if (DEBUG_MODE) console.log('手動CSV解析を試行...');
                    parsed = parseCSVManually(csvText);
                } catch (manualError) {
                    console.error('手動解析も失敗:', manualError);
                    throw new Error(`全ての解析方法が失敗しました: ${parseError.message}`);
                }
            }
        }

        // parsed結果の詳細チェック（デバッグ強化版）
        if (DEBUG_MODE) {
            console.log('=== parsed結果チェック開始 ===');
            console.log('parsed:', parsed);
            console.log('parsed === null:', parsed === null);
            console.log('parsed === undefined:', parsed === undefined);
            console.log('typeof parsed:', typeof parsed);
        }

        if (!parsed) {
            const errorMsg = `CSV解析結果がnullまたはundefinedです (parsed: ${parsed})`;
            if (DEBUG_MODE) console.error(errorMsg);
            throw new Error(errorMsg);
        }

        if (typeof parsed !== 'object') {
            const errorMsg = `CSV解析結果が無効です - 型: ${typeof parsed}, 値: ${String(parsed).substring(0, 200)}`;
            if (DEBUG_MODE) {
                console.error(errorMsg);
                console.log('parsed完全な内容:', parsed);
                console.log('parsedのJSON形式:', JSON.stringify(parsed, null, 2));
            }
            throw new Error('CSV解析結果が無効です');
        }

        if (DEBUG_MODE) {
            console.log('parsed.data:', parsed.data);
            console.log('Array.isArray(parsed.data):', Array.isArray(parsed.data));
        }

        if (!parsed.data || !Array.isArray(parsed.data)) {
            throw new Error('CSVデータが正しく解析されませんでした');
        }

        // エラーチェック（安全に）
        if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
            console.warn('CSV解析時の警告:', parsed.errors.slice(0, PERFORMANCE_CONFIG.MAX_ERROR_DISPLAY));
        }
        
        // データの最終チェック
        if (parsed.data.length === 0) {
            throw new Error('CSVファイルにデータが含まれていません');
        }

        allData = parsed.data;
        filteredData = [...allData];

        // データ更新時にキャッシュをクリア
        if (dataCache && typeof dataCache.clear === 'function') {
            dataCache.clear();
        }

        if (DEBUG_MODE) console.log(`データ読み込み完了: ${allData.length}件`);

        // 更新日時を設定（安全に）
        const now = new Date();
        const updateDateElement = document.getElementById('updateDate');
        const dataCountElement = document.getElementById('dataCount');

        if (updateDateElement) {
            updateDateElement.textContent = now.toLocaleString('ja-JP');
        }
        if (dataCountElement) {
            dataCountElement.textContent = allData.length.toLocaleString();
        }

        // 関数が存在することを確認してから呼び出し
        if (typeof updateStats === 'function') updateStats();
        if (typeof setupDateInputs === 'function') setupDateInputs();
        hideLoading(); // ローディングを非表示

    } catch (error) {
        console.error('CSVファイル読み込みエラー:', error);
        showError(
            'CSVファイルの読み込みに失敗しました',
            error.message,
            [
                'CSVファイル（Master_Data.csv）が同じフォルダにあることを確認',
                'ファイル名が正しいことを確認',
                'GitHubにアップロード済みの場合は、ファイルが公開されているか確認',
                'ブラウザのデベロッパーツールでネットワークエラーを確認'
            ]
        );
    }
}

// 手動CSV解析関数（PapaParseのフォールバック）
function parseCSVManually(csvText) {
    const lines = csvText.split('\n');
    if (lines.length < 2) {
        throw new Error('CSVデータが不足しています');
    }

    // ヘッダー行を解析
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    // データ行を解析
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            data.push(row);
        }
    }

    return {
        data: data,
        errors: []
    };
}

// 日付入力の初期設定
function setupDateInputs() {
    if (allData.length > 0) {
        const dates = allData.map(row => row.Data).filter(d => d).sort();
        const minDate = dates[0];
        const maxDate = dates[dates.length - 1];

        const formatDate = (dateStr) => {
            const parts = dateStr.split('/');
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        };

        // データ一覧タブの日付入力
        const dataStartInput = document.getElementById('dataStartDate');
        const dataEndInput = document.getElementById('dataEndDate');

        if (minDate && maxDate) {
            const formattedMin = formatDate(minDate);
            const formattedMax = formatDate(maxDate);

            dataStartInput.min = formattedMin;
            dataStartInput.max = formattedMax;
            dataEndInput.min = formattedMin;
            dataEndInput.max = formattedMax;

            if (DEBUG_MODE) {
                console.log('データ一覧 日付範囲設定:', formattedMin, '～', formattedMax);
            }
        }

        // 成長ランキングタブの日付入力も同様に設定
        const growthStartInput = document.getElementById('growthStartDate');
        const growthEndInput = document.getElementById('growthEndDate');

        if (minDate && maxDate) {
            const formattedMin = formatDate(minDate);
            const formattedMax = formatDate(maxDate);

            growthStartInput.min = formattedMin;
            growthStartInput.max = formattedMax;
            growthEndInput.min = formattedMin;
            growthEndInput.max = formattedMax;

            if (DEBUG_MODE) {
                console.log('成長ランキング 日付範囲設定:', formattedMin, '～', formattedMax);
            }
        }
    }
}

// データ一覧タブの期間プリセット
function setDataPreset(preset) {
    const dates = allData.map(row => row.Data).filter(d => d).sort();
    if (dates.length === 0) return;

    const latestDate = dates[dates.length - 1];
    let startDate = dates[0];

    if (preset === 'latest') {
        // 最新データのみ（最新日付の1日分）
        startDate = latestDate;
    } else if (preset === 'week') {
        // 7日前を計算
        const latest = new Date(latestDate);
        const weekAgo = new Date(latest);
        weekAgo.setDate(latest.getDate() - 7);
        
        // 実際のデータで最も近い日付を探す
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

    // 日付フォーマットを変換 (YYYY/MM/DD → YYYY-MM-DD)
    const formatDate = (dateStr) => {
        const parts = dateStr.split('/');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    };

    document.getElementById('dataStartDate').value = formatDate(startDate);
    document.getElementById('dataEndDate').value = formatDate(latestDate);
    
    applyDataFilter();
}

// データ一覧の日付フィルター適用
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
        const rowDate = row.Data;
        if (!rowDate) return false;
        
        const compareDate = new Date(rowDate);
        const start = startFormatted ? new Date(startFormatted) : new Date('1900/01/01');
        const end = endFormatted ? new Date(endFormatted) : new Date('2100/12/31');
        
        return compareDate >= start && compareDate <= end;
    });
    
    const indicator = document.getElementById('dateRangeIndicator');
    const rangeText = document.getElementById('dateRangeText');
    
    indicator.style.display = 'block';
    rangeText.textContent = `${startFormatted || '開始'} ～ ${endFormatted || '終了'}`;
    
    currentPage = 1;
    displayData();
    updateFilteredStats();
}

function clearDataFilter() {
    document.getElementById('dataStartDate').value = '';
    document.getElementById('dataEndDate').value = '';
    document.getElementById('dateRangeIndicator').style.display = 'none';
    
    filteredData = [...allData];
    currentPage = 1;
    displayData();
    updateStats();
}

// 表示件数の更新
function updateItemsPerPage() {
    itemsPerPage = parseInt(document.getElementById('dataLimit').value);
    currentPage = 1;
    displayData();
}

// データ表示の更新
function updateDataDisplay() {
    const metric = document.getElementById('dataMetric').value;
    
    if (metric) {
        // 指定された指標で上位のデータのみ表示
        filteredData.sort((a, b) => {
            const aVal = parseInt((a[metric] || '0').toString().replace(/,/g, '')) || 0;
            const bVal = parseInt((b[metric] || '0').toString().replace(/,/g, '')) || 0;
            return bVal - aVal;
        });
    }
    
    currentPage = 1;
    displayData();
}

function switchTab(tab) {
    console.log('🔄 switchTab開始:', tab);

    try {
        const tabId = `${tab}Tab`;

        // 1. すべてのタブボタンを非アクティブ
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });

        // 2. クリックされたボタンをアクティブ
        const clickedBtn = document.querySelector(`.tab-btn[aria-controls="${tabId}"]`);
        if (clickedBtn) {
            clickedBtn.classList.add('active');
            clickedBtn.setAttribute('aria-selected', 'true');
        }

        // 3. すべてのタブコンテンツを完全非表示
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.cssText = `
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                position: absolute !important;
                left: -9999px !important;
                z-index: -1 !important;
            `;
            content.classList.remove('active');
        });

        // 4. ターゲットタブを完全表示
        const targetContent = document.getElementById(tabId);
        if (!targetContent) {
            console.error('❌ タブが見つかりません:', tabId);
            return;
        }

        // 完全強制表示（全ての干渉を排除）
        targetContent.style.cssText = `
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            right: auto !important;
            bottom: auto !important;
            width: 100% !important;
            height: auto !important;
            min-height: 400px !important;
            z-index: 10 !important;
            background: transparent !important;
            overflow: visible !important;
            transform: none !important;
            margin: 0 !important;
            padding: 0 !important;
        `;
        targetContent.classList.add('active');

        console.log('✅ タブ表示完了:', tabId);
        console.log('📊 最終スタイル:', {
            display: targetContent.style.display,
            visibility: targetContent.style.visibility,
            opacity: targetContent.style.opacity
        });

    if (tab === 'overall' && allData.length > 0) {
        updateOverallChart();
    } else if (tab === 'growth') {
        initGrowthTab();
    } else if (tab === 'calendar') {
        console.log('📅 KVKカレンダータブが選択されました');

        const calendarTabElement = document.getElementById('calendarTab');
        if (calendarTabElement) {
            console.log('カレンダータブ要素が見つかりました:', calendarTabElement);

            // 強制表示（全ての可能な干渉を排除）
            calendarTabElement.style.cssText = `
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                width: 100% !important;
                height: auto !important;
                min-height: 400px !important;
                z-index: 1 !important;
                background: transparent !important;
                overflow: visible !important;
            `;

            // 子要素も強制表示
            const childDivs = calendarTabElement.querySelectorAll('div');
            childDivs.forEach(div => {
                div.style.cssText += `
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                `;
            });

            console.log('カレンダータブ表示完了');
            console.log('calendarTab最終スタイル:', calendarTabElement.style.cssText);

            // KVKカレンダーを初期化
            initKvkCalendar();
        } else {
            console.error('calendarTab要素が見つかりません');
        }
    } else if (tab === 'kvk') {
        console.log('⚔️ KVKノルマタブが選択されました');
    } else if (tab === 'contact') {
        console.log('📧 問い合わせタブが選択されました');
    }

        console.log('🎯 特別処理完了');

    } catch (error) {
        console.error('❌ switchTab エラー:', error);
        console.error('スタックトレース:', error.stack);
    }

    console.log('🏁 switchTab終了');
}


// 成長ランキングタブの初期化
function initGrowthTab() {
    if (allData.length > 0 && !document.getElementById('growthStartDate').value) {
        // デフォルトで全期間を設定（データが確実に表示される）
        const dates = allData.map(row => row.Data).filter(d => d).sort();
        if (dates.length >= 2) {
            const uniqueDates = [...new Set(dates)].sort();
            const firstDate = uniqueDates[0];
            const lastDate = uniqueDates[uniqueDates.length - 1];
            
            // 日付フォーマットを変換 (YYYY/MM/DD → YYYY-MM-DD)
            const formatDate = (dateStr) => {
                const parts = dateStr.split('/');
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            };
            
            document.getElementById('growthStartDate').value = formatDate(firstDate);
            document.getElementById('growthEndDate').value = formatDate(lastDate);
            
            if (DEBUG_MODE) console.log('成長ランキング初期化 - 全期間設定:', firstDate, '～', lastDate);
            
            // 自動的に成長ランキングを更新
            updateGrowthRanking();
        }
    }
}

// プリセット期間の設定
function setGrowthPreset(preset) {
    const dates = allData.map(row => row.Data).filter(d => d).sort();
    if (dates.length === 0) return;

    const latestDate = dates[dates.length - 1];
    let startDate = dates[0];

    if (preset === 'latest') {
        // 最新データ（最新日と前回のデータ日を比較）
        if (dates.length >= 2) {
            // 重複を除いた一意の日付を取得
            const uniqueDates = [...new Set(dates)].sort();
            if (uniqueDates.length >= 2) {
                startDate = uniqueDates[uniqueDates.length - 2];  // 前回のデータ日
            } else {
                startDate = uniqueDates[0];
            }
        } else {
            startDate = latestDate;
        }
    } else if (preset === 'week') {
        // 7日前を計算
        const latest = new Date(latestDate);
        const weekAgo = new Date(latest);
        weekAgo.setDate(latest.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0].replace(/-/g, '/');
        
        // 実際のデータで最も近い日付を探す
        startDate = dates.reduce((prev, curr) => {
            return Math.abs(new Date(curr) - weekAgo) < Math.abs(new Date(prev) - weekAgo) ? curr : prev;
        });
    } else if (preset === 'month') {
        // 30日前を計算
        const latest = new Date(latestDate);
        const monthAgo = new Date(latest);
        monthAgo.setDate(latest.getDate() - 30);
        const monthAgoStr = monthAgo.toISOString().split('T')[0].replace(/-/g, '/');
        
        startDate = dates.reduce((prev, curr) => {
            return Math.abs(new Date(curr) - monthAgo) < Math.abs(new Date(prev) - monthAgo) ? curr : prev;
        });
    }

    // 日付フォーマットを変換 (YYYY/MM/DD → YYYY-MM-DD)
    const formatDate = (dateStr) => {
        const parts = dateStr.split('/');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    };

    document.getElementById('growthStartDate').value = formatDate(startDate);
    document.getElementById('growthEndDate').value = formatDate(latestDate);
    
    applyGrowthFilter();
}

// 成長フィルターの適用
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

// 成長フィルターのクリア
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

// 成長ランキングの更新
function updateGrowthRanking() {
    const startDate = document.getElementById('growthStartDate').value;
    const endDate = document.getElementById('growthEndDate').value;

    if (!startDate || !endDate) {
        if (DEBUG_MODE) console.log('日付が選択されていません');
        return;
    }

    const startFormatted = startDate.replace(/-/g, '/');
    const endFormatted = endDate.replace(/-/g, '/');
    const metric = document.getElementById('growthMetric').value;
    const limit = parseInt(document.getElementById('growthLimit').value);
    const sortBy = document.getElementById('growthSort').value;
    const filterType = document.getElementById('growthFilter').value;

    if (DEBUG_MODE) {
        console.log('=== 成長ランキング更新開始 ===');
        console.log('分析期間:', startFormatted, '～', endFormatted);
        console.log('選択指標:', metric);
        console.log('表示制限:', limit);
        console.log('フィルター:', filterType);
    }

    // 開始日と終了日のデータを取得
    const startData = allData.filter(row => row.Data === startFormatted);
    const endData = allData.filter(row => row.Data === endFormatted);

    if (DEBUG_MODE) {
        console.log('開始日データ数:', startData.length);
        console.log('終了日データ数:', endData.length);
    }

    // 特定IDの存在確認
    const targetId = '75607809';
    const startHasTarget = startData.some(row => row.ID === targetId);
    const endHasTarget = endData.some(row => row.ID === targetId);
    if (DEBUG_MODE) console.log(`ID ${targetId} - 開始日存在: ${startHasTarget}, 終了日存在: ${endHasTarget}`);

    if (startData.length === 0 || endData.length === 0) {
        document.getElementById('growthTableBody').innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 60px 20px; color: #7f8c8d;">
                    <h3>選択した期間のデータが見つかりません</h3>
                    <p>開始日: ${startFormatted} (${startData.length}件)</p>
                    <p>終了日: ${endFormatted} (${endData.length}件)</p>
                    <p style="margin-top: 20px;">利用可能な日付:</p>
                    <p>${[...new Set(allData.map(row => row.Data))].sort().join(', ')}</p>
                </td>
            </tr>
        `;
        // 全データをクリア
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
        if (!endRow) {
            if (startRow.ID === targetId) {
                if (DEBUG_MODE) console.log(`ID ${targetId} - 終了日にデータがありません`);
            }
            return;
        }

        const startValue = parseInt((startRow[metric] || '0').toString().replace(/,/g, '')) || 0;
        const endValue = parseInt((endRow[metric] || '0').toString().replace(/,/g, '')) || 0;
        const difference = endValue - startValue;
        const growthRate = startValue > 0 ? (difference / startValue * 100) : 0;

        // フィルター適用前にログ出力
        if (startRow.ID === targetId) {
            if (DEBUG_MODE) console.log(`ID ${targetId} - フィルター適用前:`, {
                name: startRow.Name,
                startValue: startValue,
                endValue: endValue,
                difference: difference,
                growthRate: growthRate,
                filterType: filterType
            });
        }

        // フィルター適用
        if (filterType === 'growth' && difference <= 0) {
            if (startRow.ID === targetId) {
                if (DEBUG_MODE) console.log(`ID ${targetId} - 成長フィルターで除外 (difference: ${difference})`);
            }
            return;
        }
        if (filterType === 'decline' && difference >= 0) {
            if (startRow.ID === targetId) {
                if (DEBUG_MODE) console.log(`ID ${targetId} - 減少フィルターで除外 (difference: ${difference})`);
            }
            return;
        }

        // 期間の日数を計算
        const startDateObj = new Date(startFormatted);
        const endDateObj = new Date(endFormatted);
        const days = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) || 1;
        const dailyAverage = difference / days;

        const growthEntry = {
            id: startRow.ID,
            name: endRow.Name || startRow.Name || 'Unknown',
            alliance: endRow.Alliance || startRow.Alliance || '',
            startValue: startValue,
            endValue: endValue,
            difference: difference,
            growthRate: growthRate,
            dailyAverage: dailyAverage,
            days: days
        };
        
        growthData.push(growthEntry);
        
        if (startRow.ID === targetId) {
            if (DEBUG_MODE) console.log(`ID ${targetId} - 成長データに追加されました:`, growthEntry);
        }
    });

    if (DEBUG_MODE) {
        console.log('総成長データ数:', growthData.length);
        console.log(`ID ${targetId} が含まれているか:`, growthData.some(item => item.id === targetId));
    }

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
    filteredGrowthData = [...displayData]; // 検索用にコピー

    if (DEBUG_MODE) {
        console.log('表示データ数:', displayData.length);
        console.log(`表示データにID ${targetId} が含まれているか:`, displayData.some(item => item.id === targetId));
    }

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
    if (DEBUG_MODE) console.log('=== 成長ランキング更新完了 ===');
}

// 成長ランキングテーブルのソート
function sortGrowthTable(column) {
    // データが存在するかチェック
    if (!allGrowthData || allGrowthData.length === 0) {
        if (DEBUG_MODE) console.log('成長データが存在しません');
        return;
    }
    
    // ソート順を切り替え
    if (growthSortColumn === column) {
        growthSortOrder = growthSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        growthSortColumn = column;
        growthSortOrder = column === 'difference' || column === 'growthRate' || column === 'endValue' || column === 'startValue' || column === 'dailyAverage' ? 'desc' : 'asc';
    }
    
    // 全データをソート（allGrowthDataを使用）
    const sortedData = [...allGrowthData];
    sortedData.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        // 数値系フィールドの場合は数値として比較
        if (column === 'difference' || column === 'growthRate' || column === 'endValue' || 
            column === 'startValue' || column === 'dailyAverage') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else if (column === 'id') {
            aVal = parseInt(aVal) || 0;
            bVal = parseInt(bVal) || 0;
        } else if (typeof aVal === 'string') {
            // 文字列の場合は小文字で比較
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
    const searchTerm = document.getElementById('growthSearchInput').value.toLowerCase();
    let finalDisplayData = displayData;
    if (searchTerm) {
        finalDisplayData = displayData.filter(row => {
            return (
                (row.name && row.name.toLowerCase().includes(searchTerm)) ||
                (row.id && row.id.toString().toLowerCase().includes(searchTerm)) ||
                (row.alliance && row.alliance.toLowerCase().includes(searchTerm))
            );
        });
    }
    
    // filteredGrowthDataを更新
    filteredGrowthData = finalDisplayData;
    
    // テーブルを再表示
    displayGrowthTable(finalDisplayData);
    
    // ソートインジケーターを更新
    updateGrowthSortIndicators();
    
    // データ件数を更新
    document.getElementById('growthAnalysisCount').textContent = finalDisplayData.length;
}

// 成長ランキングのソートインジケーター更新
function updateGrowthSortIndicators() {
    const headers = document.querySelectorAll('#growthTab th.sortable');
    headers.forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        const onclickAttr = th.getAttribute('onclick');
        if (onclickAttr) {
            const match = onclickAttr.match(/sortGrowthTable\('(.+?)'\)/);
            if (match && match[1] === growthSortColumn) {
                th.classList.add(`sorted-${growthSortOrder}`);
            }
        }
    });
}

// 成長ランキングテーブルの表示
function displayGrowthTable(data) {
    const tbody = document.getElementById('growthTableBody');
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 60px 20px; color: #7f8c8d;">
                    <h3>データが見つかりません</h3>
                    <p>フィルター条件を変更してください</p>
                </td>
            </tr>
        `;
        return;
    }
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return (value / 1000000000).toFixed(2) + 'B';
        if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
        if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K';
        return value.toLocaleString();
    };
    
    tbody.innerHTML = data.map((row, index) => {
        const rankBadgeColor = index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#e0e0e0';
        const differenceColor = row.difference > 0 ? '#27ae60' : row.difference < 0 ? '#e74c3c' : '#95a5a6';
        const rateColor = row.growthRate > 0 ? '#27ae60' : row.growthRate < 0 ? '#e74c3c' : '#95a5a6';
        
        return `
            <tr style="border-bottom: 1px solid #e0e0e0; transition: background 0.2s;">
                <td style="padding: 12px 15px; text-align: center; font-weight: 600;">
                    <span style="display: inline-block; width: 30px; height: 30px; line-height: 30px; border-radius: 50%; background: ${rankBadgeColor}; color: ${index < 3 ? '#2c3e50' : '#7f8c8d'};">
                        ${index + 1}
                    </span>
                </td>
                <td style="padding: 12px 15px; text-align: center; color: #2c3e50;">${escapeHtml(row.id || '')}</td>
                <td style="padding: 12px 15px; color: #2c3e50; font-weight: 500;">
                    <a href="#" onclick="navigateToPlayer('${escapeHtml(row.name)}', '${escapeHtml(row.id || '')}'); return false;" style="color: #3498db; text-decoration: none; cursor: pointer; transition: color 0.3s;" onmouseover="this.style.color='#2980b9'" onmouseout="this.style.color='#3498db'">
                        ${escapeHtml(row.name)}
                    </a>
                </td>
                <td style="padding: 12px 15px; color: #2c3e50;">
                    ${row.alliance ? `<span class="alliance-badge">${escapeHtml(row.alliance)}</span>` : '-'}
                </td>
                <td style="padding: 12px 15px; text-align: right; color: #7f8c8d;">${formatValue(row.startValue)}</td>
                <td style="padding: 12px 15px; text-align: right; color: #2c3e50; font-weight: 500;">${formatValue(row.endValue)}</td>
                <td style="padding: 12px 15px; text-align: right; color: ${differenceColor}; font-weight: 600;">
                    ${row.difference > 0 ? '+' : ''}${formatValue(row.difference)}
                </td>
                <td style="padding: 12px 15px; text-align: right; color: ${rateColor}; font-weight: 500;">
                    ${row.growthRate > 0 ? '+' : ''}${row.growthRate.toFixed(2)}%
                </td>
                <td style="padding: 12px 15px; text-align: right; color: #7f8c8d;">
                    ${row.dailyAverage > 0 ? '+' : ''}${formatValue(row.dailyAverage)}
                </td>
            </tr>
        `;
    }).join('');
}

// 成長ランキングの検索フィルター
function filterGrowthBySearch() {
    const searchTerm = document.getElementById('growthSearchInput').value.toLowerCase().trim();
    const targetId = '75607809';
    
    if (DEBUG_MODE) {
        console.log('=== 成長ランキング検索開始 ===');
        console.log('検索語:', `"${searchTerm}"`);
        console.log('allGrowthData の件数:', allGrowthData ? allGrowthData.length : 0);
    }
    
    // 検索対象データの確認
    if (!allGrowthData || allGrowthData.length === 0) {
        if (DEBUG_MODE) console.log('❌ 検索対象のデータがありません - 先に成長ランキングの期間を設定してください');
        
        // 期間未設定のメッセージを表示
        document.getElementById('growthTableBody').innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 60px 20px; color: #7f8c8d;">
                    <h3>検索するには先に期間を選択してください</h3>
                    <p>上の期間選択で開始日と終了日を設定し、「適用」ボタンをクリックしてからご利用ください</p>
                </td>
            </tr>
        `;
        document.getElementById('growthAnalysisCount').textContent = '0';
        return;
    }
    
    // 特定IDがデータに含まれているかチェック
    const hasTargetId = allGrowthData.some(row => row.id === targetId);
    if (DEBUG_MODE) console.log(`ID ${targetId} がallGrowthDataに含まれているか: ${hasTargetId}`);
    if (hasTargetId) {
        const targetData = allGrowthData.find(row => row.id === targetId);
        if (DEBUG_MODE) console.log(`ID ${targetId} のデータ:`, targetData);
    }
    
    if (!searchTerm) {
        // 検索語がない場合は表示制限を適用して全件表示
        const limit = parseInt(document.getElementById('growthLimit').value);
        if (limit === 9999) {
            filteredGrowthData = [...allGrowthData];
        } else {
            // 元のソート順を維持して制限適用
            const sortBy = document.getElementById('growthSort').value;
            const sortedData = [...allGrowthData];
            
            if (sortBy === 'amount') {
                sortedData.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
            } else if (sortBy === 'rate') {
                sortedData.sort((a, b) => Math.abs(b.growthRate) - Math.abs(a.growthRate));
            } else if (sortBy === 'current') {
                sortedData.sort((a, b) => b.endValue - a.endValue);
            }
            
            filteredGrowthData = sortedData.slice(0, limit);
        }
        
        if (DEBUG_MODE) console.log('検索語なし - 全データ表示:', filteredGrowthData.length, '件');
    } else {
        // 検索語がある場合は全データから検索（制限なし）
        filteredGrowthData = allGrowthData.filter(row => {
            // より柔軟な検索条件
            const searchInName = row.name && row.name.toString().toLowerCase().includes(searchTerm);
            const searchInId = row.id && row.id.toString().toLowerCase().includes(searchTerm);
            const searchInAlliance = row.alliance && row.alliance.toString().toLowerCase().includes(searchTerm);
            
            const matchesSearch = searchInName || searchInId || searchInAlliance;
            
            // 特定IDの詳細ログ
            if (row.id === targetId) {
                if (DEBUG_MODE) console.log(`ID ${targetId} の検索詳細:`, {
                    searchTerm: searchTerm,
                    rowData: {
                        id: row.id,
                        name: row.name,
                        alliance: row.alliance
                    },
                    searchResults: {
                        searchInName: searchInName,
                        searchInId: searchInId,
                        searchInAlliance: searchInAlliance,
                        matchesSearch: matchesSearch
                    }
                });
            }
            
            return matchesSearch;
        });
        
        if (DEBUG_MODE) console.log(`検索結果: ${filteredGrowthData.length}件 (検索語: "${searchTerm}")`);
        if (DEBUG_MODE) console.log(`検索結果にID ${targetId} が含まれているか:`, filteredGrowthData.some(row => row.id === targetId));
    }
    
    // 検索結果の件数を更新
    document.getElementById('growthAnalysisCount').textContent = filteredGrowthData.length;
    
    // テーブルを再表示
    displayGrowthTable(filteredGrowthData);
    if (DEBUG_MODE) console.log('=== 成長ランキング検索完了 ===');
}

// 名前クリックで個人分析へ遷移
function navigateToPlayer(playerName, playerId) {
    // 個人分析タブに切り替え
    switchTab('individual');

    // 検索ボックスに名前を設定して検索実行
    setTimeout(() => {
        document.getElementById('playerSearch').value = playerName;
        searchPlayer();
    }, 100);
}

function setupEventListeners() {
    // 検索機能にデバウンスを適用してパフォーマンス改善
    const debouncedSearch = debounce(filterDataBySearch, 300);
    getElement('searchInput').addEventListener('input', debouncedSearch);

    // データ一覧タブのソート設定
    document.getElementById('dataSortColumn').addEventListener('change', (e) => {
        if (e.target.value) {
            sortData(e.target.value, document.getElementById('dataSortOrder').value);
        }
    });

    document.getElementById('dataSortOrder').addEventListener('change', (e) => {
        const column = document.getElementById('dataSortColumn').value;
        if (column) {
            sortData(column, e.target.value);
        }
    });

    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.column;
            if (sortColumn === column) {
                sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortOrder = 'asc';
            }
            sortData(column, sortOrder);
            updateSortIndicators();
        });
    });

    document.getElementById('individualMetric').addEventListener('change', updateIndividualChart);
    document.getElementById('overallMetric').addEventListener('change', updateOverallChart);
}

function filterDataBySearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const startDate = document.getElementById('dataStartDate').value;
    const endDate = document.getElementById('dataEndDate').value;
    
    let baseData = allData;
    if (startDate || endDate) {
        const formatToSlash = (dateStr) => {
            if (!dateStr) return null;
            return dateStr.replace(/-/g, '/');
        };
        
        const startFormatted = formatToSlash(startDate);
        const endFormatted = formatToSlash(endDate);
        
        baseData = allData.filter(row => {
            const rowDate = row.Data;
            if (!rowDate) return false;
            
            const compareDate = new Date(rowDate);
            const start = startFormatted ? new Date(startFormatted) : new Date('1900/01/01');
            const end = endFormatted ? new Date(endFormatted) : new Date('2100/12/31');
            
            return compareDate >= start && compareDate <= end;
        });
    }
    
    if (searchTerm) {
        filteredData = baseData.filter(row => {
            return (
                (row.Name && row.Name.toString().toLowerCase().includes(searchTerm)) ||
                (row.ID && row.ID.toString().toLowerCase().includes(searchTerm)) ||
                (row.Alliance && row.Alliance.toString().toLowerCase().includes(searchTerm))
            );
        });
    } else {
        filteredData = baseData;
    }
    
    currentPage = 1;
    displayData();
}

function updateStats() {
    document.getElementById('totalRecords').textContent = allData.length.toLocaleString();
    
    // 統計情報をキャッシュから取得または計算
    const statsKey = dataCache.generateKey('stats', allData.length, JSON.stringify(allData.slice(0, 10)));
    let cachedStats = dataCache.get(statsKey);
    
    if (cachedStats) {
        // キャッシュから結果を使用
        document.getElementById('lastUpdate').textContent = cachedStats.latestDate;
        document.getElementById('top300Power').textContent = cachedStats.totalPower.toLocaleString();
        return;
    }
    
    // 最終データ日を取得
    const dates = allData.map(row => row.Data).filter(d => d);
    let latestDate = '';
    if (dates.length > 0) {
        latestDate = dates.sort().reverse()[0];
        document.getElementById('lastUpdate').textContent = latestDate;
    }
    
    // 最終データ日のPower上位300位の合計を計算
    if (latestDate) {
        const latestDateData = allData.filter(row => row.Data === latestDate);
        
        // Powerでソート（降順）
        latestDateData.sort((a, b) => {
            const aPower = parseInt((a.Power || '0').toString().replace(/,/g, '')) || 0;
            const bPower = parseInt((b.Power || '0').toString().replace(/,/g, '')) || 0;
            return bPower - aPower;
        });
        
        // 上位300人を取得
        const top300 = latestDateData.slice(0, 300);
        
        // 合計を計算
        const totalPower = top300.reduce((sum, row) => {
            const power = parseInt((row.Power || '0').toString().replace(/,/g, '')) || 0;
            return sum + power;
        }, 0);
        
        // 表示形式を整える（B = Billion, M = Million）
        let displayValue = '';
        if (totalPower >= 1000000000) {
            displayValue = (totalPower / 1000000000).toFixed(2) + 'B';
        } else if (totalPower >= 1000000) {
            displayValue = (totalPower / 1000000).toFixed(1) + 'M';
        } else {
            displayValue = totalPower.toLocaleString();
        }
        
        document.getElementById('top300Power').textContent = displayValue;
        
        // 結果をキャッシュに保存
        dataCache.set(statsKey, {
            latestDate: latestDate,
            totalPower: displayValue
        });
    }
}

function updateFilteredStats() {
    document.getElementById('totalRecords').textContent = 
        `${filteredData.length.toLocaleString()} / ${allData.length.toLocaleString()}`;
}

function displayData() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    const tbody = document.getElementById('tableBody');
    
    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="no-data">
                    <h2>データが見つかりません</h2>
                    <p>検索条件を変更してください</p>
                </td>
            </tr>
        `;
        document.getElementById('pagination').innerHTML = '';
        return;
    }
    
    tbody.innerHTML = pageData.map((row, index) => {
        const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #7f8c8d; background: #f8f9fa;">${rowNumber}</td>
                <td>${escapeHtml(row.Data || '')}</td>
                <td>${escapeHtml(row.ID || '')}</td>
                <td>
                    <a href="#" onclick="navigateToPlayer('${escapeHtml(row.Name || '')}', '${escapeHtml(row.ID || '')}'); return false;" style="color: #3498db; text-decoration: none; cursor: pointer; transition: color 0.3s;" onmouseover="this.style.color='#2980b9'" onmouseout="this.style.color='#3498db'">
                        ${escapeHtml(row.Name || '')}
                    </a>
                </td>
                <td>${escapeHtml(row.Power || '')}</td>
                <td><span class="alliance-badge">${escapeHtml(row.Alliance || '')}</span></td>
                <td>${escapeHtml(row['T4-Kills'] || '')}</td>
                <td>${escapeHtml(row['T5-Kills'] || '')}</td>
                <td>${escapeHtml(row['Total Kill Points'] || '')}</td>
                <td>${escapeHtml(row['Dead Troops'] || '')}</td>
                <td>${escapeHtml(row['Troops Power'] || '')}</td>
            </tr>
        `;
    }).join('');
    
    displayPagination();
}

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
    html += `<span class="page-info">${filteredData.length}件中 ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredData.length)}件</span>`;
    
    pagination.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    displayData();
    window.scrollTo(0, 0);
}

function sortData(column, order) {
    sortColumn = column;
    sortOrder = order;
    
    // 現在のフィルター条件を取得
    const startDate = document.getElementById('dataStartDate').value;
    const endDate = document.getElementById('dataEndDate').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // 日付フィルター適用のためのヘルパー関数
    const formatToSlash = (dateStr) => {
        if (!dateStr) return null;
        return dateStr.replace(/-/g, '/');
    };
    
    // 全データでソートキーを生成（現在のフィルター条件を適用）
    const allDataForSort = allData.filter(row => {
        // 日付フィルター
        if (startDate || endDate) {
            const rowDate = row.Data;
            if (!rowDate) return false;
            
            const compareDate = new Date(rowDate);
            const start = startDate ? new Date(formatToSlash(startDate)) : new Date('1900/01/01');
            const end = endDate ? new Date(formatToSlash(endDate)) : new Date('2100/12/31');
            
            if (compareDate < start || compareDate > end) return false;
        }
        
        // 検索フィルター
        if (searchTerm) {
            return (row.Name && row.Name.toLowerCase().includes(searchTerm)) ||
                   (row.Alliance && row.Alliance.toLowerCase().includes(searchTerm)) ||
                   (row.ID && row.ID.toString().includes(searchTerm));
        }
        return true;
    });
    
    const sortKey = dataCache.generateKey('sort', allDataForSort.length, column, order, JSON.stringify(allDataForSort.slice(0, 5)));
    let cachedSort = dataCache.get(sortKey);
    
    if (cachedSort) {
        filteredData = cachedSort;
        currentPage = 1;
        displayData();
        displayPagination();
        updateSortIndicators();
        return;
    }
    
    // 全データをソート
    const sortedData = [...allDataForSort];
    
    sortedData.sort((a, b) => {
        let aVal = a[column] || '';
        let bVal = b[column] || '';
        
        if (['ID', 'Power', 'T4-Kills', 'T5-Kills', 'Total Kill Points', 'Dead Troops', 'Troops Power'].includes(column)) {
            aVal = parseInt(aVal.toString().replace(/,/g, '')) || 0;
            bVal = parseInt(bVal.toString().replace(/,/g, '')) || 0;
        }
        
        if (column === 'Data') {
            aVal = new Date(aVal || '1900/01/01');
            bVal = new Date(bVal || '1900/01/01');
        }
        
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
    });
    
    // ソート結果をキャッシュに保存
    filteredData = sortedData;
    dataCache.set(sortKey, [...filteredData]);
    
    currentPage = 1;
    displayData();
    displayPagination();
    updateSortIndicators();
}

function updateSortIndicators() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.dataset.column === sortColumn) {
            th.classList.add(`sorted-${sortOrder}`);
        }
    });
    
    document.getElementById('dataSortColumn').value = sortColumn;
    document.getElementById('dataSortOrder').value = sortOrder;
}

function searchPlayer() {
    const searchTerm = document.getElementById('playerSearch').value.toLowerCase();
    if (!searchTerm) {
        alert('プレイヤー名またはIDを入力してください');
        return;
    }
    
    const playerData = allData.filter(row => {
        return (row.Name && row.Name.toString().toLowerCase().includes(searchTerm)) ||
               (row.ID && row.ID.toString().toLowerCase().includes(searchTerm));
    });
    
    if (playerData.length === 0) {
        alert('該当するプレイヤーが見つかりません');
        return;
    }
    
    const latestData = playerData.sort((a, b) => {
        return new Date(b.Data) - new Date(a.Data);
    })[0];
    
    const allPlayerData = allData.filter(row => 
        row.ID === latestData.ID || row.Name === latestData.Name
    );
    
    currentPlayer = {
        name: latestData.Name,
        id: latestData.ID,
        alliance: latestData.Alliance,
        data: allPlayerData
    };
    
    document.getElementById('playerInfo').style.display = 'block';
    document.getElementById('noPlayerData').style.display = 'none';
    document.getElementById('playerName').textContent = currentPlayer.name;
    document.getElementById('playerId').textContent = currentPlayer.id;
    document.getElementById('playerAlliance').textContent = currentPlayer.alliance || 'なし';
    
    const dates = allPlayerData.map(d => d.Data).sort();
    document.getElementById('playerDataRange').textContent = 
        `${dates[0]} ～ ${dates[dates.length - 1]}`;
    
    updateIndividualChart();
}

function updateIndividualChart() {
    if (!currentPlayer) return;
    
    const metric = document.getElementById('individualMetric').value;
    const data = currentPlayer.data.sort((a, b) => {
        return new Date(a.Data) - new Date(b.Data);
    });
    
    const labels = data.map(d => d.Data);
    const values = data.map(d => {
        const val = d[metric] || '0';
        return parseInt(val.toString().replace(/,/g, '')) || 0;
    });
    
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

// 統計データの処理関数
function processOverallChartData(metric) {
    // キャッシュキーでチェック
    const cacheKey = dataCache.generateKey('overallChart', metric, allData.length);
    const cached = dataCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    
    const groupedData = groupDataByDate(allData);
    const chartData = calculateChartData(groupedData, metric);
    
    const result = {
        labels: chartData.map(d => d.date),
        totals: chartData.map(d => d.total),
        chartData: chartData
    };
    
    // キャッシュに保存
    dataCache.set(cacheKey, result);
    
    return result;
}

// 日付でデータをグループ化
function groupDataByDate(data) {
    const grouped = {};
    data.forEach(row => {
        const date = row.Data;
        if (!date) return;
        
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(row);
    });
    return grouped;
}

// チャートデータを計算
function calculateChartData(groupedData, metric) {
    const chartData = [];
    Object.keys(groupedData).sort().forEach(date => {
        const dayData = groupedData[date];
        
        // メトリクスでソート
        dayData.sort((a, b) => {
            const aVal = parseNumberValue(a[metric]);
            const bVal = parseNumberValue(b[metric]);
            return bVal - aVal;
        });
        
        const top300 = dayData.slice(0, 300);
        const total = top300.reduce((sum, row) => {
            return sum + parseNumberValue(row[metric]);
        }, 0);
        
        const average = total / top300.length;
        
        chartData.push({
            date: date,
            total: total,
            average: average,
            count: top300.length
        });
    });
    return chartData;
}

// 数値パースユーティリティ関数
function parseNumberValue(value) {
    return parseInt((value || '0').toString().replace(/,/g, '')) || 0;
}

function updateOverallChart() {
    const metric = document.getElementById('overallMetric').value;
    const { labels, totals } = processOverallChartData(metric);
    
    const lineCtx = document.getElementById('overallChart').getContext('2d');
    if (overallChartInstance) {
        overallChartInstance.destroy();
    }
    
    overallChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `上位300人の${metric}合計`,
                data: totals,
                borderColor: 'rgb(118, 75, 162)',
                backgroundColor: 'rgba(118, 75, 162, 0.1)',
                tension: 0.1,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgb(118, 75, 162)',
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
                    text: `上位300人の${metric}統計`,
                    font: {
                        size: 16
                    }
                },
                datalabels: {
                    display: true,
                    align: 'top',
                    backgroundColor: 'rgba(118, 75, 162, 0.9)',
                    borderRadius: 4,
                    color: 'white',
                    font: {
                        weight: 'bold',
                        size: 10
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
                    padding: 4,
                    offset: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000000) {
                                return (value / 1000000000).toFixed(0) + 'B';
                            } else if (value >= 1000000) {
                                return (value / 1000000).toFixed(0) + 'M';
                            }
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
    
    const barCtx = document.getElementById('overallBarChart').getContext('2d');
    if (overallBarChartInstance) {
        overallBarChartInstance.destroy();
    }
    
    overallBarChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `上位300人の${metric}合計`,
                data: totals,
                backgroundColor: 'rgba(52, 152, 219, 0.8)',
                borderColor: 'rgb(52, 152, 219)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `上位300人の${metric}合計`,
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: false
                },
                datalabels: {
                    display: true,
                    align: 'end',
                    anchor: 'end',
                    backgroundColor: 'rgba(52, 152, 219, 0.9)',
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
                    padding: 3
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000000) {
                                return (value / 1000000000).toFixed(0) + 'B';
                            } else if (value >= 1000000) {
                                return (value / 1000000).toFixed(0) + 'M';
                            }
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function showLineChart() {
    document.getElementById('overallChart').parentElement.style.display = 'block';
    document.getElementById('overallBarChart').parentElement.style.display = 'none';
    
    const buttons = document.querySelectorAll('#overallTab .chart-controls button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function showBarChart() {
    document.getElementById('overallChart').parentElement.style.display = 'none';
    document.getElementById('overallBarChart').parentElement.style.display = 'block';
    
    const buttons = document.querySelectorAll('#overallTab .chart-controls button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}



// キャッシュシステム
class DataCache {
    constructor() {
        this.cache = new Map();
        this.maxSize = 100; // キャッシュの最大サイズ
        this.ttl = 10 * 60 * 1000; // 10分のTTL
    }

    generateKey(...args) {
        return JSON.stringify(args);
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            // LRU: 最も古いエントリを削除
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        // TTLチェック
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        // LRU: アクセスしたアイテムを末尾に移動
        this.cache.delete(key);
        this.cache.set(key, entry);
        
        return entry.value;
    }

    clear() {
        this.cache.clear();
    }

    has(key) {
        const entry = this.cache.get(key);
        if (!entry) return false;
        
        // TTLチェック
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return false;
        }
        
        return true;
    }
}

const dataCache = new DataCache();

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

// Power帯からノルマを取得する関数（戦死ノルマのみ9/24時点のPowerで計算）
function getKvkNormaByPower(power, useDeathRateCalculation = false, startPower = null) {
    const powerNum = parseInt((power || '0').toString().replace(/,/g, '')) || 0;

    if (DEBUG_MODE) console.log('ノルマ検索 - Power:', powerNum, 'startPower:', startPower);

    for (const norma of KVK_NORMA_TABLE) {
        if (powerNum >= norma.minPower && powerNum <= norma.maxPower) {
            let deathTarget;

            if (useDeathRateCalculation && startPower) {
                // 戦死ノルマのみ9/24時点のPowerでDeath Rateを使って計算
                const startPowerNum = parseInt((startPower || '0').toString().replace(/,/g, '')) || 0;
                deathTarget = Math.round(startPowerNum * norma.deathRate);
                if (DEBUG_MODE) console.log('計算された戦死ノルマ:', deathTarget, '(startPower:', startPowerNum, '× deathRate:', norma.deathRate, ')');
            } else {
                // 表示用の固定値
                deathTarget = norma.deathTarget;
                if (DEBUG_MODE) console.log('固定戦死ノルマ:', deathTarget);
            }

            const result = {
                killTarget: norma.killTarget, // 撃破ノルマは常にPower帯の固定値
                deathTarget: deathTarget,
                deathRate: norma.deathRate
            };

            if (DEBUG_MODE) console.log('決定されたノルマ:', result);
            return result;
        }
    }

    // 該当しない場合はデフォルト値
    return { killTarget: 0, deathTarget: 0, deathRate: 0 };
}

// KVKノルマチェッカー: プレイヤー検索機能（デバッグ強化版）
function searchKvkPlayer() {
    const searchTerm = document.getElementById('kvkPlayerSearch').value.toLowerCase().trim();

    if (DEBUG_MODE) console.log('=== KVK プレイヤー検索開始 ===');
    if (DEBUG_MODE) console.log('検索語:', searchTerm);

    if (!searchTerm) {
        alert('プレイヤー名またはIDを入力してください');
        return;
    }

    if (!allData || allData.length === 0) {
        alert('データが読み込まれていません。しばらくお待ちください。');
        return;
    }

    if (DEBUG_MODE) console.log('全データ件数:', allData.length);

    // プレイヤーデータを検索
    const playerData = allData.filter(row => {
        const nameMatch = row.Name && row.Name.toString().toLowerCase().includes(searchTerm);
        const idMatch = row.ID && row.ID.toString().toLowerCase().includes(searchTerm);
        return nameMatch || idMatch;
    });

    if (DEBUG_MODE) console.log('検索結果件数:', playerData.length);

    if (playerData.length === 0) {
        alert('該当するプレイヤーが見つかりません');
        return;
    }

    // 最新のプレイヤーデータを取得
    const latestData = playerData.sort((a, b) => {
        return new Date(b.Data) - new Date(a.Data);
    })[0];

    if (DEBUG_MODE) console.log('最新データ:', latestData);

    // 同じプレイヤーの全データを取得（IDまたは名前で照合）
    const allPlayerData = allData.filter(row =>
        row.ID === latestData.ID || row.Name === latestData.Name
    ).sort((a, b) => new Date(a.Data) - new Date(b.Data));

    if (DEBUG_MODE) console.log('同じプレイヤーの全データ件数:', allPlayerData.length);

    // KVKノルマ進捗を計算
    calculateKvkProgress(latestData, allPlayerData);
}

// KVKノルマ進捗計算機能（デバッグ強化版）
function calculateKvkProgress(latestData, allPlayerData) {
    if (DEBUG_MODE) console.log('=== KVKノルマ進捗計算開始 ===');
    if (DEBUG_MODE) console.log('最新データ:', latestData);
    if (DEBUG_MODE) console.log('全プレイヤーデータ件数:', allPlayerData.length);

    // 9/24のデータを探す（複数の日付形式に対応）
    const kvkStartDate = '2025/09/24';
    const altFormats = ['2025/9/24', '2025-09-24', '2025-9-24'];

    let startData = allPlayerData.find(row => row.Data === kvkStartDate);

    // 代替フォーマットでも検索
    if (!startData) {
        for (const format of altFormats) {
            startData = allPlayerData.find(row => row.Data === format);
            if (startData) {
                if (DEBUG_MODE) console.log(`${format} 形式でデータが見つかりました`);
                break;
            }
        }
    }

    if (DEBUG_MODE) console.log('9/24データ検索結果:', startData ? '見つかりました' : '見つかりません');
    if (DEBUG_MODE && allPlayerData.length > 0) {
        console.log('利用可能な日付の例:', allPlayerData.slice(0, 5).map(row => row.Data));
    }

    if (!startData) {
        // 9/24のデータがない場合、最も古いデータを使用
        if (DEBUG_MODE) console.warn(`${kvkStartDate} のデータが見つかりません。最も古いデータを使用します。`);
        const oldestData = allPlayerData.length > 0 ? allPlayerData[0] : null;
        if (!oldestData) {
            alert('プレイヤーのデータが不足しています。');
            return;
        }
        startData = oldestData;
        if (DEBUG_MODE) console.log('使用する代替データ:', startData);
    }

    // 最新データ
    const currentData = latestData;

    // Power帯からノルマを取得（戦死ノルマのみ9/22時点のPowerで計算）
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
    if (DEBUG_MODE) console.log('UI更新データ:', {
        killProgress, deathProgress, killRemaining, deathRemaining,
        killPercentage, deathPercentage, overallPercentage
    });

    updateKvkProgressUI({
        player: currentData,
        norma: norma,
        startDate: '2025/09/24', // KVK開始日を固定表示
        currentDate: currentData.Data,
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

    if (DEBUG_MODE) console.log('=== KVKノルマ進捗計算完了 ===');
}

// KVKノルマチェッカーのUI更新（デバッグ強化版）
function updateKvkProgressUI(data) {
    if (DEBUG_MODE) console.log('=== UI更新開始 ===');
    if (DEBUG_MODE) console.log('UI更新用データ:', data);

    // 検索ガイドを非表示、結果を表示
    const searchGuide = document.getElementById('kvkSearchGuide');
    const playerResult = document.getElementById('kvkPlayerResult');

    if (searchGuide) searchGuide.style.display = 'none';
    if (playerResult) {
        playerResult.style.display = 'block';
        if (DEBUG_MODE) console.log('結果表示エリアを表示しました');
    } else {
        if (DEBUG_MODE) console.error('kvkPlayerResult要素が見つかりません');
    }

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

// ステータス表示の更新
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

// 値のフォーマット関数
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

// KVK日次進捗グラフ作成
function createKvkProgressCharts(playerData, allPlayerData) {
    if (!allPlayerData || allPlayerData.length === 0) {
        if (DEBUG_MODE) console.warn('プレイヤーデータが不足しているため、グラフを作成できません。');
        return;
    }

    // 9/24を起点とした日別データを準備
    const kvkStartDate = new Date('2025/09/24');
    const chartData = prepareKvkChartData(allPlayerData, kvkStartDate);

    if (chartData.dates.length === 0) {
        if (DEBUG_MODE) console.warn('グラフ用のデータが不足しています。');
        return;
    }

    // 撃破数グラフを作成
    createKvkKillChart(chartData);

    // 戦死数グラフを作成
    createKvkDeathChart(chartData);
}

// KVKチャート用データ準備
function prepareKvkChartData(allPlayerData, startDate) {
    // 日付順にソート
    const sortedData = allPlayerData.sort((a, b) => new Date(a.Data) - new Date(b.Data));

    // 9/24以降のデータをフィルター
    const kvkData = sortedData.filter(row => {
        const rowDate = new Date(row.Data);
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
        const date = new Date(row.Data);
        const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;

        dates.push(formattedDate);
        killProgress.push(currentKills - baseKills);
        deathProgress.push(currentDeaths - baseDeaths);
    });

    return { dates, killProgress, deathProgress };
}

// 撃破数チャート作成
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

// 戦死数チャート作成
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


// =============================================================================
// KVK カレンダー機能
// =============================================================================

// KVKスケジュールデータ
const KVK_SCHEDULE = [
    // Pre-KvK
    {
        zone: 'Home Kingdom',
        phase: 'KvK ストーリーの選択期間',
        duration: '72:00:00',
        startTime: '0:00:01',
        endTime: '2025/9/18 0:00:00',
        description: 'ストーリーモードを選択する期間',
        category: 'pre-kvk'
    },
    {
        zone: '',
        phase: 'マッチメイキング期間',
        duration: '168:00:00',
        startTime: '2025/9/18 0:00:00',
        endTime: '2025/9/25 0:00:00',
        description: '他の王国とのマッチングが始まります。\n※このタイミングで移民制限が掛かります【！移民受入注意！】\n※アップデやイベで告知がズレるとマッチメイキング時間が変わるときがあります！\n※終了時間-1日にマッチング結果がわかります',
        category: 'pre-kvk'
    },
    {
        zone: '',
        phase: '前夜祭第１段階 "略奪者"',
        duration: '48:00:00',
        startTime: '2025/9/25 0:00:00',
        endTime: '2025/9/27 0:00:00',
        description: '略奪者を狩ってアイテムを箱と交換しましょう。',
        category: 'pre-kvk'
    },
    {
        zone: '',
        phase: '前夜祭第２段階　"訓練"',
        duration: '48:00:00',
        startTime: '2025/9/27 0:00:00',
        endTime: '2025/9/29 0:00:00',
        description: '部隊訓練フェーズ',
        category: 'pre-kvk'
    },
    {
        zone: '',
        phase: '前夜祭第３段階　"集落"',
        duration: '48:00:00',
        startTime: '2025/9/29 0:00:00',
        endTime: '2025/10/1 0:00:00',
        description: '略奪者集落を狩ってアイテムを手にれられます。',
        category: 'pre-kvk'
    },
    // Zone 4
    {
        zone: 'Zone 4',
        phase: '征服の旅路',
        duration: '3:00:00',
        startTime: '2025/10/1 0:00:00',
        endTime: '2025/10/1 3:00:00',
        description: '同盟要塞を30個建設\n最大24時間 目標が達成されると、ステージは終了します\n※ここで今後の関所開放の時間等をアクティブタイムに調整\n※よくわかんねーよって人は薄水色の部分を終了時間で直接編集してください\n★カルラック(簡単) 解放',
        category: 'zone4'
    },
    {
        zone: '',
        phase: '目には目を',
        duration: '12:00:00',
        startTime: '2025/10/1 3:00:00',
        endTime: '2025/10/1 15:00:00',
        description: '(遠征軍拠点の活性化までの待機時間)',
        category: 'zone4'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/10/1 15:00:00',
        endTime: '2025/10/3 3:00:00',
        description: '所属軍団が遠征軍拠点を1箇所占領',
        category: 'zone4'
    },
    {
        zone: '',
        phase: '領地争い',
        duration: '12:00:00',
        startTime: '2025/10/3 3:00:00',
        endTime: '2025/10/3 15:00:00',
        description: '(要塞の砦活性化までの待機時間)',
        category: 'zone4'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/10/3 15:00:00',
        endTime: '2025/10/5 3:00:00',
        description: '所属同盟が味方陣営の陣営要塞占領 (過去の栄光の打ち上げ)\n(軍団枠+1)',
        category: 'zone4'
    },
    {
        zone: '',
        phase: '懲罰',
        duration: '12:00:00',
        startTime: '2025/10/5 3:00:00',
        endTime: '2025/10/5 15:00:00',
        description: '(太古の活性化までの待機時間)',
        category: 'zone4'
    },
    {
        zone: '',
        phase: '',
        duration: '12:00:00',
        startTime: '2025/10/5 15:00:00',
        endTime: '2025/10/6 3:00:00',
        description: '太古の遺跡の殺戮者部隊を3体撃破',
        category: 'zone4'
    },
    {
        zone: '',
        phase: '復讐',
        duration: '48:00:00',
        startTime: '2025/10/6 3:00:00',
        endTime: '2025/10/8 3:00:00',
        description: '所属同盟が野蛮人の集落Lv.11以上を100回撃破\n(軍団枠+1)',
        category: 'zone4'
    },
    {
        zone: '',
        phase: '協力',
        duration: '24:00:00',
        startTime: '2025/10/8 3:00:00',
        endTime: '2025/10/9 3:00:00',
        description: 'エピック指揮官が依頼したミッションを10回クリアする\n(軍団枠+1)',
        category: 'zone4'
    },
    // Zone 5
    {
        zone: 'Zone 5',
        phase: '嵐の前の静けさ',
        duration: '12:00:00',
        startTime: '2025/10/9 3:00:00',
        endTime: '2025/10/9 15:00:00',
        description: '(関所Lv.4の開放待機時間 半開放)　(町を略奪)',
        category: 'zone5'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/10/9 15:00:00',
        endTime: '2025/10/11 3:00:00',
        description: '所属軍団が関所Lv.4を箇所占領 ※赤四角開戦時間',
        category: 'zone5'
    },
    {
        zone: '',
        phase: '攻城',
        duration: '12:00:00',
        startTime: '2025/10/11 3:00:00',
        endTime: '2025/10/11 15:00:00',
        description: '(要塞の遺跡開放待機時間)',
        category: 'zone5'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/10/11 15:00:00',
        endTime: '2025/10/13 3:00:00',
        description: '所属軍団が要塞を1箇所占領',
        category: 'zone5'
    },
    {
        zone: '',
        phase: '衝突',
        duration: '48:00:00',
        startTime: '2025/10/13 3:00:00',
        endTime: '2025/10/15 3:00:00',
        description: '所属軍団が野蛮人集落Lv.12以上を100回撃破  \n★カルラック(普通) 解放',
        category: 'zone5'
    },
    // Zone 6
    {
        zone: 'Zone 6',
        phase: '前進',
        duration: '12:00:00',
        startTime: '2025/10/15 3:00:00',
        endTime: '2025/10/15 15:00:00',
        description: '(関所Lv.5の開放待機時間 半開放)',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/10/15 15:00:00',
        endTime: '2025/10/17 3:00:00',
        description: '所属軍団が関所Lv.5を箇所占領　※戦争無し',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '入場券',
        duration: '12:00:00',
        startTime: '2025/10/17 3:00:00',
        endTime: '2025/10/17 15:00:00',
        description: '(関所Lv.6の開放待機時間 半開放)\n(兵法カード追加)',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/10/17 15:00:00',
        endTime: '2025/10/19 3:00:00',
        description: '所属軍団が関所Lv.6を箇所占領　※赤四角暗黒開戦時間',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '生贄は誰だ',
        duration: '12:00:00',
        startTime: '2025/10/19 3:00:00',
        endTime: '2025/10/19 15:00:00',
        description: '(暗黒の祭壇活性化までの待機時間)',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/10/19 15:00:00',
        endTime: '2025/10/21 3:00:00',
        description: '暗黒の祭壇の殺戮者部隊を3体撃破　※赤四角開戦時間',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '究極の一',
        duration: '12:00:00',
        startTime: '2025/10/21 3:00:00',
        endTime: '2025/10/21 15:00:00',
        description: '(修道院(レベル7聖地)活性化までの待機時間)',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/10/21 15:00:00',
        endTime: '2025/10/23 3:00:00',
        description: '所属軍団が修道院(レベル7聖地)を1箇所占領',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '一気呵成',
        duration: '48:00:00',
        startTime: '2025/10/23 3:00:00',
        endTime: '2025/10/25 3:00:00',
        description: '所属軍団が野蛮人集落Lv.13以上を100回撃破',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '戦友と共に',
        duration: '48:00:00',
        startTime: '2025/10/25 3:00:00',
        endTime: '2025/10/27 3:00:00',
        description: 'レジェンド指揮官が依頼したミッションを10回クリアする\n(軍団枠+1)',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '一触即発',
        duration: '48:00:00',
        startTime: '2025/10/27 3:00:00',
        endTime: '2025/10/29 3:00:00',
        description: '所属軍団が野蛮人集落Lv.14以上を100回撃破 (兵法カード追加)',
        category: 'zone6'
    },
    {
        zone: '',
        phase: 'やるかやられるか',
        duration: '12:00:00',
        startTime: '2025/10/29 3:00:00',
        endTime: '2025/10/29 15:00:00',
        description: '(関所Lv.7の開放待機時間 半開放)',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/10/29 15:00:00',
        endTime: '2025/10/31 3:00:00',
        description: '所属軍団が関所Lv.7を1箇所占領　※赤四角開戦時間',
        category: 'zone6'
    },
    {
        zone: '',
        phase: '羊と狼',
        duration: '24:00:00',
        startTime: '2025/10/31 3:00:00',
        endTime: '2025/11/1 3:00:00',
        description: '他陣営の戦闘部隊を1,000,000人重傷または撃破',
        category: 'zone6'
    },
    // Kingsland
    {
        zone: 'Kingsland',
        phase: 'バアルの恵み',
        duration: '12:00:00',
        startTime: '2025/11/1 3:00:00',
        endTime: '2025/11/1 15:00:00',
        description: '(関所Lv.8の開放待機時間 半開放)',
        category: 'kingsland'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/11/1 15:00:00',
        endTime: '2025/11/3 3:00:00',
        description: '所属軍団が関所Lv.8を箇所占領　※赤四角開戦時間',
        category: 'kingsland'
    },
    {
        zone: '',
        phase: '羊と狼',
        duration: '24:00:00',
        startTime: '2025/11/3 3:00:00',
        endTime: '2025/11/4 3:00:00',
        description: '他陣営の戦闘部隊を2,000,000人重傷または撃破\n★カルラック(ハード) 解放',
        category: 'kingsland'
    },
    {
        zone: '',
        phase: '聖域の名',
        duration: '12:00:00',
        startTime: '2025/11/4 3:00:00',
        endTime: '2025/11/4 15:00:00',
        description: '(聖城活性化までの待機時間)　',
        category: 'kingsland'
    },
    {
        zone: '',
        phase: '',
        duration: '60:00:00',
        startTime: '2025/11/4 15:00:00',
        endTime: '2025/11/7 3:00:00',
        description: '所属軍団が聖城を占領',
        category: 'kingsland'
    },
    {
        zone: '',
        phase: '連戦連勝',
        duration: '48:00:00',
        startTime: '2025/11/7 3:00:00',
        endTime: '2025/11/9 3:00:00',
        description: '所属軍団が野蛮人集落Lv.15以上を100回撃破\n★カルラック(ナイトメア) 解放',
        category: 'kingsland'
    },
    {
        zone: '',
        phase: '終焉の門',
        duration: '12:00:00',
        startTime: '2025/11/9 3:00:00',
        endTime: '2025/11/9 15:00:00',
        description: '(関所Lv.9の開放待機時間 完全開放)',
        category: 'kingsland'
    },
    {
        zone: '',
        phase: '',
        duration: '36:00:00',
        startTime: '2025/11/9 15:00:00',
        endTime: '2025/11/11 3:00:00',
        description: '所属軍団が関所Lv.9を1箇所占領　',
        category: 'kingsland'
    },
    {
        zone: '',
        phase: '究極の一',
        duration: '96:00:00',
        startTime: '2025/11/11 3:00:00',
        endTime: '2025/11/15 3:00:00',
        description: '所属陣営が他の陣営の修道院を6箇所占領　★カルラック(地獄) 解放',
        category: 'kingsland'
    },
    {
        zone: '',
        phase: '前進の道',
        duration: '96:00:00',
        startTime: '2025/11/15 3:00:00',
        endTime: '2025/11/19 3:00:00',
        description: '所属軍団が要塞を6箇所占領',
        category: 'kingsland'
    }
];

// KVKカレンダーを初期化
function initKvkCalendar() {
    if (DEBUG_MODE) console.log('=== KVKカレンダー初期化開始 ===');

    // DOM要素の存在確認
    const calendarBody = document.getElementById('kvkCalendarBody');
    const currentPhase = document.getElementById('currentPhase');
    const countdown = document.getElementById('countdown');
    const nextPhase = document.getElementById('nextPhase');

    if (DEBUG_MODE) {
        console.log('DOM要素チェック:');
        console.log('- kvkCalendarBody:', calendarBody ? '存在' : '見つからない');
        console.log('- currentPhase:', currentPhase ? '存在' : '見つからない');
        console.log('- countdown:', countdown ? '存在' : '見つからない');
        console.log('- nextPhase:', nextPhase ? '存在' : '見つからない');
    }

    if (!calendarBody) {
        console.error('KVKカレンダーのDOM要素が見つかりません');
        return;
    }

    renderKvkCalendar();
    updateCurrentPhase();
    startCountdown();

    if (DEBUG_MODE) console.log('=== KVKカレンダー初期化完了 ===');
}

// KVKカレンダーテーブルを描画
function renderKvkCalendar(filter = 'all') {
    console.log('=== renderKvkCalendar開始 ===', filter);

    const tbody = document.getElementById('kvkCalendarBody');
    if (!tbody) {
        console.error('kvkCalendarBodyが見つかりません');
        return;
    }

    console.log('tbody要素:', tbody);
    console.log('tbody親要素:', tbody.parentElement);
    console.log('tbody表示状態:', tbody.style.display);
    console.log('KVK_SCHEDULE配列長:', KVK_SCHEDULE.length);

    // フィルタリング
    const filteredSchedule = filter === 'all'
        ? KVK_SCHEDULE
        : KVK_SCHEDULE.filter(item => item.category === filter);

    console.log('フィルター後のデータ数:', filteredSchedule.length);
    console.log('最初の3件データ:', filteredSchedule.slice(0, 3));

    tbody.innerHTML = '';
    console.log('tbody.innerHTML クリア完了');

    filteredSchedule.forEach((item, index) => {
        console.log(`行 ${index + 1} 作成中:`, item.phase);
        const row = document.createElement('tr');

        // 現在進行中のフェーズをハイライト
        const isCurrentPhase = isCurrentActivePhase(item);
        if (isCurrentPhase) {
            row.style.backgroundColor = '#fff3cd';
            row.style.borderLeft = '5px solid #f39c12';
        }

        // 現在の状態を判定
        const now = new Date();
        const startDate = parseKvkDate(item.startTime);
        const endDate = parseKvkDate(item.endTime);
        let status = '🔵 予定';
        let statusColor = '#3498db';

        if (startDate && endDate) {
            if (now >= startDate && now <= endDate) {
                status = '🟢 進行中';
                statusColor = '#27ae60';
            } else if (now > endDate) {
                status = '⚫ 完了';
                statusColor = '#95a5a6';
            }
        }

        row.innerHTML = `
            <td style="text-align: center; padding: 12px; color: ${statusColor}; font-weight: 600;">
                ${status}
            </td>
            <td style="font-weight: ${item.zone ? 'bold' : 'normal'}; color: ${item.zone ? '#2c3e50' : '#7f8c8d'}; padding: 12px;">
                ${item.zone || ''}
            </td>
            <td style="font-weight: ${item.phase ? '600' : 'normal'}; padding: 12px;">
                ${item.phase || ''}
            </td>
            <td style="text-align: center; font-family: monospace; padding: 12px;">
                ${item.duration}
            </td>
            <td style="text-align: center; font-family: monospace; color: #27ae60; padding: 12px;">
                ${item.startTime}
            </td>
            <td style="text-align: center; font-family: monospace; color: #e74c3c; padding: 12px;">
                ${item.endTime}
            </td>
            <td style="line-height: 1.5; white-space: pre-line; padding: 12px;">
                ${item.description}
            </td>
        `;

        tbody.appendChild(row);
        console.log(`行${index + 1}追加完了:`, item.phase);
    });

    console.log(`=== カレンダー描画完了: ${filteredSchedule.length}件 ===`);
    console.log('最終的なtbody.innerHTML.length:', tbody.innerHTML.length);
    console.log('tbodyの子要素数:', tbody.children.length);
    console.log('tbodyの実際のHTML(最初の200文字):', tbody.innerHTML.substring(0, 200));

    // テーブル関連要素を強制表示
    const table = tbody.closest('table');
    const tableContainer = table?.parentElement;
    const calendarTab = document.getElementById('calendarTab');

    if (table) {
        table.style.cssText += `
            display: table !important;
            visibility: visible !important;
            width: 100% !important;
            border-collapse: collapse !important;
            background: white !important;
        `;
        console.log('テーブル要素を強制表示');
    }

    if (tableContainer) {
        tableContainer.style.cssText += `
            display: block !important;
            visibility: visible !important;
            overflow: visible !important;
            background: white !important;
        `;
        console.log('テーブルコンテナを強制表示');
    }

    tbody.style.cssText += `
        display: table-row-group !important;
        visibility: visible !important;
    `;

    // 各行も強制表示
    Array.from(tbody.children).forEach((row, index) => {
        if (index < 3) { // 最初の3行のみログ出力
            console.log(`行${index + 1}の表示状態:`, row.style.display);
        }
        row.style.cssText += `
            display: table-row !important;
            visibility: visible !important;
        `;
    });

    // calendarTab全体も再度強制表示
    if (calendarTab) {
        calendarTab.style.cssText += `
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
        `;
    }

    console.log('=== 全要素強制表示完了 ===');
}

// 現在のフェーズかどうかチェック
function isCurrentActivePhase(phase) {
    const now = new Date();
    const startDate = parseKvkDate(phase.startTime);
    const endDate = parseKvkDate(phase.endTime);

    return startDate && endDate && now >= startDate && now <= endDate;
}

// KVK日付文字列を解析
function parseKvkDate(dateStr) {
    try {
        // "2025/10/1 3:00:00" 形式を標準形式に変換
        const cleanStr = dateStr.replace(/\//g, '/').trim();
        return new Date(cleanStr);
    } catch (error) {
        if (DEBUG_MODE) console.warn('日付解析エラー:', dateStr, error);
        return null;
    }
}

// 現在のフェーズを更新
function updateCurrentPhase() {
    const currentPhaseElement = document.getElementById('currentPhase');
    if (!currentPhaseElement) {
        if (DEBUG_MODE) console.warn('currentPhase要素が見つかりません');
        return;
    }

    const currentPhase = KVK_SCHEDULE.find(phase => isCurrentActivePhase(phase));

    if (DEBUG_MODE) {
        console.log('現在フェーズ検索結果:', currentPhase);
    }

    if (currentPhase) {
        const zoneName = currentPhase.zone || '継続中';
        const phaseName = currentPhase.phase || '待機期間';
        const displayText = `${zoneName} - ${phaseName}`;
        currentPhaseElement.textContent = displayText;
        if (DEBUG_MODE) console.log('現在フェーズ表示:', displayText);
    } else {
        const message = '現在アクティブなフェーズはありません（開発モード）';
        currentPhaseElement.textContent = message;
        if (DEBUG_MODE) console.log('現在フェーズ:', message);
    }
}

// カウントダウンを開始
function startCountdown() {
    const countdownElement = document.getElementById('countdown');
    const nextPhaseElement = document.getElementById('nextPhase');

    if (!countdownElement || !nextPhaseElement) {
        if (DEBUG_MODE) {
            console.warn('カウントダウン要素が見つかりません:', {
                countdown: !!countdownElement,
                nextPhase: !!nextPhaseElement
            });
        }
        return;
    }

    if (DEBUG_MODE) console.log('カウントダウン開始');

    // テスト表示
    countdownElement.textContent = 'カウントダウン機能が動作中';
    nextPhaseElement.textContent = 'KVKカレンダー読み込み完了';

    function updateCountdown() {
        const now = new Date();
        const nextPhase = KVK_SCHEDULE.find(phase => {
            const startDate = parseKvkDate(phase.startTime);
            return startDate && startDate > now;
        });

        if (nextPhase) {
            const startDate = parseKvkDate(nextPhase.startTime);
            const timeDiff = startDate - now;

            if (timeDiff > 0) {
                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

                countdownElement.textContent = `${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`;

                const zoneName = nextPhase.zone || '継続';
                const phaseName = nextPhase.phase || '次のフェーズ';
                nextPhaseElement.textContent = `次: ${zoneName} - ${phaseName}`;
            } else {
                countdownElement.textContent = '開始まで僅か';
                nextPhaseElement.textContent = '次のフェーズが間もなく開始されます';
            }
        } else {
            countdownElement.textContent = 'KVK終了';
            nextPhaseElement.textContent = 'すべてのフェーズが完了しています';
        }
    }

    // 初回実行
    updateCountdown();

    // 1秒ごとに更新
    setInterval(updateCountdown, 1000);
}

// フィルター機能
function filterKvkCalendar() {
    const filterValue = document.getElementById('phaseFilter').value;
    renderKvkCalendar(filterValue);
}

// =============================================================================
// デバッグ用: エラー検出とタブ状態確認
// =============================================================================

// グローバルエラーハンドラー（Chrome拡張機能エラー除外）
window.addEventListener('error', (event) => {
    // Chrome拡張機能のエラーを無視
    const errorMessage = event.error?.message || event.message || '';
    if (errorMessage.includes('message channel closed') ||
        errorMessage.includes('Extension context invalidated') ||
        event.filename?.includes('extensions/')) {
        if (DEBUG_MODE) console.warn('Chrome拡張機能エラーを無視:', errorMessage);
        event.preventDefault();
        return;
    }

    console.error('🚨 JavaScript Error:', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error
    });
});

// Promise拒否エラーハンドラー（Chrome拡張機能エラー除外）
window.addEventListener('unhandledrejection', (event) => {
    // Chrome拡張機能のエラーを無視
    const reason = event.reason;
    const reasonMessage = typeof reason === 'string' ? reason :
                         (reason?.message || JSON.stringify(reason));

    if (reasonMessage.includes('message channel closed') ||
        reasonMessage.includes('Extension context invalidated') ||
        reasonMessage.includes('Could not establish connection')) {
        if (DEBUG_MODE) console.warn('Chrome拡張機能Promise拒否を無視:', reasonMessage);
        event.preventDefault();
        return;
    }

    console.error('🚨 Unhandled Promise Rejection:', event.reason);
});

// タブ状態確認用デバッグ関数
function debugTabStates() {
    console.log('=== タブ状態確認 ===');

    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => {
        const computedStyle = window.getComputedStyle(tab);
        console.log(`${tab.id}:`, {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            zIndex: computedStyle.zIndex,
            position: computedStyle.position,
            width: computedStyle.width,
            height: computedStyle.height
        });
    });
}

// ページ読み込み完了後にデバッグ関数を実行
document.addEventListener('DOMContentLoaded', () => {
    console.log('🟢 DOM読み込み完了');

    setTimeout(() => {
        console.log('🔍 5秒後のタブ状態確認');
        debugTabStates();
    }, 5000);
});

// タブクリック時のデバッグ
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('tab-btn')) {
        const tabName = event.target.textContent;
        console.log(`🖱️ タブクリック: ${tabName}`);

        setTimeout(() => {
            console.log('📊 クリック後のタブ状態:');
            debugTabStates();
        }, 100);
    }
});

console.log('🟢 script.js 読み込み完了');