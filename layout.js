/* ⚙️ layout.js (모지탭 전체 공통 헤더/푸터 & 언어 시스템) */

// 1. 헤더 그리기
function renderHeader(activeMenu) {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    const isHome = activeMenu === 'home' ? 'active' : '';
    const isBlog = activeMenu === 'blog' ? 'active' : '';

    headerPlaceholder.innerHTML = `
        <header class="main-header">
            <div class="header-top-row">
                <a href="/" class="logo-link"><img src="mojitap-logo.png" alt="Mojitap Logo"></a>
                <div class="lang-toggle">
                    <button class="lang-btn" id="btn-ko" onclick="setLanguage('ko')">KOR</button>
                    <button class="lang-btn" id="btn-en" onclick="setLanguage('en')">ENG</button>
                </div>
            </div>
            <nav class="top-nav">
                <a href="/" class="nav-item ${isHome}"><span class="lang-ko">✨ 이모지 툴</span><span class="lang-en">✨ Emoji Tool</span></a>
                <a href="/blog" class="nav-item ${isBlog}"><span class="lang-ko">📚 마케팅 꿀팁</span><span class="lang-en">📚 Marketing Tips</span></a>
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
                <a href="/about"><span class="lang-ko">사이트 소개</span><span class="lang-en">About</span></a>
                <a href="/privacy"><span class="lang-ko">개인정보처리방침</span><span class="lang-en">Privacy Policy</span></a>
                <a href="/terms"><span class="lang-ko">이용약관</span><span class="lang-en">Terms of Service</span></a>
                <a href="/contact"><span class="lang-ko">문의하기</span><span class="lang-en">Contact</span></a>
            </div>
            <div class="copyright">&copy; 2026 Mojitap. All rights reserved.</div>
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
    
    // 에디터 Placeholder 변경 (index.html에만 존재)
    const editor = document.getElementById('mainEditor');
    if (editor) {
        if(lang === 'ko') {
            editor.placeholder = "여기에 텍스트를 붙여넣으세요...\n(예: 대박 할인 이벤트 오늘 마감합니다 서두르세요!)\n\n버튼을 누르면 마법처럼 이모지가 입혀집니다. 직접 수정하거나 팔레트를 눌러 이모지를 추가할 수도 있어요!";
        } else {
            editor.placeholder = "Paste your text here...\n(e.g., Big sale event ends today, hurry up!)\n\nClick the AI button for magic. You can also edit freely and click the palette below to add emojis at your cursor!";
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
