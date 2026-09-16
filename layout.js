/* Shared navigation enhancement. All essential links also exist in each HTML. */
function renderHeader(activeMenu) {
    const container = document.getElementById('header-placeholder');
    if (!container) return;
    const active = activeMenu === 'all' ? 'all-emojis' : activeMenu;
    container.querySelectorAll('[data-menu]').forEach(link => {
        const selected = link.dataset.menu === active;
        link.classList.toggle('active', selected);
        if (selected) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
    const bookmark = container.querySelector('[data-bookmark]');
    if (bookmark && !bookmark.dataset.bound) {
        bookmark.hidden = false;
        bookmark.addEventListener('click', promptBookmark);
        bookmark.dataset.bound = 'true';
    }
}
function renderFooter() { /* Footer links are in the HTML, including without JavaScript. */ }
function promptBookmark() {
    const agent = navigator.userAgent.toLowerCase();
    const mobile = /iphone|ipad|ipod|android/.test(agent) || (agent.includes('mac') && navigator.maxTouchPoints > 1);
    const message = mobile ? 'Use your browser menu or Share menu to bookmark this page.' :
        'Press ' + (agent.includes('mac') ? 'Command + D' : 'Ctrl + D') + ' to bookmark this page.';
    if (typeof showToast === 'function') showToast(message);
    else {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message; toast.classList.add('show');
            clearTimeout(window.mojitapBookmarkTimer);
            window.mojitapBookmarkTimer = setTimeout(() => toast.classList.remove('show'), 4000);
        }
    }
}
function initLayout(activeMenu) {
    renderHeader(activeMenu);
    renderFooter();
    document.documentElement.lang = 'en';
    document.body.classList.add('en');
    const editor = document.getElementById('mainEditor');
    if (editor) editor.placeholder = 'Paste your text here...';
    const toast = document.getElementById('toast');
    const status = document.getElementById('site-status');
    if (toast && status && !toast.dataset.observed) {
        const observer = new MutationObserver(() => {
            status.textContent = toast.textContent;
        });
        observer.observe(toast, {childList:true, characterData:true, subtree:true});
        toast.dataset.observed = 'true';
    }
}
