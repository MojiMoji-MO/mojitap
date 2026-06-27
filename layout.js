/* ⚙️ layout.js (모지탭 전체 공통 헤더/푸터, 언어 및 즐겨찾기 시스템) */

function renderHeader(activeMenu) {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    const isHome = activeMenu === 'home' ? 'active' : '';
    const isAll = activeMenu === 'all' ? 'active' : '';
    const isBlog = activeMenu === 'blog' ? 'active' : '';

    headerPlaceholder.innerHTML = `
        <header class="main-header">
            <div class="header-top-row">
                <a href="/" class="logo-link">
                    <img src="mojitap-logo.png" alt="Mojitap Logo" onerror="this.outerHTML='<h2 style=\\'margin:0; color:var(--primary-color); font-weight:800; letter-spacing:-1px;\\'>Mojitap</h2>'">
                </a>
                <div class="header-right-actions" style="display: flex; gap: 8px; align-items: center;">
                    <!-- 🟢 [추가완료] 즐겨찾기(단골) 버튼 -->
                    <button onclick="promptBookmark()" style="background:var(--secondary-bg); color:var(--primary-color); border:none; padding:6px 10px; border-radius:8px; font-weight:800; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:4px; transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        ⭐ <span class="lang-ko">즐겨찾기</span><span class="lang-en">Bookmark</span>
                    </button>
                    <div class="lang-toggle">
                        <button class="lang-btn" id="btn-ko" onclick="setLanguage('ko')">KOR</button>
                        <button class="lang-btn" id="btn-en" onclick="setLanguage('en')">ENG</button>
                    </div>
                </div>
            </div>
            <nav class="top-nav">
                <a href="/" class="nav-item ${isHome}"><span class="lang-ko">✨ 이모지 툴</span><span class="lang-en">✨ Emoji Tool</span></a>
                <a href="/all" class="nav-item ${isAll}"><span class="lang-ko">🌍 전체 이모지</span><span class="lang-en">🌍 All Emojis</span></a>
                <a href="/blog" class="nav-item ${isBlog}"><span class="lang-ko">💡 이모지 팁</span><span class="lang-en">💡 Emoji Tips</span></a>
            </nav>
        </header>
    `;
}

function renderFooter() {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;

    footerPlaceholder.innerHTML = `
        <footer>
            <div class="footer-links">
                <a href="/about"><span class="lang-ko">사이트 소개</span><span class="lang-en">About Us</span></a>
                <a href="/privacy"><span class="lang-ko">개인정보처리방침</span><span class="lang-en">Privacy Policy</span></a>
                <a href="/terms"><span class="lang-ko">이용약관</span><span class="lang-en">Terms of Use</span></a>
                <a href="/contact"><span class="lang-ko">문의하기</span><span class="lang-en">Contact</span></a>
            </div>
            <div class="copyright" style="margin-top:15px; color:var(--text-muted); font-size:13px;">&copy; 2026 Mojitap. All rights reserved.</div>
        </footer>
    `;
}

function setLanguage(lang) {
    document.documentElement.lang = lang;
    document.body.className = lang;
    
    const btnKo = document.getElementById('btn-ko');
    const btnEn = document.getElementById('btn-en');
    if(btnKo) btnKo.classList.toggle('active', lang === 'ko');
    if(btnEn) btnEn.classList.toggle('active', lang === 'en');
    
    const editor = document.getElementById('mainEditor');
    if (editor) {
        if(lang === 'ko') {
            editor.placeholder = "여기에 텍스트를 붙여넣으세요...";
        } else {
            editor.placeholder = "Paste your text here...";
        }
    }

    localStorage.setItem('mojitap_lang', lang);
}

// 🟢 [추가완료] 기기별 맞춤형 즐겨찾기/홈화면 추가 유도 로직
function promptBookmark() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMac = userAgent.includes('mac');
    const isMobile = /iphone|ipad|ipod|android/i.test(userAgent);
    const isKo = document.documentElement.lang === 'ko';
    let message = '';

    // 모바일 (홈 화면 추가 유도)
    if (isMobile) {
        message = isKo 
            ? "💡 브라우저 메뉴(공유)에서 '홈 화면에 추가'를 눌러 앱처럼 1초 만에 접속하세요!" 
            : "💡 Tap Share > 'Add to Home Screen' to use it like an app!";
    } 
    // PC (단축키 안내)
    else {
        const shortcut = isMac ? 'Cmd + D' : 'Ctrl + D';
        message = isKo 
            ? `⭐ 키보드에서 [ ${shortcut} ]를 눌러 즐겨찾기에 등록해 주세요!` 
            : `⭐ Press [ ${shortcut} ] to bookmark this page!`;
    }

    // index.html 등에 있는 전역 showToast 함수 호출
    if (typeof showToast === 'function') {
        showToast(message);
    } else {
        alert(message);
    }
}

function initLayout(activeMenu) {
    renderHeader(activeMenu);
    renderFooter();

    const savedLang = localStorage.getItem('mojitap_lang');
    if (savedLang) {
        setLanguage(savedLang);
    } else {
        const userLang = navigator.language || navigator.userLanguage;
        if (!userLang.includes('ko')) setLanguage('en'); else setLanguage('ko');
    }
}
