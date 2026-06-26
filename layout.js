/* ⚙️ layout.js (모지탭 전체 공통 헤더/푸터 & 언어 시스템) */

// 1. 헤더 그리기
function renderHeader(activeMenu) {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // 🟢 3개의 메뉴에 불을 켜기 위한 세팅
    const isHome = activeMenu === 'home' ? 'active' : '';
    const isAll = activeMenu === 'all' ? 'active' : '';
    const isBlog = activeMenu === 'blog' ? 'active' : '';

    headerPlaceholder.innerHTML = `
        <header class="main-header">
            <div class="header-top-row">
                <a href="/" class="logo-link">
                    <img src="mojitap-logo.png" alt="Mojitap Logo" onerror="this.outerHTML='<h2 style=\\'margin:0; color:var(--primary-color); font-weight:800; letter-spacing:-1px;\\'>Mojitap</h2>'">
                </a>
                <div class="lang-toggle">
                    <button class="lang-btn" id="btn-ko" onclick="setLanguage('ko')">KOR</button>
                    <button class="lang-btn" id="btn-en" onclick="setLanguage('en')">ENG</button>
                </div>
            </div>
            <!-- 🟢 [수정 완료] 메뉴 3개로 확장 및 이름 변경 -->
            <nav class="top-nav">
                <a href="/" class="nav-item ${isHome}"><span class="lang-ko">✨ 이모지 툴</span><span class="lang-en">✨ Emoji Tool</span></a>
                <a href="/all" class="nav-item ${isAll}"><span class="lang-ko">🌍 전체 이모지</span><span class="lang-en">🌍 All Emojis</span></a>
                <a href="/blog" class="nav-item ${isBlog}"><span class="lang-ko">💡 이모지 팁</span><span class="lang-en">💡 Emoji Tips</span></a>
            </nav>
        </header>
    `;
}

// 2. 푸터 그리기
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

// 3. 글로벌 언어 유지 시스템
function setLanguage(lang) {
    document.documentElement.lang = lang;
    document.body.className = lang;
    
    const btnKo = document.getElementById('btn-ko');
    const btnEn = document.getElementById('btn-en');
    if(btnKo) btnKo.classList.toggle('active', lang === 'ko');
    if(btnEn) btnEn.classList.toggle('active', lang === 'en');
    
    // 🟢 [수정 완료] KOR/ENG 버튼을 눌러도 플레이스홀더가 무조건 1줄만 나오도록 고정!
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

// 4. 페이지 시작 시 모든 모듈 결합 (기계 가동!)
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
