// ================================================================
// Navigation + Android Back Button Protection
// ================================================================

let currentPage = 'dashboard';
let exiting = false;

function renderPage(page, { focus = true } = {}) {
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

function navigateTo(page, { focus = true } = {}) {
    const validPages = ['dashboard', 'drop', 'fusion', 'fat', 'shoot', 'omran', 'aggregate'];
    if (!validPages.includes(page)) return;

    if (page === 'aggregate' && typeof isAggregateAccessAllowed === 'function' && !isAggregateAccessAllowed()) {
        showToast('دسترسی به گزارش تجمیعی فقط برای مدیر سیستم مجاز است.', true);
        page = 'dashboard';
    }

    const state = { page };
    if (page === 'dashboard') {
        history.replaceState(state, '', location.pathname);
    } else {
        history.pushState(state, '', location.pathname);
    }

    currentPage = page;
    renderPage(page, { focus });
}

// این تابع رو تو showApp صدا بزن به جای navigateTo('dashboard')
function initNavigation() {
    history.replaceState({ page: 'dashboard' }, '', location.pathname);
    history.pushState({ page: 'dashboard' }, '', location.pathname);
    currentPage = 'dashboard';
    renderPage('dashboard', { focus: false });
}

function handlePopState(event) {
    if (exiting) return;

    const prevPage = currentPage;
    const targetPage = event.state?.page || 'dashboard';

    // مقصد یک صفحه گزارش است → همون رو نمایش بده
    if (targetPage !== 'dashboard') {
        currentPage = targetPage;
        renderPage(targetPage, { focus: false });
        return;
    }

    // مقصد داشبورد است
    if (prevPage === 'dashboard') {
        // کاربر روی داشبورد بوده و back زده → تأیید خروج
        askExitConfirmation();
        return;
    }

    // از صفحه گزارش برمی‌گردیم به داشبورد → فقط render کن، دیالوگ نده
    currentPage = 'dashboard';
    renderPage('dashboard', { focus: false });
}

function askExitConfirmation() {
    const shouldExit = window.confirm('آیا می‌خواهید از برنامه خارج شوید؟');

    if (shouldExit) {
        exiting = true;
        tryExitApp();
        return;
    }

    // کاربر "خیر" زد → یه guard جدید بذار تا back بعدی هم trigger بشه
    history.pushState({ page: 'dashboard' }, '', location.pathname);
}

function tryExitApp() {
    try {
        if (typeof median !== 'undefined' && median.navigation && typeof median.navigation.close === 'function') {
            median.navigation.close();
            return;
        }
    } catch (e) { console.warn('Median exit failed:', e); }

    try { window.close(); return; } catch (e) {}

    if (typeof navigator !== 'undefined' && navigator.app && typeof navigator.app.exitApp === 'function') {
        navigator.app.exitApp();
        return;
    }

    exiting = false;
    showToast('برای خروج، دکمه هوم گوشی را بزنید.', false);
    history.pushState({ page: 'dashboard' }, '', location.pathname);
}
