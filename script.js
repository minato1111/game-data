// =====================================
// CSVファイルのパスを設定
// =====================================
const CSV_FILE_PATH = 'Master_Data.csv';  // 同じフォルダにCSVファイルを配置

// =====================================
// パスワード保護機能（セキュリティ強化版）
// =====================================
// パスワード設定
const CORRECT_PASSWORD = '2062data'; // 本番用パスワード
const CORRECT_PASSWORD_HASH = 'e8b7e2e8c8b4e1b9a2d3c5f6e7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8';

function checkPassword() {
    const input = getElement('passwordInput').value;
    const errorMsg = getElement('passwordError');
    
    if (input === CORRECT_PASSWORD) {
        // パスワードが正しい場合
        getElement('passwordProtection').style.display = 'none';
        getElement('mainContent').style.display = 'block';
        
        // セッションストレージに認証状態を保存
        sessionStorage.setItem('authenticated', 'true');
        
        // Chart.jsのdatalabelsプラグインを登録
        if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
            Chart.defaults.plugins.datalabels = {
                display: false
            };
        }
        
        // データの読み込みを開始
        loadCSVData();
        setupEventListeners();

        // テスト用：contactタブの状態確認
        setTimeout(testContactTab, 1000);

        // さらに詳細な確認（5秒後）
        setTimeout(() => {
            console.log('=== Final Contact Tab Check (5 seconds after load) ===');
            testContactTab();
            forceActivateContactTab();
        }, 5000);
    } else {
        // パスワードが間違っている場合
        errorMsg.style.display = 'block';
        getElement('passwordInput').value = '';
        
        // 入力欄を振動させる
        const inputBox = getElement('passwordInput');
        inputBox.style.animation = 'shake 0.5s';
        setTimeout(() => {
            inputBox.style.animation = '';
        }, 500);
    }
}

// DOM要素キャッシュ
const domCache = {};
const getElement = (id) => {
    if (!domCache[id]) {
        domCache[id] = document.getElementById(id);
    }
    return domCache[id];
};

// デバウンス関数
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
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

// エラー表示関数
function showError(title, message, suggestions = []) {
    const tbody = document.getElementById('tableBody');
    let suggestionsHtml = '';
    if (suggestions.length > 0) {
        suggestionsHtml = `
            <br>
            <p><strong>解決方法:</strong></p>
            ${suggestions.map((s, i) => `<p>${i + 1}. ${s}</p>`).join('')}
        `;
    }
    
    tbody.innerHTML = `
        <tr>
            <td colspan="11" class="error-message">
                <h2>⚠️ ${title}</h2>
                <p>${message}</p>
                ${suggestionsHtml}
            </td>
        </tr>
    `;
}

// URLハッシュからタブを切り替える関数
function switchToHashTab() {
    const hash = window.location.hash.substring(1); // #を除去
    if (hash) {
        // ハッシュがある場合は該当タブに切り替え
        switchTab(hash);
    }
}

// テスト用：contactタブの状態確認
function testContactTab() {
    console.log('=== Contact Tab Test ===');
    const contactTab = document.getElementById('contactTab');
    console.log('Contact tab element:', contactTab);
    console.log('Contact tab exists:', !!contactTab);
    if (contactTab) {
        console.log('Contact tab classes:', contactTab.className);
        console.log('Contact tab display style:', window.getComputedStyle(contactTab).display);
        console.log('Contact tab visibility:', window.getComputedStyle(contactTab).visibility);
        console.log('Contact tab innerHTML length:', contactTab.innerHTML.length);
        console.log('Contact tab content preview:', contactTab.innerHTML.substring(0, 500));

        // 親要素の状態も確認
        console.log('Contact tab parent element:', contactTab.parentElement);
        if (contactTab.parentElement) {
            console.log('Parent display:', window.getComputedStyle(contactTab.parentElement).display);
            console.log('Parent visibility:', window.getComputedStyle(contactTab.parentElement).visibility);
        }

        // 子要素の数も確認
        console.log('Contact tab children count:', contactTab.children.length);
        console.log('Contact tab first child:', contactTab.firstElementChild);
    } else {
        console.error('Contact tab element not found!');

        // 全てのタブコンテンツを確認
        const allTabs = document.querySelectorAll('.tab-content');
        console.log('All tab content elements found:', allTabs.length);
        allTabs.forEach((tab, index) => {
            console.log(`Tab ${index}: id=${tab.id}, classes=${tab.className}`);
        });
    }
    console.log('=== End Test ===');
}

// テスト用：contactタブを強制アクティブ化
function forceActivateContactTab() {
    console.log('Forcing contact tab activation...');

    // すべてのタブを非アクティブ化
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // すべてのタブボタンを非アクティブ化
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // contactタブをアクティブ化
    const contactTab = document.getElementById('contactTab');
    if (contactTab) {
        contactTab.classList.add('active');
        console.log('Contact tab forced to active. Classes:', contactTab.className);
        console.log('Display style:', window.getComputedStyle(contactTab).display);
    }

    // contactタブボタンをアクティブ化
    const contactBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn =>
        btn.textContent === '問い合わせ先'
    );
    if (contactBtn) {
        contactBtn.classList.add('active');
        console.log('Contact button activated');
    }
}

// ブラウザ コンソールから呼び出せるようにグローバルに設定
window.testContactTab = testContactTab;
window.forceActivateContactTab = forceActivateContactTab;

// ページ読み込み時の処理
window.addEventListener('DOMContentLoaded', () => {
    // パスワード認証のイベントリスナーを設定
    const loginButton = document.getElementById('loginButton');
    const passwordInput = document.getElementById('passwordInput');
    
    if (loginButton) {
        loginButton.addEventListener('click', checkPassword);
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                checkPassword();
            }
        });
    }
    
    // 既に認証済みかチェック
    if (sessionStorage.getItem('authenticated') === 'true') {
        // 認証済みの場合は直接メインコンテンツを表示
        document.getElementById('passwordProtection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        
        // Chart.jsのdatalabelsプラグインを登録
        if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
            // デフォルトでは無効化（個別のチャートで有効化）
            Chart.defaults.plugins.datalabels = {
                display: false
            };
        }
        loadCSVData();
        setupEventListeners();

        // URLハッシュがある場合は該当タブを表示
        switchToHashTab();

        // テスト用：contactタブの状態確認
        setTimeout(testContactTab, 1000);
    } else {
        // 未認証の場合はパスワード入力画面を表示
        if (passwordInput) {
            passwordInput.focus();
        }
    }
});

// ハッシュ変更時の処理
window.addEventListener('hashchange', () => {
    if (sessionStorage.getItem('authenticated') === 'true') {
        switchToHashTab();
    }
});

// CSVファイルを読み込む
async function loadCSVData() {
    // ローディング表示を開始
    showLoading('CSVファイルを読み込み中...');
    
    try {
        // CSVファイルを取得
        const response = await fetch(CSV_FILE_PATH);
        
        if (!response.ok) {
            throw new Error(`CSVファイルが見つかりません: ${CSV_FILE_PATH}`);
        }
        
        const csvText = await response.text();
        
        // PapaParseでCSVを解析
        const parsed = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimitersToGuess: [',', '\t', '|', ';']
        });
        
        if (parsed.errors.length > 0) {
            console.warn('CSV解析時の警告:', parsed.errors);
        }
        
        allData = parsed.data;
        filteredData = [...allData];
        
        // データ更新時にキャッシュをクリア
        dataCache.clear();
        
        console.log(`データ読み込み完了: ${allData.length}件`);
        
        // 更新日時を設定
        const now = new Date();
        document.getElementById('updateDate').textContent = now.toLocaleString('ja-JP');
        document.getElementById('dataCount').textContent = allData.length.toLocaleString();
        
        updateStats();
        setupDateInputs();
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
        
        if (minDate) {
            dataStartInput.min = formatDate(minDate);
            dataEndInput.min = formatDate(minDate);
        }
        if (maxDate) {
            dataStartInput.max = formatDate(maxDate);
            dataEndInput.max = formatDate(maxDate);
        }

        // 成長ランキングタブの日付入力も同様に設定
        const growthStartInput = document.getElementById('growthStartDate');
        const growthEndInput = document.getElementById('growthEndDate');
        
        if (minDate) {
            growthStartInput.min = formatDate(minDate);
            growthEndInput.min = formatDate(minDate);
        }
        if (maxDate) {
            growthStartInput.max = formatDate(maxDate);
            growthEndInput.max = formatDate(maxDate);
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
    console.log('=== switchTab called with:', tab, '===');

    // タブボタンを非アクティブ化
    const allTabBtns = document.querySelectorAll('.tab-btn');
    console.log('Found tab buttons:', allTabBtns.length);
    allTabBtns.forEach(btn => {
        btn.classList.remove('active');
    });

    // event.targetの代わりに、クリックされたボタンを探す
    const clickedBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => {
        const btnText = btn.textContent;
        if (tab === 'data' && btnText === 'データ一覧') return true;
        if (tab === 'growth' && btnText === '成長ランキング') return true;
        if (tab === 'overall' && btnText === '上位300人統計') return true;
        if (tab === 'individual' && btnText === '個人分析') return true;
        if (tab === 'kvk' && btnText === 'KVKノルマ') return true;
        if (tab === 'contact' && btnText === '問い合わせ先') return true;
        return false;
    });

    console.log('Found clicked button:', clickedBtn);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
        console.log('Button activated:', clickedBtn.textContent);
    }

    // タブコンテンツを非アクティブ化
    const allTabContents = document.querySelectorAll('.tab-content');
    console.log('Found tab contents:', allTabContents.length);
    allTabContents.forEach(content => {
        console.log('Deactivating:', content.id);
        content.classList.remove('active');
        // 強制的にインラインスタイルでdisplay: noneを設定
        content.style.display = 'none';
    });

    if (tab === 'data') {
        const dataTab = document.getElementById('dataTab');
        dataTab.classList.add('active');
        dataTab.style.display = 'block';
    } else if (tab === 'individual') {
        const individualTab = document.getElementById('individualTab');
        individualTab.classList.add('active');
        individualTab.style.display = 'block';
    } else if (tab === 'overall') {
        const overallTab = document.getElementById('overallTab');
        overallTab.classList.add('active');
        overallTab.style.display = 'block';
        if (allData.length > 0) {
            updateOverallChart();
        }
    } else if (tab === 'growth') {
        const growthTab = document.getElementById('growthTab');
        growthTab.classList.add('active');
        growthTab.style.display = 'block';
        initGrowthTab();
    } else if (tab === 'kvk') {
        const kvkTab = document.getElementById('kvkTab');
        kvkTab.classList.add('active');
        kvkTab.style.display = 'block';
    } else if (tab === 'contact') {
        console.log('🚨 CONTACT TAB CLICKED - REDIRECTING TO DEDICATED PAGE 🚨');

        // 問い合わせ先専用ページに移動
        window.open('contact_test.html', '_blank');

        // 現在のタブに簡単なメッセージを表示
        const contactTab = document.getElementById('contactTab');
        console.log('Contact tab element found:', !!contactTab);

        if (contactTab) {
            // タブを表示状態にする
            contactTab.className = 'tab-content active';
            contactTab.style.display = 'block';
            contactTab.style.visibility = 'visible';
            contactTab.style.opacity = '1';
            contactTab.style.minHeight = '400px';
            contactTab.style.padding = '40px';
            contactTab.style.textAlign = 'center';
            contactTab.style.backgroundColor = 'white';

            // 新しいページが開いたことを示すメッセージ
            contactTab.innerHTML = `
                <div style="padding: 60px 20px; text-align: center;">
                    <h2 style="color: #2c3e50; font-size: 32px; margin-bottom: 20px;">📧 問い合わせ先</h2>
                    <div style="background: #e8f4fd; padding: 30px; border-radius: 15px; margin: 20px 0;">
                        <p style="color: #2980b9; font-size: 18px; margin-bottom: 15px;">
                            <strong>✅ 新しいタブで問い合わせ先ページを開きました！</strong>
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            新しいタブが開かない場合は、ブラウザのポップアップブロックを確認してください
                        </p>
                    </div>
                    <div style="margin: 30px 0;">
                        <button onclick="window.open('contact_test.html', '_blank')"
                                style="background: #3498db; color: white; padding: 15px 30px; border: none; border-radius: 10px; font-size: 16px; cursor: pointer;">
                            📧 問い合わせ先ページを再度開く
                        </button>
                    </div>
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #2c3e50; margin-bottom: 10px;">直接アクセス</h3>
                        <p style="color: #666; font-size: 14px; margin-bottom: 10px;">Twitter: <a href="https://x.com/boo_vazi" target="_blank" style="color: #1DA1F2;">@boo_vazi</a></p>
                        <p style="color: #666; font-size: 14px;">Discord: <a href="https://discord.gg/kfrPJ2F2cf" target="_blank" style="color: #7289DA;">kfrPJ2F2cf</a></p>
                    </div>
                </div>
            `;

            console.log('Contact tab classes after:', contactTab.className);
            console.log('Contact tab cssText set to:', contactTab.style.cssText);

            // DOM要素の内容を確認し、強制的に内容を設定
            console.log('Contact tab innerHTML before:', contactTab.innerHTML.length);

            // 問い合わせ先の内容を強制的に設定
            contactTab.innerHTML = `
                <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; min-height: 500px; background: rgba(255,255,255,0.95); border-radius: 15px;">
                    <div style="text-align: center; margin-bottom: 40px;">
                        <h2 style="color: #2c3e50; font-size: 32px; margin-bottom: 20px;">📧 問い合わせ先</h2>
                        <p style="color: #7f8c8d; font-size: 16px;">ご質問・ご要望がございましたら、お気軽にお問い合わせください</p>
                    </div>

                    <div style="background: white; border-radius: 20px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); margin-bottom: 30px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <div style="width: 150px; height: 150px; margin: 0 auto 20px; border-radius: 50%; box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3); border: 3px solid #fff; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 48px; color: white;">👤</span>
                            </div>
                            <h3 style="color: #2c3e50; font-size: 28px; margin-bottom: 10px;">制作者</h3>
                            <p style="color: #3498db; font-size: 24px; font-weight: 600;">VaziBoo</p>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 20px;">
                            <a href="https://x.com/boo_vazi" target="_blank" style="text-decoration: none;">
                                <div style="background: linear-gradient(135deg, #1DA1F2 0%, #0088cc 100%); color: white; padding: 20px; border-radius: 15px; display: flex; align-items: center; justify-content: space-between; transition: transform 0.3s;">
                                    <div style="display: flex; align-items: center; gap: 15px;">
                                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                                            <span style="font-size: 24px;">🐦</span>
                                        </div>
                                        <div>
                                            <h4 style="margin: 0; font-size: 18px; font-weight: 600;">VaziBoo Twitter</h4>
                                            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">@boo_vazi</p>
                                        </div>
                                    </div>
                                    <div style="font-size: 24px;">→</div>
                                </div>
                            </a>

                            <a href="https://discord.gg/kfrPJ2F2cf" target="_blank" style="text-decoration: none;">
                                <div style="background: linear-gradient(135deg, #7289DA 0%, #5865F2 100%); color: white; padding: 20px; border-radius: 15px; display: flex; align-items: center; justify-content: space-between; transition: transform 0.3s;">
                                    <div style="display: flex; align-items: center; gap: 15px;">
                                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                                            <span style="font-size: 24px;">💬</span>
                                        </div>
                                        <div>
                                            <h4 style="margin: 0; font-size: 18px; font-weight: 600;">Discord Server</h4>
                                            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">コミュニティに参加</p>
                                        </div>
                                    </div>
                                    <div style="font-size: 24px;">→</div>
                                </div>
                            </a>
                        </div>
                    </div>

                    <div style="background: #f8f9fa; border-radius: 15px; padding: 30px; text-align: center;">
                        <h3 style="color: #2c3e50; margin-bottom: 15px;">🎮 About This Tool</h3>
                        <p style="color: #7f8c8d; line-height: 1.8;">
                            このツールは Rise of Kingdoms のゲームデータを分析・可視化するために作成されました。<br>
                            プレイヤーの成長追跡、ランキング分析、統計データの確認などが可能です。<br>
                            ご利用いただきありがとうございます！
                        </p>
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
                            <p style="color: #95a5a6; font-size: 14px;">
                                © 2024 VaziBoo - ROK Kingdom Data Tool<br>
                                Version 1.0.0
                            </p>
                        </div>
                    </div>
                </div>
            `;

            console.log('Contact tab innerHTML after:', contactTab.innerHTML.length);

            // 少し後にも確認
            setTimeout(() => {
                console.log('Contact tab display after 100ms:', window.getComputedStyle(contactTab).display);
                console.log('Contact tab visibility after 100ms:', window.getComputedStyle(contactTab).visibility);
                console.log('Contact tab opacity after 100ms:', window.getComputedStyle(contactTab).opacity);
                console.log('Contact tab children count:', contactTab.children.length);
                console.log('Contact tab innerHTML length:', contactTab.innerHTML.length);
                console.log('Contact tab innerHTML preview:', contactTab.innerHTML.substring(0, 200));

                // 最終チェック：表示されていない場合の緊急対応
                const finalDisplay = window.getComputedStyle(contactTab).display;
                if (finalDisplay === 'none') {
                    console.error('Contact tab still not displaying! Applying emergency fix...');
                    contactTab.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 1000 !important;';
                }
            }, 100);
        } else {
            console.error('Contact tab element not found!');

            // 万が一の場合: DOM全体を確認
            const allElements = document.querySelectorAll('*[id*="contact"], *[class*="contact"], *[id*="Contact"], *[class*="Contact"]');
            console.log('Elements with contact in id/class:', allElements);
        }
    }

    console.log('=== switchTab end ===');
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
            
            console.log('成長ランキング初期化 - 全期間設定:', firstDate, '～', lastDate);
            
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
        console.log('日付が選択されていません');
        return;
    }

    const startFormatted = startDate.replace(/-/g, '/');
    const endFormatted = endDate.replace(/-/g, '/');
    const metric = document.getElementById('growthMetric').value;
    const limit = parseInt(document.getElementById('growthLimit').value);
    const sortBy = document.getElementById('growthSort').value;
    const filterType = document.getElementById('growthFilter').value;

    console.log('=== 成長ランキング更新開始 ===');
    console.log('分析期間:', startFormatted, '～', endFormatted);
    console.log('選択指標:', metric);
    console.log('表示制限:', limit);
    console.log('フィルター:', filterType);

    // 開始日と終了日のデータを取得
    const startData = allData.filter(row => row.Data === startFormatted);
    const endData = allData.filter(row => row.Data === endFormatted);

    console.log('開始日データ数:', startData.length);
    console.log('終了日データ数:', endData.length);

    // 特定IDの存在確認
    const targetId = '75607809';
    const startHasTarget = startData.some(row => row.ID === targetId);
    const endHasTarget = endData.some(row => row.ID === targetId);
    console.log(`ID ${targetId} - 開始日存在: ${startHasTarget}, 終了日存在: ${endHasTarget}`);

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
                console.log(`ID ${targetId} - 終了日にデータがありません`);
            }
            return;
        }

        const startValue = parseInt((startRow[metric] || '0').toString().replace(/,/g, '')) || 0;
        const endValue = parseInt((endRow[metric] || '0').toString().replace(/,/g, '')) || 0;
        const difference = endValue - startValue;
        const growthRate = startValue > 0 ? (difference / startValue * 100) : 0;

        // フィルター適用前にログ出力
        if (startRow.ID === targetId) {
            console.log(`ID ${targetId} - フィルター適用前:`, {
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
                console.log(`ID ${targetId} - 成長フィルターで除外 (difference: ${difference})`);
            }
            return;
        }
        if (filterType === 'decline' && difference >= 0) {
            if (startRow.ID === targetId) {
                console.log(`ID ${targetId} - 減少フィルターで除外 (difference: ${difference})`);
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
            console.log(`ID ${targetId} - 成長データに追加されました:`, growthEntry);
        }
    });

    console.log('総成長データ数:', growthData.length);
    console.log(`ID ${targetId} が含まれているか:`, growthData.some(item => item.id === targetId));

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

    console.log('表示データ数:', displayData.length);
    console.log(`表示データにID ${targetId} が含まれているか:`, displayData.some(item => item.id === targetId));

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
    console.log('=== 成長ランキング更新完了 ===');
}

// 成長ランキングテーブルのソート
function sortGrowthTable(column) {
    // データが存在するかチェック
    if (!allGrowthData || allGrowthData.length === 0) {
        console.log('成長データが存在しません');
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
    
    console.log('=== 成長ランキング検索開始 ===');
    console.log('検索語:', `"${searchTerm}"`);
    console.log('allGrowthData の件数:', allGrowthData ? allGrowthData.length : 0);
    
    // 検索対象データの確認
    if (!allGrowthData || allGrowthData.length === 0) {
        console.log('❌ 検索対象のデータがありません - 先に成長ランキングの期間を設定してください');
        
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
    console.log(`ID ${targetId} がallGrowthDataに含まれているか: ${hasTargetId}`);
    if (hasTargetId) {
        const targetData = allGrowthData.find(row => row.id === targetId);
        console.log(`ID ${targetId} のデータ:`, targetData);
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
        
        console.log('検索語なし - 全データ表示:', filteredGrowthData.length, '件');
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
                console.log(`ID ${targetId} の検索詳細:`, {
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
        
        console.log(`検索結果: ${filteredGrowthData.length}件 (検索語: "${searchTerm}")`);
        console.log(`検索結果にID ${targetId} が含まれているか:`, filteredGrowthData.some(row => row.id === targetId));
    }
    
    // 検索結果の件数を更新
    document.getElementById('growthAnalysisCount').textContent = filteredGrowthData.length;
    
    // テーブルを再表示
    displayGrowthTable(filteredGrowthData);
    console.log('=== 成長ランキング検索完了 ===');
}

// 名前クリックで個人分析へ遷移
function navigateToPlayer(playerName, playerId) {
    // 個人分析タブに切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn')[3].classList.add('active'); // 個人分析タブ（4番目）
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById('individualTab').classList.add('active');
    
    // 検索ボックスに名前を設定して検索実行
    document.getElementById('playerSearch').value = playerName;
    searchPlayer();
}

function setupEventListeners() {
    // 検索機能にデバウンスを適用してパフォーマンス改善
    const debouncedSearch = debounce(filterDataBySearch, 300);
    getElement('searchInput').addEventListener('input', debouncedSearch);
    
    // ホームボタン（タイトル）のクリックイベント
    const homeTitle = document.getElementById('homeTitle');
    if (homeTitle) {
        homeTitle.addEventListener('click', navigateToHome);
    }
    
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

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
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

// Power帯からノルマを取得する関数（戦死ノルマのみ9/22時点のPowerで計算）
function getKvkNormaByPower(power, useDeathRateCalculation = false, startPower = null) {
    const powerNum = parseInt((power || '0').toString().replace(/,/g, '')) || 0;

    for (const norma of KVK_NORMA_TABLE) {
        if (powerNum >= norma.minPower && powerNum <= norma.maxPower) {
            let deathTarget;

            if (useDeathRateCalculation && startPower) {
                // 戦死ノルマのみ9/22時点のPowerでDeath Rateを使って計算
                const startPowerNum = parseInt((startPower || '0').toString().replace(/,/g, '')) || 0;
                deathTarget = Math.round(startPowerNum * norma.deathRate);
            } else {
                // 表示用の固定値
                deathTarget = norma.deathTarget;
            }

            return {
                killTarget: norma.killTarget, // 撃破ノルマは常にPower帯の固定値
                deathTarget: deathTarget,
                deathRate: norma.deathRate
            };
        }
    }

    // 該当しない場合はデフォルト値
    return { killTarget: 0, deathTarget: 0, deathRate: 0 };
}

// KVKノルマチェッカー: プレイヤー検索機能
function searchKvkPlayer() {
    const searchTerm = document.getElementById('kvkPlayerSearch').value.toLowerCase().trim();

    if (!searchTerm) {
        alert('プレイヤー名またはIDを入力してください');
        return;
    }

    if (!allData || allData.length === 0) {
        alert('データが読み込まれていません。しばらくお待ちください。');
        return;
    }

    // プレイヤーデータを検索
    const playerData = allData.filter(row => {
        return (row.Name && row.Name.toString().toLowerCase().includes(searchTerm)) ||
               (row.ID && row.ID.toString().toLowerCase().includes(searchTerm));
    });

    if (playerData.length === 0) {
        alert('該当するプレイヤーが見つかりません');
        return;
    }

    // 最新のプレイヤーデータを取得
    const latestData = playerData.sort((a, b) => {
        return new Date(b.Data) - new Date(a.Data);
    })[0];

    // 同じプレイヤーの全データを取得（IDまたは名前で照合）
    const allPlayerData = allData.filter(row =>
        row.ID === latestData.ID || row.Name === latestData.Name
    ).sort((a, b) => new Date(a.Data) - new Date(b.Data));

    // KVKノルマ進捗を計算
    calculateKvkProgress(latestData, allPlayerData);
}

// KVKノルマ進捗計算機能
function calculateKvkProgress(latestData, allPlayerData) {
    // 9/22のデータを探す
    const kvkStartDate = '2025/09/22';
    let startData = allPlayerData.find(row => row.Data === kvkStartDate);

    if (!startData) {
        // 9/22のデータがない場合、最も古いデータを使用
        console.warn(`${kvkStartDate} のデータが見つかりません。最も古いデータを使用します。`);
        const oldestData = allPlayerData.length > 0 ? allPlayerData[0] : null;
        if (!oldestData) {
            alert('プレイヤーのデータが不足しています。');
            return;
        }
        startData = oldestData;
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
    updateKvkProgressUI({
        player: currentData,
        norma: norma,
        startDate: kvkStartDate,
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
}

// KVKノルマチェッカーのUI更新
function updateKvkProgressUI(data) {
    // 検索ガイドを非表示、結果を表示
    document.getElementById('kvkSearchGuide').style.display = 'none';
    document.getElementById('kvkPlayerResult').style.display = 'block';

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
        console.warn('プレイヤーデータが不足しているため、グラフを作成できません。');
        return;
    }

    // 9/22を起点とした日別データを準備
    const kvkStartDate = new Date('2025/09/22');
    const chartData = prepareKvkChartData(allPlayerData, kvkStartDate);

    if (chartData.dates.length === 0) {
        console.warn('グラフ用のデータが不足しています。');
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

    // 9/22以降のデータをフィルター
    const kvkData = sortedData.filter(row => {
        const rowDate = new Date(row.Data);
        return rowDate >= startDate;
    });

    if (kvkData.length === 0) return { dates: [], killProgress: [], deathProgress: [] };

    // 起点データ（9/22）
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

// ホーム画面への遷移機能
function navigateToHome() {
    // 認証状態は維持したままホーム画面に戻る
    window.location.href = 'home.html';
}