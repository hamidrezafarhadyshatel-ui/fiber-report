let currentPage = 'dashboard';
let lastBackPressTime = 0;
let exitInProgress = false;
const DOUBLE_BACK_INTERVAL = 1500; // ۱.۵ ثانیه

function renderPage(page, { focus = true } = {}) {
    currentPage = page;
    const dashboard = document.getElementById('dashboard');
    const reportPages = document.querySelectorAll('.report-page');

    if (page === 'dashboard') {
        if (dashboard) dashboard.style.display = 'block';
        reportPages.forEach(el => el.classList.remove('active'));
        return;
    }

    const map = {
        drop: 'pageDrop',
        fusion: 'pageFusion',
        fat: 'pageFat',
        shoot: 'pageShoot',
        omran: 'pageOmran',
        aggregate: 'pageAggregate'
    };
    const targetId = map[page];
    if (!targetId) return;

    if (page === 'aggregate' && typeof isAggregateAccessAllowed === 'function' && !isAggregateAccessAllowed()) {
        showToast('دسترسی به گزارش تجمیعی فقط برای مدیر سیستم مجاز است.', true);
        currentPage = 'dashboard';
        return navigateTo('dashboard');
    }

    if (dashboard) dashboard.style.display = 'none';
    reportPages.forEach(el => el.classList.remove('active'));
    document.getElementById(targetId)?.classList.add('active');

    if (page === 'aggregate') {
        if (typeof initAggregatePage === 'function') initAggregatePage();
        if (typeof renderAggregateUI === 'function') renderAggregateUI();
        return;
    }

    setupDateValidation(page);
    bindActions();
    if (focus) {
        const contractorId = page + 'Contractor';
        setTimeout(() => document.getElementById(contractorId)?.focus(), 200);
    }
}

function navigateTo(page, { replace = false, focus = true } = {}) {
    const map = {
        dashboard: window.location.pathname,
        drop: window.location.pathname,
        fusion: window.location.pathname,
        fat: window.location.pathname,
        shoot: window.location.pathname,
        omran: window.location.pathname,
        aggregate: window.location.pathname
    };
    if (!(page in map)) return;

    if (page === 'aggregate' && typeof isAggregateAccessAllowed === 'function' && !isAggregateAccessAllowed()) {
        showToast('دسترسی به گزارش تجمیعی فقط برای مدیر سیستم مجاز است.', true);
        page = 'dashboard';
    }

    // وقتی به داشبورد برمی‌گردیم، entry جدید نساز
    if (page === 'dashboard') replace = true;

    const state = { page };
    const url = map[page];
    if (replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
    renderPage(page, { focus });
}

function handlePopState(event) {
    if (exitInProgress) return;

    // اگر تو صفحه گزارش هستیم → اولین بک باید برگرده به داشبورد
    if (currentPage !== 'dashboard') {
        renderPage('dashboard', { focus: false });
        // یه entry پاک کن تا کاربر واقعاً تو داشبورد بمونه
        history.pushState({ page: 'dashboard' }, '', window.location.pathname);
        return;
    }

    // الان تو داشبورد هستیم → دو-ضربه برای خروج
    if (backPressCount > 0) {
        clearTimeout(backPressTimer);
        backPressCount = 0;
        exitInProgress = true;
        tryExitApp();
        return;
    }

    backPressCount++;
    showToast('برای خروج، دکمه بازگشت را دوباره بزنید.', false);
    history.pushState({ page: 'dashboard' }, '', window.location.pathname);
    backPressTimer = setTimeout(() => {
        backPressCount = 0;
    }, 2000);
}

function tryExitApp() {
    // تلاش ۱: Median bridge
    try {
        if (typeof median !== 'undefined' && median.navigation && typeof median.navigation.close === 'function') {
            median.navigation.close();
            return;
        }
    } catch (e) { console.warn('Median exit failed:', e); }

    // تلاش ۲: window.close
    try { window.close(); return; } catch (e) {}

    // تلاش ۳: navigator.app (قدیمی)
    if (typeof navigator !== 'undefined' && navigator.app && typeof navigator.app.exitApp === 'function') {
        navigator.app.exitApp();
        return;
    }

    // اگه هیچ‌کدوم جواب نداد
    exitInProgress = false;
    showToast('برای خروج، دکمه هوم گوشی را بزنید.', false);
}
