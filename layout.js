/* ⚙️ layout.js (Pure English Global Version) */

function renderHeader(activeMenu) {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    const isHome = activeMenu === 'home' ? 'active' : '';
    const isAll = activeMenu === 'all' ? 'active' : '';
    const isBlog = activeMenu === 'blog' ? 'active' : '';

    // 🚨 KOR/ENG 동적 버튼 싹 삭제 완료! 순수 영문 텍스트만 남김
    headerPlaceholder.innerHTML = `
        <header class="main-header">
            <div class="header-top-row">
                <a href="/" class="logo-link">
                    <img src="mojitap-logo.png" alt="Mojitap Logo" onerror="this.outerHTML='<h2 style=\\'margin:0; color:var(--primary-color); font-weight:800; letter-spacing:-1px;\\'>Mojitap</h2>'">
                </a>
                <div class="header-right-actions" style="display: flex; gap: 8px; align-items: center;">
                    <button onclick="promptBookmark()" style="background:var(--secondary-bg); color:var(--primary-color); border:none; padding:6px 10px; border-radius:8px; font-weight:800; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:4px; transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        ⭐ Bookmark
                    </button>
                </div>
            </div>
            <nav class="top-nav">
                <a href="/" class="nav-item ${isHome}">✨ Emoji Tool</a>
                <a href="/all" class="nav-item ${isAll}">🌍 All Emojis</a>
                <a href="/blog" class="nav-item ${isBlog}">💡 Emoji Tips</a>
            </nav>
        </header>
    `;
}

function renderFooter() {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;

    // 🚨 하단 메뉴 순수 영문 고정 완료!
    footerPlaceholder.innerHTML = `
        <footer>
            <div class="footer-links">
                <a href="/about">About Us</a>
                <a href="/privacy">Privacy Policy</a>
                <a href="/terms">Terms of Use</a>
                <a href="/contact">Contact Us</a>
            </div>
            <div class="copyright" style="margin-top:15px; color:var(--text-muted); font-size:13px;">&copy; 2026 Mojitap. All rights reserved.</div>
        </footer>
    `;
}

function promptBookmark() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMac = userAgent.includes('mac');
    const isMobile = /iphone|ipad|ipod|android/i.test(userAgent);
    let message = '';

    if (isMobile) {
        message = "💡 Tap Share > 'Add to Home Screen' to use it like an app!";
    } else {
        const shortcut = isMac ? 'Cmd + D' : 'Ctrl + D';
        message = `⭐ Press [ ${shortcut} ] to bookmark this page!`;
    }

    if (typeof showToast === 'function') {
        showToast(message);
    } else {
        alert(message);
    }
}

function initLayout(activeMenu) {
    renderHeader(activeMenu);
    renderFooter();
    
    // 🚨 기존에 브라우저에 남아있던 한국어 설정을 강제로 삭제하고 무조건 영어(en)로 고정!
    document.documentElement.lang = 'en';
    document.body.className = 'en';
    localStorage.removeItem('mojitap_lang');

    // 입력창 placeholder 영문 강제 고정
    const editor = document.getElementById('mainEditor');
    if (editor) {
        editor.placeholder = "Paste your text here...";
    }
}
