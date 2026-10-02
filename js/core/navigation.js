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
        omran: 'pageOmran'
    };
    const targetId = map[page];
    if (!targetId) return;

    if (dashboard) dashboard.style.display = 'none';
    reportPages.forEach(el => el.classList.remove('active'));
    document.getElementById(targetId)?.classList.add('active');

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

    // ⭐ مهم: وقتی به داشبورد برمی‌گردیم، replace کن تا history اضافه نشه
    if (page === 'dashboard') replace = true;

    const state = { page };
    const url = map[page];
    if (replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
    renderPage(page, { focus });
}

let backPressCount = 0;
let backPressTimer = null;

function handlePopState(event) {
    const page = event.state?.page;

    // اگه تو داشبورد یا ریشه هستیم → تلاش برای خروج
    if (!page || page === 'dashboard') {
        // اگه کاربر قبلاً back زده بود تو ۲ ثانیه اخیر
        if (backPressCount > 0) {
            clearTimeout(backPressTimer);
            tryExitApp();
            return;
        }

        // بار اول: به کاربر بگو دوباره بزنه + یه entry مجدد push کن
        backPressCount++;
        showToast('برای خروج، دکمه بازگشت را دوباره بزنید.', false);

        // یه state جدید push کن تا back بعدی هم trigger بشه
        history.pushState({ page: 'dashboard' }, '', window.location.pathname);

        backPressTimer = setTimeout(() => {
            backPressCount = 0;
        }, 2000);
        return;
    }

    // در غیر این صورت، page عوض کن
    renderPage(page, { focus: false });
}

function tryExitApp() {
    // تلاش ۱: Median bridge
    try {
        if (typeof median !== 'undefined') {
            if (median.navigation && typeof median.navigation.close === 'function') {
                median.navigation.close();
                return;
            }
            if (median.app && typeof median.app.exit === 'function') {
                median.app.exit();
                return;
            }
        }
    } catch (e) { console.warn('Median exit failed:', e); }

    // تلاش ۲: window.close
    try { window.close(); return; } catch (e) {}

    // تلاش ۳: navigator.app (قدیمی)
    if (typeof navigator !== 'undefined' && navigator.app && typeof navigator.app.exitApp === 'function') {
        navigator.app.exitApp();
        return;
    }

    // تلاش ۴: به کاربر بگو با هوم بزنه
    showToast('برای خروج، دکمه هوم گوشی را بزنید.', false);
}
