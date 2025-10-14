// ========================================
// 共通設定・定数
// ========================================

const DEBUG_MODE = false;
const CSV_FILE_PATH = 'Master_Data.csv';

const PERFORMANCE_CONFIG = {
    CHUNK_SIZE: 500,
    DEBOUNCE_DELAY: 300,
    CACHE_DURATION: 5 * 60 * 1000 // 5分
};

// ========================================
// グローバル変数（データキャッシュ）
// ========================================

let allData = [];
let csvCache = {
    data: null,
    timestamp: null,
    lastModified: null
};

// ========================================
// ユーティリティ関数
// ========================================

/**
 * 数値を3桁カンマ区切りでフォーマット
 * @param {number} num - フォーマットする数値
 * @returns {string} フォーマットされた文字列
 */
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Math.floor(num).toLocaleString('ja-JP');
}

/**
 * XSS対策：HTMLエスケープ
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * デバウンス関数（連続呼び出しを制御）
 * @param {Function} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
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

/**
 * 日付文字列をDateオブジェクトに変換（YYYY/M/D形式対応）
 * @param {string} dateStr - 日付文字列
 * @returns {Date} Dateオブジェクト
 */
function parseDate(dateStr) {
    if (!dateStr) return null;

    // YYYY/M/D形式をYYYY-MM-DD形式に変換
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return new Date(`${year}-${month}-${day}`);
    }

    return new Date(dateStr);
}

/**
 * 日付をYYYY/M/D形式の文字列に変換
 * @param {Date} date - Dateオブジェクト
 * @returns {string} フォーマットされた日付文字列
 */
function formatDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return '';
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}/${month}/${day}`;
}

/**
 * CSVファイルの最終更新日時を取得
 * @returns {Promise<Date>} 最終更新日時
 */
async function getCSVLastModified() {
    try {
        const response = await fetch(CSV_FILE_PATH, { method: 'HEAD' });
        const lastModified = response.headers.get('Last-Modified');
        return lastModified ? new Date(lastModified) : new Date();
    } catch (error) {
        console.warn('最終更新日時の取得に失敗:', error);
        return new Date();
    }
}

// ========================================
// CSVデータ読み込み
// ========================================

/**
 * CSVファイルを読み込み、パースする（キャッシュ対応）
 * @param {boolean} forceReload - キャッシュを無視して強制再読み込み
 * @returns {Promise<Array>} パースされたデータ配列
 */
async function loadCSVData(forceReload = false) {
    try {
        // キャッシュチェック
        const now = Date.now();
        if (!forceReload && csvCache.data && csvCache.timestamp &&
            (now - csvCache.timestamp < PERFORMANCE_CONFIG.CACHE_DURATION)) {
            if (DEBUG_MODE) console.log('キャッシュからデータを取得');
            return csvCache.data;
        }

        // 最終更新日時確認
        const lastModified = await getCSVLastModified();
        if (!forceReload && csvCache.data && csvCache.lastModified &&
            lastModified <= csvCache.lastModified) {
            if (DEBUG_MODE) console.log('CSVファイルは更新されていません（キャッシュ使用）');
            csvCache.timestamp = now; // タイムスタンプ更新
            return csvCache.data;
        }

        if (DEBUG_MODE) console.log('CSVファイルを読み込み中...');

        return new Promise((resolve, reject) => {
            Papa.parse(CSV_FILE_PATH, {
                download: true,
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                transformHeader: (header) => {
                    // BOM除去
                    return header.replace(/^\uFEFF/, '').trim();
                },
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn('CSV解析時の警告:', results.errors);
                    }

                    const data = results.data.map(row => ({
                        Date: row.Date,
                        ID: row.ID,
                        Name: escapeHtml(row.Name),
                        Alliance: escapeHtml(row.Alliance),
                        Power: row.Power || 0,
                        'T4-Kills': row['T4-Kills'] || 0,
                        'T5-Kills': row['T5-Kills'] || 0,
                        'Total Kill Points': row['Total Kill Points'] || 0,
                        'Dead Troops': row['Dead Troops'] || 0,
                        'Troops Power': row['Troops Power'] || 0
                    }));

                    // キャッシュ更新
                    csvCache = {
                        data: data,
                        timestamp: now,
                        lastModified: lastModified
                    };

                    allData = data;

                    if (DEBUG_MODE) {
                        console.log('CSVデータ読み込み完了:', data.length, '件');
                        console.log('サンプルデータ:', data[0]);
                    }

                    resolve(data);
                },
                error: (error) => {
                    console.error('CSV読み込みエラー:', error);
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('データ読み込み中にエラーが発生しました:', error);
        throw error;
    }
}

/**
 * CSVファイルの情報を表示（更新日時、データ件数）
 */
async function displayCSVInfo() {
    try {
        const lastModified = await getCSVLastModified();
        const updateDateElement = document.getElementById('updateDate');
        const dataCountElement = document.getElementById('dataCount');

        if (updateDateElement) {
            updateDateElement.textContent = lastModified.toLocaleString('ja-JP');
        }

        if (dataCountElement && allData.length > 0) {
            dataCountElement.textContent = formatNumber(allData.length);
        }
    } catch (error) {
        console.warn('CSV情報の表示に失敗:', error);
    }
}

// ========================================
// データ処理ユーティリティ
// ========================================

/**
 * プレイヤーIDで最新データのみを取得
 * @param {Array} data - 全データ
 * @returns {Array} プレイヤーごとの最新データ
 */
function getLatestDataPerPlayer(data) {
    const playerMap = new Map();

    data.forEach(row => {
        const id = row.ID;
        const date = parseDate(row.Date);

        if (!playerMap.has(id) || date > parseDate(playerMap.get(id).Date)) {
            playerMap.set(id, row);
        }
    });

    return Array.from(playerMap.values());
}

/**
 * 日付範囲でデータをフィルタリング
 * @param {Array} data - 全データ
 * @param {Date} startDate - 開始日
 * @param {Date} endDate - 終了日
 * @returns {Array} フィルタリングされたデータ
 */
function filterDataByDateRange(data, startDate, endDate) {
    if (!startDate && !endDate) return data;

    return data.filter(row => {
        const date = parseDate(row.Date);
        if (!date) return false;

        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;

        return true;
    });
}

/**
 * プレイヤー名/ID/同盟で検索
 * @param {Array} data - データ配列
 * @param {string} searchTerm - 検索キーワード
 * @returns {Array} 検索結果
 */
function searchPlayers(data, searchTerm) {
    if (!searchTerm) return data;

    const term = searchTerm.toLowerCase().trim();

    return data.filter(row => {
        return (
            (row.Name && row.Name.toLowerCase().includes(term)) ||
            (row.ID && row.ID.toString().includes(term)) ||
            (row.Alliance && row.Alliance.toLowerCase().includes(term))
        );
    });
}

/**
 * 利用可能な日付一覧を取得（昇順ソート）
 * @param {Array} data - 全データ
 * @returns {Array<Date>} 日付配列
 */
function getAvailableDates(data) {
    const dateSet = new Set();

    data.forEach(row => {
        if (row.Date) {
            dateSet.add(row.Date);
        }
    });

    return Array.from(dateSet)
        .map(dateStr => parseDate(dateStr))
        .filter(date => date !== null)
        .sort((a, b) => a - b);
}

// ========================================
// ローディング表示
// ========================================

/**
 * ローディングスピナーを表示
 * @param {HTMLElement} element - 表示先の要素
 * @param {string} message - メッセージ
 */
function showLoading(element, message = 'データを読み込み中...') {
    if (!element) return;

    element.innerHTML = `
        <tr>
            <td colspan="20" style="text-align: center; padding: 60px 20px; color: #7f8c8d;">
                <div class="loading-spinner"></div>
                <p style="margin-top: 20px;">${message}</p>
            </td>
        </tr>
    `;
}

/**
 * エラーメッセージを表示
 * @param {HTMLElement} element - 表示先の要素
 * @param {string} message - エラーメッセージ
 */
function showError(element, message) {
    if (!element) return;

    element.innerHTML = `
        <tr>
            <td colspan="20" style="text-align: center; padding: 60px 20px; color: #e74c3c;">
                <h3>エラーが発生しました</h3>
                <p>${escapeHtml(message)}</p>
            </td>
        </tr>
    `;
}

/**
 * データなしメッセージを表示
 * @param {HTMLElement} element - 表示先の要素
 * @param {string} message - メッセージ
 */
function showNoData(element, message = 'データがありません') {
    if (!element) return;

    element.innerHTML = `
        <tr>
            <td colspan="20" style="text-align: center; padding: 60px 20px; color: #7f8c8d;">
                <h3>${message}</h3>
            </td>
        </tr>
    `;
}

// ========================================
// エクスポート（グローバルスコープに配置）
// ========================================

// このファイルは各HTMLファイルで<script>タグで直接読み込まれるため、
// 関数はすでにグローバルスコープに定義されています。
