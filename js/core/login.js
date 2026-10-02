function fillTodayJalali(pageId) {
    const yearEl = document.getElementById(pageId + 'Year');
    const monthEl = document.getElementById(pageId + 'Month');
    const dayEl = document.getElementById(pageId + 'Day');
    if (!yearEl || !monthEl || !dayEl) return;
    if (yearEl.value && monthEl.value && dayEl.value) return;

    const now = new Date();
    let jy, jm, jd;
    if (typeof moment !== 'undefined' && typeof moment().jYear === 'function') {
        const todayJalali = moment(now).format('jYYYY/jMM/jDD');
        const parts = todayJalali.split('/');
        jy = parseInt(parts[0], 10);
        jm = parseInt(parts[1], 10);
        jd = parseInt(parts[2], 10);
    } else {
        let gy = now.getFullYear(), gm = now.getMonth() + 1, gd = now.getDate();
        const gdm = [0,31,28,31,30,31,30,31,31,30,31,30,31];
        let gy2 = gm > 2 ? gy + 1 : gy;
        let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd;
        for (let i = 1; i < gm; i++) days += gdm[i];
        let jy2 = -1595 + 33 * Math.floor(days / 12053);
        days %= 12053;
        jy2 += 4 * Math.floor(days / 1461);
        days %= 1461;
        if (days > 365) { jy2 += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
        jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
        jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
        jy = jy2;
    }
    if (Number.isFinite(jy) && Number.isFinite(jm) && Number.isFinite(jd)) {
        yearEl.value = jy;
        monthEl.value = jm;
        dayEl.value = jd;
    }
}

function setupDateValidation(pageId) {
    const yearId = pageId + 'Year';
    const monthId = pageId + 'Month';
    const dayId = pageId + 'Day';
    const yearEl = document.getElementById(yearId);
    const monthEl = document.getElementById(monthId);
    const dayEl = document.getElementById(dayId);
    if (!yearEl || !monthEl || !dayEl || yearEl.dataset.dateValidationBound === 'true') return;
    yearEl.dataset.dateValidationBound = 'true';

    fillTodayJalali(pageId);

    function validateAndStyle() {
        const valid = validateDate(yearId, monthId, dayId);
        const msg = valid ? '' : 'تاریخ نامعتبر است';
        yearEl.setCustomValidity(msg);
        monthEl.setCustomValidity(msg);
        dayEl.setCustomValidity(msg);
    }

    yearEl.addEventListener('input', validateAndStyle);
    monthEl.addEventListener('input', validateAndStyle);
    dayEl.addEventListener('input', validateAndStyle);
    setTimeout(validateAndStyle, 50);
}

// ================================================================
//  کاربران سیستم
// ================================================================
const USERS = [
    { username: 'shatel', password: '123456',  role: 'user'  },
    { username: 'admin',  password: '3259060', role: 'admin' }
];

function doLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const errorEl = document.getElementById('loginError');

    const found = USERS.find(u => u.username === user && u.password === pass);
    if (found) {
        localStorage.setItem('fiber_logged_in', 'true');
        localStorage.setItem('fiber_user', found.username);
        localStorage.setItem('fiber_role', found.role);
        errorEl.classList.remove('show');
        showApp();
    } else {
        errorEl.classList.add('show');
        document.getElementById('loginPass').value = '';
    }
}

function logout() {
    localStorage.removeItem('fiber_logged_in');
    localStorage.removeItem('fiber_user');
    localStorage.removeItem('fiber_role');
    if (typeof stopHistoryTrap === 'function') stopHistoryTrap();
    showLogin();
}

function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appContainer').classList.remove('active');
    document.getElementById('headerUser').style.display = 'none';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginError').classList.remove('show');
}

function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appContainer').classList.add('active');
    document.getElementById('headerUser').style.display = 'flex';

    const currentUser = localStorage.getItem('fiber_user') || 'shatel';
    const currentRole = localStorage.getItem('fiber_role') || 'user';
    document.getElementById('userDisplay').textContent = '👤 ' + currentUser;

    // نمایش/مخفی کردن دکمه گزارش تجمیعی فقط برای ادمین
    const aggBtn = document.getElementById('dashAggregateBtn');
    if (aggBtn) aggBtn.style.display = (currentRole === 'admin') ? '' : 'none';

    initAllFieldHistories();
    if (!document.querySelector('#dropCabinets .cabinet-block')) addDropCabinet();
    if (!document.querySelector('#fusionCabinets .cabinet-block')) addFusionCabinet();
    if (!document.querySelector('#fatCabinets .cabinet-block')) addFatCabinet();
    if (!document.querySelector('#shootCabinets .cabinet-block')) addShootCabinet();
    if (!document.querySelector('#omranCabinets .cabinet-block')) addOmranCabinet();

    setupDateValidation('drop');
    setupDateValidation('fusion');
    setupDateValidation('fat');
    setupDateValidation('shoot');
    setupDateValidation('omran');
    bindActions();

    navigateTo('dashboard');
    history.pushState({ page: 'dashboard' }, '', window.location.pathname);
    if (typeof startHistoryTrap === 'function') startHistoryTrap();
}
