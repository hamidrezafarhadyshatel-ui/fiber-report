const fusionConfig = {
    key: 'fusion_report_multi',
    reportName: 'گزارش فیوژن',
    reportType: 'fusion',
    containerId: 'fusionCabinets',
    dateIds: { year: 'fusionYear', month: 'fusionMonth', day: 'fusionDay' },
    contractorId: 'fusionContractor',
    reporterId: 'fusionReporter',
    validate: function() {
        const common = getCommonFields(this);
        return validateDate(this.dateIds.year, this.dateIds.month, this.dateIds.day) &&
            common.contractor !== '' && common.reporter !== '';
    },
    collect: function() {
        const common = getCommonFields(this);
        const cabinets = collectFusionCabinets();
        return { reportType: this.reportType, date: common.date, contractor: common.contractor,
            reporter: common.reporter, cabinets };
    },
    render: function(data) {
        if (data.date) {
            const parts = data.date.split('/');
            if (parts.length === 3) {
                document.getElementById(this.dateIds.year).value = parts[0];
                document.getElementById(this.dateIds.month).value = parseInt(parts[1]);
                document.getElementById(this.dateIds.day).value = parseInt(parts[2]);
            }
        }
        document.getElementById(this.contractorId).value = data.contractor || '';
        document.getElementById(this.reporterId).value = data.reporter || '';
        document.getElementById(this.containerId).innerHTML = '';
        data.cabinets.forEach(cab => addFusionCabinet(cab));
        updateFusionSummary();
        setTimeout(() => { document.getElementById(this.contractorId)?.focus(); }, 200);
    },
    prepareExcel: function(data) { return buildFusionExcelRows(data); },
    prepareCSV: function(data) { return buildFusionCSVRows(data); },
    formatText: function(data, type) { return buildFusionTextReport(data, type); },
    previewHTML: function(data) { return buildFusionPreviewHTML(data); },
    columnWidths: [
        { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 },
        { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
        { wch: 18 }, { wch: 18 }, { wch: 30 }
    ]
};

// ---- toggle status (team از باکس حذف شد؛ فقط boxName سینک می‌شود) ----
function toggleFusionStatus(btn, status) {
    const box = btn.closest('.fusion-box');
    if (!box) return;
    const previousStatus = box.querySelector('[data-fusion-status]')?.value || 'done';
    const previousFields = previousStatus === 'not_done' ? '.not-done-fields' : '.done-fields';
    const nextFields = status === 'not_done' ? '.not-done-fields' : '.done-fields';
    const fromName = box.querySelector(`${previousFields} [data-fusion="boxName"]`);
    const toName = box.querySelector(`${nextFields} [data-fusion="boxName"]`);
    if (fromName && toName) toName.value = fromName.value;
    const statusInput = box.querySelector('[data-fusion-status]');
    if (statusInput) statusInput.value = status;
    const doneFields = box.querySelector('.done-fields');
    const notDoneFields = box.querySelector('.not-done-fields');
    const reasonInput = box.querySelector('[data-fusion="reason"]');

    if (status === 'done') {
        box.classList.remove('not-done-mode');
        doneFields.style.display = '';
        notDoneFields.style.display = 'none';
        if (reasonInput) reasonInput.removeAttribute('required');
        const doneBtn = box.querySelector('.toggle-done');
        const notDoneBtn = box.querySelector('.toggle-not-done');
        if (doneBtn) { doneBtn.className = 'secondary toggle-done'; doneBtn.textContent = '✔ انجام‌شده'; }
        if (notDoneBtn) { notDoneBtn.className = 'danger toggle-not-done'; notDoneBtn.textContent = '✖ انجام‌نشده'; }
    } else {
        box.classList.add('not-done-mode');
        doneFields.style.display = 'none';
        notDoneFields.style.display = '';
        if (reasonInput) reasonInput.setAttribute('required', 'required');
        const doneBtn = box.querySelector('.toggle-done');
        const notDoneBtn = box.querySelector('.toggle-not-done');
        if (doneBtn) { doneBtn.className = 'secondary toggle-done'; doneBtn.textContent = '✔ انجام‌شده'; }
        if (notDoneBtn) { notDoneBtn.className = 'danger toggle-not-done'; notDoneBtn.textContent = '✖ انجام‌نشده'; }
    }
    updateFusionSummary();
}

// ---- collect (ساختار جدید: کابینت → تیم → باکس) ----
function collectFusionCabinets() {
    const cabinets = [];
    document.querySelectorAll('#fusionCabinets .cabinet-block').forEach(cabEl => {
        const cabinetNumber = cabEl.querySelector('.cabinet-number')?.value?.trim() || '';
        const province = cabEl.querySelector('.cabinet-province')?.value?.trim() || '';
        const city = cabEl.querySelector('.cabinet-city')?.value?.trim() || '';
        const region = cabEl.querySelector('.cabinet-region')?.value?.trim() || '';
        const teams = [];
        cabEl.querySelectorAll('.fusion-team').forEach(teamEl => {
            const teamName = teamEl.querySelector('.fusion-team-name')?.value?.trim() || '';
            const boxes = [];
            teamEl.querySelectorAll('.fusion-box').forEach(boxEl => {
                const status = boxEl.querySelector('[data-fusion-status]')?.value || 'done';
                const o = { status };
                if (status === 'done') {
                    boxEl.querySelectorAll('.done-fields [data-fusion]').forEach(x => {
                        o[x.dataset.fusion] = x.value.trim();
                    });
                } else {
                    boxEl.querySelectorAll('.not-done-fields [data-fusion]').forEach(x => {
                        o[x.dataset.fusion] = x.value.trim();
                    });
                }
                if (o.boxName) boxes.push(o);
            });
            if (teamName || boxes.length > 0) teams.push({ teamName, boxes });
        });
        if (cabinetNumber || teams.length > 0) {
            cabinets.push({ cabinetNumber, province, city, region, teams });
        }
    });
    return cabinets;
}

// ---- validation ----
function validateFusionBoxesInTeam(teamEl) {
    const boxEls = teamEl.querySelectorAll('.fusion-box');
    let hasError = false;
    let errorMsg = '';
    boxEls.forEach(box => {
        const status = box.querySelector('[data-fusion-status]')?.value || 'done';
        if (status === 'done') {
            const boxName = box.querySelector('.done-fields [data-fusion="boxName"]')?.value?.trim() || '';
            const fiberToPigtail = box.querySelector('.done-fields [data-fusion="fiberToPigtail"]')?.value?.trim() || '';
            const fiberToFiber = box.querySelector('.done-fields [data-fusion="fiberToFiber"]')?.value?.trim() || '';
            const splitter1x2 = box.querySelector('.done-fields [data-fusion="splitter1x2"]')?.value?.trim() || '';
            const splitter1x4 = box.querySelector('.done-fields [data-fusion="splitter1x4"]')?.value?.trim() || '';
            const splitter1x8 = box.querySelector('.done-fields [data-fusion="splitter1x8"]')?.value?.trim() || '';
            const splitter1x16 = box.querySelector('.done-fields [data-fusion="splitter1x16"]')?.value?.trim() || '';
            const adapterDuplex = box.querySelector('.done-fields [data-fusion="adapterDuplex"]')?.value?.trim() || '';
            const adapterSimplex = box.querySelector('.done-fields [data-fusion="adapterSimplex"]')?.value?.trim() || '';
            if (!boxName || !fiberToPigtail || !fiberToFiber ||
                !splitter1x2 || !splitter1x4 || !splitter1x8 || !splitter1x16 ||
                !adapterDuplex || !adapterSimplex) {
                hasError = true;
                errorMsg = 'باکس فیوژن انجام‌شده ناقص است: لطفاً ابتدا تمام فیلدهای اجباری را پر کنید.';
            }
        } else {
            const boxName = box.querySelector('.not-done-fields [data-fusion="boxName"]')?.value?.trim() || '';
            const reason = box.querySelector('.not-done-fields [data-fusion="reason"]')?.value?.trim() || '';
            if (!boxName || !reason) {
                hasError = true;
                errorMsg = 'باکس فیوژن انجام‌نشده ناقص است: لطفاً ابتدا تمام فیلدهای اجباری را پر کنید.';
            }
        }
    });
    return { ok: !hasError, message: errorMsg };
}

function validateFusionTeamsInCabinet(cabinetEl) {
    const teamEls = cabinetEl.querySelectorAll('.fusion-team');
    for (const team of teamEls) {
        const teamName = team.querySelector('.fusion-team-name')?.value?.trim() || '';
        if (!teamName) return { ok: false, message: 'نام تیم فیوژن را قبل از افزودن تیم یا کابینت جدید وارد کنید.' };
        const r = validateFusionBoxesInTeam(team);
        if (!r.ok) return r;
    }
    return { ok: true };
}

document.getElementById('fusionAddCabinet').addEventListener('click', function() {
    const container = document.getElementById('fusionCabinets');
    const lastCabinet = container.lastElementChild;
    if (lastCabinet) {
        const validation = validateFusionTeamsInCabinet(lastCabinet);
        if (!validation.ok) { showToast(validation.message, true); return; }
    }
    addFusionCabinet();
});

// ---- add cabinet / team / box ----
function addFusionCabinet(data) {
    const container = document.getElementById('fusionCabinets');
    const cabId = getNextCabinetId(container);
    const cabDiv = document.createElement('div');
    cabDiv.className = 'cabinet-block';
    cabDiv.dataset.cid = cabId;
    cabDiv.innerHTML = `
        <div class="cabinet-header"><strong>کابینت ${cabId}</strong>
            <div class="cabinet-actions"><button type="button" class="danger" onclick="this.closest('.cabinet-block').remove(); updateFusionSummary();">🗑️ حذف</button></div>
        </div>
        ${buildCabinetGridHTML(cabId, 'fusionCabinets')}
        <div class="fusion-teams-container"></div>
        <button type="button" class="secondary" onclick="
            const cab = this.closest('.cabinet-block');
            const validation = validateFusionTeamsInCabinet(cab);
            if (!validation.ok) { showToast(validation.message, true); return; }
            addFusionTeam(cab);
        " style="margin-top:8px;">＋ افزودن تیم</button>
    `;
    container.appendChild(cabDiv);
    bindCabinetSelectors(cabDiv, data, 'updateFusionSummary');
    if (data?.teams?.length) {
        data.teams.forEach(t => addFusionTeam(cabDiv, t));
    } else {
        addFusionTeam(cabDiv);
    }
    cabDiv.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input', updateFusionSummary));
    updateFusionSummary();
    const regionSel = cabDiv.querySelector('.cabinet-region');
    if (regionSel) setTimeout(() => { regionSel.focus();
        regionSel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
}

function addFusionTeam(cabinetEl, data) {
    const container = cabinetEl.querySelector('.fusion-teams-container');
    const teamDiv = document.createElement('div');
    teamDiv.className = 'fusion-team';
    teamDiv.innerHTML = `
        <div class="team-header"><strong>تیم</strong>
            <button type="button" class="danger" onclick="this.closest('.fusion-team').remove(); updateFusionSummary();">حذف</button>
        </div>
        <div class="fusion-team-row">
            <div class="field"><label>نام تیم <span class="required">*</span></label>
                <input class="fusion-team-name history-field" required value="${esc(data?.teamName||'')}" placeholder="نام تیم">
            </div>
        </div>
        <div class="fusion-boxes-container"></div>
        <button type="button" class="secondary" onclick="
            const team = this.closest('.fusion-team');
            const validation = validateFusionBoxesInTeam(team);
            if (!validation.ok) { showToast(validation.message, true); return; }
            addFusionBox(team);
        " style="margin-top:8px;">＋ افزودن باکس فیوژن</button>
    `;
    container.appendChild(teamDiv);
    const teamNameInput = teamDiv.querySelector('.fusion-team-name');
    if (teamNameInput) setupFieldHistory(teamNameInput, 'fusion_team_history');
    teamDiv.querySelectorAll('input, textarea').forEach(x => x.addEventListener('input', updateFusionSummary));
    if (data?.boxes?.length) {
        data.boxes.forEach(b => addFusionBox(teamDiv, b));
    } else {
        addFusionBox(teamDiv);
    }
    updateFusionSummary();
    if (teamNameInput) setTimeout(() => { teamNameInput.focus();
        teamNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
}

function addFusionBox(teamEl, data) {
    const container = teamEl.querySelector('.fusion-boxes-container');
    const status = data?.status || 'done';
    const boxDiv = document.createElement('div');
    boxDiv.className = 'fusion-box' + (status === 'not_done' ? ' not-done-mode' : '');
    boxDiv.innerHTML = `
        <div class="fusion-header">
            <strong>باکس فیوژن</strong>
            <div class="fusion-status-buttons">
                <button type="button" class="${status === 'done' ? 'secondary' : 'secondary'} toggle-done" onclick="toggleFusionStatus(this, 'done')">✔ انجام‌شده</button>
                <button type="button" class="${status === 'not_done' ? 'danger' : 'danger'} toggle-not-done" onclick="toggleFusionStatus(this, 'not_done')">✖ انجام‌نشده</button>
            </div>
            <button type="button" class="danger" onclick="this.closest('.fusion-box').remove(); updateFusionSummary();" style="font-size:12px; padding:4px 10px;">حذف</button>
        </div>
        <div class="not-done-warning">⚠️ این باکس انجام نشده ثبت می‌شود</div>
        <div class="done-fields" style="display:${status === 'done' ? '' : 'none'};">
            <div class="grid">
                <div class="field full"><label>نام باکس <span class="required">*</span></label><input data-fusion="boxName" required value="${esc(data?.boxName)}" placeholder="نام باکس"></div>
                <div class="field"><label>فیوژن تار به پیگتیل <span class="required">*</span></label><input data-fusion="fiberToPigtail" type="number" required value="${esc(data?.fiberToPigtail)}" placeholder="0"></div>
                <div class="field"><label>فیوژن تار به تار <span class="required">*</span></label><input data-fusion="fiberToFiber" type="number" required value="${esc(data?.fiberToFiber)}" placeholder="0"></div>
                <div class="field"><label>اسپلیتر 1×2 <span class="required">*</span></label><input data-fusion="splitter1x2" type="number" required value="${esc(data?.splitter1x2)}" placeholder="0"></div>
                <div class="field"><label>اسپلیتر 1×4 <span class="required">*</span></label><input data-fusion="splitter1x4" type="number" required value="${esc(data?.splitter1x4)}" placeholder="0"></div>
                <div class="field"><label>اسپلیتر 1×8 <span class="required">*</span></label><input data-fusion="splitter1x8" type="number" required value="${esc(data?.splitter1x8)}" placeholder="0"></div>
                <div class="field"><label>اسپلیتر 1×16 <span class="required">*</span></label><input data-fusion="splitter1x16" type="number" required value="${esc(data?.splitter1x16)}" placeholder="0"></div>
                <div class="field"><label>آداپتور Duplex <span class="required">*</span></label><input data-fusion="adapterDuplex" type="number" required value="${esc(data?.adapterDuplex)}" placeholder="0"></div>
                <div class="field"><label>آداپتور Simplex <span class="required">*</span></label><input data-fusion="adapterSimplex" type="number" required value="${esc(data?.adapterSimplex)}" placeholder="0"></div>
                <div class="field full"><label>توضیحات</label><textarea data-fusion="notes" placeholder="اختیاری">${esc(data?.notes)}</textarea></div>
            </div>
        </div>
        <div class="not-done-fields" style="display:${status === 'not_done' ? '' : 'none'};">
            <div class="grid">
                <div class="field full"><label>نام باکس <span class="required">*</span></label><input data-fusion="boxName" required value="${esc(data?.boxName)}" placeholder="نام باکس"></div>
                <div class="field full"><label>دلیل عدم اجرا <span class="required">*</span></label>
                    <textarea data-fusion="reason" required ${status === 'not_done' ? 'required' : ''} placeholder="دلیل">${esc(data?.reason)}</textarea>
                </div>
            </div>
        </div>
        <input type="hidden" data-fusion-status value="${status}">
    `;
    container.appendChild(boxDiv);
    boxDiv.querySelectorAll('input, select, textarea').forEach(x => x.addEventListener('input', updateFusionSummary));
    updateFusionSummary();
    const nameInput = boxDiv.querySelector(status === 'not_done'
        ? '.not-done-fields [data-fusion="boxName"]'
        : '.done-fields [data-fusion="boxName"]');
    if (nameInput) setTimeout(() => { nameInput.focus();
        nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
}

// ---- summary / totals ----
function updateFusionSummary() {
    const data = collectFusionCabinets();
    const allBoxes = [];
    data.forEach(c => c.teams.forEach(t => allBoxes.push(...t.boxes)));
    const totalBoxes = allBoxes.length;
    const el = document.getElementById('fusionSummary');
    if (!totalBoxes) { el.textContent = 'هنوز کابینتی اضافه نشده است.'; return; }
    const doneCount = allBoxes.filter(b => b.status !== 'not_done').length;
    const notDoneCount = totalBoxes - doneCount;
    const totalPigtail = allBoxes.filter(b => b.status !== 'not_done').reduce((a, b) => a +
        (parseFloat(b.fiberToPigtail) || 0), 0);
    el.innerHTML =
        `کابینت‌ها: <b>${data.length}</b>　| کل باکس‌ها: <b>${totalBoxes}</b> (انجام‌شده: <b>${doneCount}</b> | انجام‌نشده: <b>${notDoneCount}</b>)　| فیوژن تار به پیگتیل: <b>${totalPigtail}</b>　| فیوژن تار به تار: <b>${allBoxes.filter(b => b.status !== 'not_done').reduce((a, b) => a + (parseFloat(b.fiberToFiber) || 0), 0)}</b>　| مجموع فیوژن: <b>${totalPigtail + allBoxes.filter(b => b.status !== 'not_done').reduce((a, b) => a + (parseFloat(b.fiberToFiber) || 0), 0)}</b>`;
}

function calculateFusionTotals(data) {
    const totals = { totalFiberToPigtail: 0, totalFiberToFiber: 0, totalSplitter1x2: 0, totalSplitter1x4: 0,
        totalSplitter1x8: 0, totalSplitter1x16: 0, totalAdapterDuplex: 0, totalAdapterSimplex: 0 };
    data.cabinets.forEach(cab => {
        (cab.teams || []).forEach(team => {
            (team.boxes || []).filter(b => b.status !== 'not_done').forEach(b => {
                totals.totalFiberToPigtail += parseFloat(b.fiberToPigtail) || 0;
                totals.totalFiberToFiber += parseFloat(b.fiberToFiber) || 0;
                totals.totalSplitter1x2 += parseFloat(b.splitter1x2) || 0;
                totals.totalSplitter1x4 += parseFloat(b.splitter1x4) || 0;
                totals.totalSplitter1x8 += parseFloat(b.splitter1x8) || 0;
                totals.totalSplitter1x16 += parseFloat(b.splitter1x16) || 0;
                totals.totalAdapterDuplex += parseFloat(b.adapterDuplex) || 0;
                totals.totalAdapterSimplex += parseFloat(b.adapterSimplex) || 0;
            });
        });
    });
    totals.totalFusion = totals.totalFiberToPigtail + totals.totalFiberToFiber;
    return totals;
}

// ---- excel ----
function buildFusionExcelRows(data) {
    const allBoxes = [];
    data.cabinets.forEach(cab => {
        (cab.teams || []).forEach(team => {
            (team.boxes || []).forEach(b => {
                allBoxes.push({ ...b, team: team.teamName || '', cabinet: cab.cabinetNumber,
                    province: cab.province, city: cab.city, region: cab.region });
            });
        });
    });
    const doneBoxes = allBoxes.filter(b => b.status !== 'not_done');
    const notDoneBoxes = allBoxes.filter(b => b.status === 'not_done');
    const rows = [
        ['گزارش فیوژن', '', '', '', '', '', '', '', '', '', 'تاریخ', data.date, ''],
        ['پیمانکار', data.contractor, '', 'مسئول فیوژن', data.reporter],
        [],
        ['✅ باکس‌های انجام‌شده']
    ];
    let n = 1;
    if (doneBoxes.length) {
        rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'نام تیم', 'نام باکس',
            'فیوژن تار به پیگتیل', 'فیوژن تار به تار', 'اسپلیتر 1×2', 'اسپلیتر 1×4', 'اسپلیتر 1×8',
            'اسپلیتر 1×16', 'آداپتور Duplex', 'آداپتور Simplex', 'مجموع فیوژن', 'توضیحات']);
        doneBoxes.forEach(b => {
            rows.push([
                n++, data.date, b.cabinet || '', b.province || '', b.city || '',
                b.region || '', b.team || '', b.boxName || '',
                parseFloat(b.fiberToPigtail) || 0, parseFloat(b.fiberToFiber) || 0,
                parseFloat(b.splitter1x2) || 0, parseFloat(b.splitter1x4) || 0,
                parseFloat(b.splitter1x8) || 0, parseFloat(b.splitter1x16) || 0,
                parseFloat(b.adapterDuplex) || 0, parseFloat(b.adapterSimplex) || 0,
                (parseFloat(b.fiberToPigtail) || 0) + (parseFloat(b.fiberToFiber) || 0),
                b.notes || ''
            ]);
        });
    }
    if (doneBoxes.length) {
        const totals = calculateFusionTotals(data);
        rows.push([]);
        rows.push(['جمع کل (انجام‌شده)', '', '', '', '', '', '', '', totals.totalFiberToPigtail,
            totals.totalFiberToFiber, totals.totalSplitter1x2, totals.totalSplitter1x4,
            totals.totalSplitter1x8, totals.totalSplitter1x16, totals.totalAdapterDuplex,
            totals.totalAdapterSimplex, totals.totalFusion, '']);
    }
    if (notDoneBoxes.length) {
        rows.push([]);
        rows.push(['❌ باکس‌های انجام‌نشده']);
        rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'نام تیم', 'نام باکس',
            'دلیل عدم اجرا']);
        let m = 1;
        notDoneBoxes.forEach(b => {
            rows.push([
                m++, data.date, b.cabinet || '', b.province || '', b.city || '',
                b.region || '', b.team || '', b.boxName || '', b.reason || ''
            ]);
        });
    }
    return rows;
}

// ---- csv ----
function buildFusionCSVRows(data) {
    const allBoxes = [];
    data.cabinets.forEach(cab => {
        (cab.teams || []).forEach(team => {
            (team.boxes || []).forEach(b => {
                allBoxes.push({ ...b, team: team.teamName || '', cabinet: cab.cabinetNumber,
                    province: cab.province, city: cab.city, region: cab.region });
            });
        });
    });
    const doneBoxes = allBoxes.filter(b => b.status !== 'not_done');
    const notDoneBoxes = allBoxes.filter(b => b.status === 'not_done');
    const rows = [
        ['گزارش فیوژن', '', '', '', '', '', '', '', '', '', 'تاریخ', data.date],
        ['پیمانکار', data.contractor, '', 'مسئول فیوژن', data.reporter],
        [],
        ['✅ باکس‌های انجام‌شده'],
        ['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'نام تیم', 'نام باکس',
            'فیوژن تار به پیگتیل', 'فیوژن تار به تار', 'اسپلیتر 1×2', 'اسپلیتر 1×4', 'اسپلیتر 1×8',
            'اسپلیتر 1×16', 'آداپتور Duplex', 'آداپتور Simplex', 'مجموع فیوژن', 'توضیحات']
    ];
    let n = 1;
    doneBoxes.forEach(b => {
        rows.push([
            n++, data.date, b.cabinet || '', b.province || '', b.city || '',
            b.region || '', b.team || '', b.boxName || '',
            parseFloat(b.fiberToPigtail) || 0, parseFloat(b.fiberToFiber) || 0,
            parseFloat(b.splitter1x2) || 0, parseFloat(b.splitter1x4) || 0,
            parseFloat(b.splitter1x8) || 0, parseFloat(b.splitter1x16) || 0,
            parseFloat(b.adapterDuplex) || 0, parseFloat(b.adapterSimplex) || 0,
            (parseFloat(b.fiberToPigtail) || 0) + (parseFloat(b.fiberToFiber) || 0),
            b.notes || ''
        ]);
    });
    if (notDoneBoxes.length) {
        rows.push([]);
        rows.push(['❌ باکس‌های انجام‌نشده']);
        rows.push(['ردیف', 'تاریخ', 'کابینت', 'استان', 'شهر', 'منطقه', 'نام تیم', 'نام باکس',
            'دلیل عدم اجرا']);
        let m = 1;
        notDoneBoxes.forEach(b => {
            rows.push([
                m++, data.date, b.cabinet || '', b.province || '', b.city || '',
                b.region || '', b.team || '', b.boxName || '', b.reason || ''
            ]);
        });
    }
    return rows;
}

// ---- text ----
function buildFusionTextReport(data, type) {
    if (type === 'summary') {
        let text = 'گزارش روزانه فیوژن\n─────────────────────\n\n';
        text += `تاریخ: ${data.date}\nپیمانکار: ${data.contractor}\n${getReportLocationLines(data)}\n\n`;
        text += '─────────────────────\n📊 خلاصه گزارش (تفکیک کابینت)\n─────────────────────\n\n';
        data.cabinets.forEach((cab, idx) => {
            const allBoxes = [];
            (cab.teams || []).forEach(t => allBoxes.push(...t.boxes));
            const doneBoxes = allBoxes.filter(b => b.status !== 'not_done');
            const notDoneBoxes = allBoxes.filter(b => b.status === 'not_done');
            const cabTotals = calculateFusionTotals({ cabinets: [cab] });
            text += `کابینت ${cab.cabinetNumber || 'بدون شماره'} (منطقه ${cab.region || ''})\n`;
            text += `  ─────────────────────\n`;
            const cabMetrics = joinNonZeroMetrics([
                ['تعداد کل باکس‌ها', allBoxes.length, ''], ['انجام‌شده', doneBoxes.length, ''],
                ['انجام‌نشده', notDoneBoxes.length, ''],
                ['فیوژن تار به پیگتیل', cabTotals.totalFiberToPigtail, ''],
                ['فیوژن تار به تار', cabTotals.totalFiberToFiber, ''],
                ['مجموع فیوژن', cabTotals.totalFusion, ''],
                ['اسپلیتر 1×2', cabTotals.totalSplitter1x2, ''], ['اسپلیتر 1×4', cabTotals.totalSplitter1x4, ''],
                ['اسپلیتر 1×8', cabTotals.totalSplitter1x8, ''], ['اسپلیتر 1×16', cabTotals.totalSplitter1x16, ''],
                ['آداپتور Duplex', cabTotals.totalAdapterDuplex, ''], ['آداپتور Simplex', cabTotals.totalAdapterSimplex, '']
            ], '\n');
            if (cabMetrics) text += cabMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n';
            if (idx < data.cabinets.length - 1) text += '\n';
        });
        const totals = calculateFusionTotals(data);
        text += '\n─────────────────────\n📊 جمع نهایی کل گزارش\n─────────────────────\n\n';
        const totalMetrics = joinNonZeroMetrics([
            ['فیوژن تار به پیگتیل', totals.totalFiberToPigtail, ''], ['فیوژن تار به تار', totals.totalFiberToFiber, ''], ['مجموع فیوژن', totals.totalFusion, ''],
            ['اسپلیتر 1×2', totals.totalSplitter1x2, ''], ['اسپلیتر 1×4', totals.totalSplitter1x4, ''],
            ['اسپلیتر 1×8', totals.totalSplitter1x8, ''], ['اسپلیتر 1×16', totals.totalSplitter1x16, ''],
            ['آداپتور Duplex', totals.totalAdapterDuplex, ''], ['آداپتور Simplex', totals.totalAdapterSimplex, '']
        ], '\n');
        if (totalMetrics) text += totalMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n';
        return text;
    }

    let text = 'گزارش روزانه فیوژن\n─────────────────────\n\n';
    text += `تاریخ: ${data.date}\nپیمانکار: ${data.contractor}\n${getReportLocationLines(data)}\nمسئول فیوژن: ${data.reporter}\n\n`;
    data.cabinets.forEach((cab, cabIdx) => {
        const allBoxes = [];
        (cab.teams || []).forEach(t => allBoxes.push(...t.boxes));
        const cabTotals = calculateFusionTotals({ cabinets: [cab] });
        text += `─────────────────────\n📌 کابینت ${cab.cabinetNumber || 'بدون شماره'} (منطقه ${cab.region || ''})\n─────────────────────\n\n`;
        (cab.teams || []).forEach(team => {
            const teamBoxes = team.boxes || [];
            const doneBoxes = teamBoxes.filter(b => b.status !== 'not_done');
            const notDoneBoxes = teamBoxes.filter(b => b.status === 'not_done');
            if (teamBoxes.length === 0) return;
            if (doneBoxes.length) {
                text += `✅ تیم ${team.teamName || 'بدون نام'}:\n`;
                doneBoxes.forEach((b, idx) => {
                    text += `  ${idx+1}. باکس ${b.boxName || ''}\n`;
                    const boxMetrics = joinNonZeroMetrics([
                        ['فیوژن تار به پیگتیل', b.fiberToPigtail || 0, ''], ['تار به تار', b.fiberToFiber || 0, ''],
                        ['اسپلیتر 1×2', b.splitter1x2 || 0, ''], ['1×4', b.splitter1x4 || 0, ''],
                        ['1×8', b.splitter1x8 || 0, ''], ['1×16', b.splitter1x16 || 0, ''],
                        ['آداپتور Duplex', b.adapterDuplex || 0, ''], ['Simplex', b.adapterSimplex || 0, '']
                    ]);
                    if (boxMetrics) text += `     ${boxMetrics}\n`;
                    if (b.notes) text += `     توضیحات: ${b.notes}\n`;
                });
                const teamTotals = calculateFusionTotals({ cabinets: [{ teams: [{ boxes: doneBoxes }] }] });
                const teamSummary = joinNonZeroMetrics([
                    ['تار→پیگتیل', teamTotals.totalFiberToPigtail, ''], ['تار→تار', teamTotals.totalFiberToFiber, ''], ['مجموع فیوژن', teamTotals.totalFusion, ''],
                    ['1×2', teamTotals.totalSplitter1x2, ''], ['1×4', teamTotals.totalSplitter1x4, ''],
                    ['1×8', teamTotals.totalSplitter1x8, ''], ['1×16', teamTotals.totalSplitter1x16, ''],
                    ['Duplex', teamTotals.totalAdapterDuplex, ''], ['Simplex', teamTotals.totalAdapterSimplex, '']
                ]);
                if (teamSummary) text += `  جمع تیم: ${teamSummary}\n\n`;
            }
            if (notDoneBoxes.length) {
                text += `❌ باکس‌های انجام‌نشده (تیم ${team.teamName || 'بدون نام'}):\n`;
                notDoneBoxes.forEach((b, idx) => {
                    text += `  ${idx+1}. باکس ${b.boxName || ''} | دلیل: ${b.reason || 'نامشخص'}\n`;
                });
                text += '\n';
            }
        });
        const doneInCab = allBoxes.filter(b => b.status !== 'not_done');
        const notDoneInCab = allBoxes.filter(b => b.status === 'not_done');
        text += `📊 جمع کابینت: ${doneInCab.length} انجام‌شده، ${notDoneInCab.length} انجام‌نشده\n`;
        const cabSummary = joinNonZeroMetrics([
            ['تار→پیگتیل', cabTotals.totalFiberToPigtail, ''], ['تار→تار', cabTotals.totalFiberToFiber, ''], ['مجموع فیوژن', cabTotals.totalFusion, ''],
            ['1×2', cabTotals.totalSplitter1x2, ''], ['1×4', cabTotals.totalSplitter1x4, ''],
            ['1×8', cabTotals.totalSplitter1x8, ''], ['1×16', cabTotals.totalSplitter1x16, ''],
            ['Duplex', cabTotals.totalAdapterDuplex, ''], ['Simplex', cabTotals.totalAdapterSimplex, '']
        ]);
        if (cabSummary) text += `   ${cabSummary}\n`;
        if (cabIdx < data.cabinets.length - 1) text += '\n';
    });
    const totals = calculateFusionTotals(data);
    text += '\n─────────────────────\n📊 جمع نهایی کل گزارش\n─────────────────────\n\n';
    const totalMetrics = joinNonZeroMetrics([
        ['فیوژن تار به پیگتیل', totals.totalFiberToPigtail, ''], ['فیوژن تار به تار', totals.totalFiberToFiber, ''],
        ['مجموع فیوژن', totals.totalFusion, ''],
        ['اسپلیتر 1×2', totals.totalSplitter1x2, ''], ['اسپلیتر 1×4', totals.totalSplitter1x4, ''],
        ['اسپلیتر 1×8', totals.totalSplitter1x8, ''], ['اسپلیتر 1×16', totals.totalSplitter1x16, ''],
        ['آداپتور Duplex', totals.totalAdapterDuplex, ''], ['آداپتور Simplex', totals.totalAdapterSimplex, '']
    ], '\n');
    if (totalMetrics) text += totalMetrics.split('\n').map(line => `  ${line}`).join('\n') + '\n';
    return text;
}

// ---- preview ----
function buildFusionPreviewHTML(data) {
    const css = `
        *{box-sizing:border-box} body{font-family:Tahoma,Arial,sans-serif;background:#f4f7fb;color:#263238;margin:0;padding:24px;direction:rtl}
        .wrap{max-width:1250px;margin:auto;background:#fff;padding:28px;border-radius:14px;box-shadow:0 2px 14px #0001}
        h1{text-align:center;color:#1565c0;margin:0 0 8px}.meta{background:#eef4fa;padding:14px;border-radius:10px;line-height:2;margin:18px 0}
        .cab{border:1px solid #d8e2ec;border-radius:12px;margin:18px 0;overflow:hidden}.cab h2{margin:0;padding:11px 15px;background:#eaf2f9;color:#0d47a1;font-size:18px}
        .team,.item{margin:12px 16px;padding:12px;border-radius:9px;background:#fafcff;border:1px solid #e4ebf2}.team h3{margin:0 0 8px;color:#37474f}
        table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}th,td{border:1px solid #dfe6ed;padding:7px;text-align:right;vertical-align:top}th{background:#f0f4f8}
        .done{color:#2e7d32}.notdone{color:#c62828}.summary{background:#f8fafc;border:1px dashed #b0bec5;padding:12px;border-radius:9px;margin-top:14px}
        .cab-summary{background:#eef4fa;padding:8px 12px;border-radius:6px;margin:10px 0;font-weight:bold;border:1px solid #d8e2ec}
        .no-print{display:inline-block;margin:18px auto 0;padding:9px 20px;border:0;border-radius:8px;background:#1565c0;color:#fff;cursor:pointer}
        @media print{body{background:#fff;padding:0}.wrap{box-shadow:none;max-width:none}.no-print{display:none}}
    `;
    const escP = esc;
    let content = `<html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>پیش‌نمایش گزارش</title><style>${css}</style></head><body><div class="wrap">`;
    content += `<h1>${escP(data.reportType)} - پیش‌نمایش گزارش</h1>`;
    content += `<div class="meta"><b>تاریخ:</b> ${escP(data.date)} &nbsp;|&nbsp; <b>پیمانکار:</b> ${escP(data.contractor)} &nbsp;|&nbsp; <b>مسئول:</b> ${escP(data.reporter)}</div>`;

    let done = 0, notDone = 0, totalPigtail = 0, totalFiberToFiber = 0, totalSplitter = 0;
    let totalAdapterDuplex = 0, totalAdapterSimplex = 0;
    data.cabinets.forEach(c => {
        let cabDone = 0, cabNotDone = 0;
        let teamRows = '';
        (c.teams || []).forEach(t => {
            const boxes = t.boxes || [];
            const d = boxes.filter(b => b.status !== 'not_done');
            const n = boxes.filter(b => b.status === 'not_done');
            cabDone += d.length;
            cabNotDone += n.length;
            const dRows = d.map(b => {
                const p = parseFloat(b.fiberToPigtail) || 0, f = parseFloat(b.fiberToFiber) || 0;
                const s = (parseFloat(b.splitter1x2) || 0) + (parseFloat(b.splitter1x4) || 0) +
                    (parseFloat(b.splitter1x8) || 0) + (parseFloat(b.splitter1x16) || 0);
                totalPigtail += p; totalFiberToFiber += f; totalSplitter += s;
                totalAdapterDuplex += parseFloat(b.adapterDuplex) || 0;
                totalAdapterSimplex += parseFloat(b.adapterSimplex) || 0;
                return `<tr><td>${escP(b.boxName)}</td><td>${p}</td><td>${f}</td><td>${escP(b.splitter1x2)}</td><td>${escP(b.splitter1x4)}</td><td>${escP(b.splitter1x8)}</td><td>${escP(b.splitter1x16)}</td><td>${escP(b.adapterDuplex)}</td><td>${escP(b.adapterSimplex)}</td><td>${escP(b.notes)}</td></tr>`;
            }).join('');
            const nRows = n.map(b => `<tr><td>${escP(b.boxName)}</td><td>${escP(b.reason)}</td></tr>`).join('');
            if (dRows || nRows) {
                teamRows += `<div class="team"><h3>تیم: ${escP(t.teamName)}</h3>`;
                if (dRows) teamRows += `<h4 class="done">✅ انجام‌شده</h4><table><thead><tr><th>باکس</th><th>تار→پیگتیل</th><th>تار→تار</th><th>1×2</th><th>1×4</th><th>1×8</th><th>1×16</th><th>Duplex</th><th>Simplex</th><th>توضیحات</th></tr></thead><tbody>${dRows}</tbody></table>`;
                if (nRows) teamRows += `<h4 class="notdone">❌ انجام‌نشده</h4><table><thead><tr><th>باکس</th><th>دلیل</th></tr></thead><tbody>${nRows}</tbody></table>`;
                teamRows += `</div>`;
            }
        });
        done += cabDone;
        notDone += cabNotDone;
        const cabTotals = calculateFusionTotals({ cabinets: [c] });
        content += `<div class="cab"><h2>کابینت ${escP(c.cabinetNumber)} — ${escP(c.province)} / ${escP(c.city)} / منطقه ${escP(c.region)}</h2>`;
        content += teamRows;
        const cabPreviewSummary = joinNonZeroMetrics([
            ['تار→پیگتیل', cabTotals.totalFiberToPigtail, ''], ['تار→تار', cabTotals.totalFiberToFiber, ''],
            ['1×2', cabTotals.totalSplitter1x2, ''], ['1×4', cabTotals.totalSplitter1x4, ''],
            ['1×8', cabTotals.totalSplitter1x8, ''], ['1×16', cabTotals.totalSplitter1x16, ''],
            ['Duplex', cabTotals.totalAdapterDuplex, ''], ['Simplex', cabTotals.totalAdapterSimplex, '']
        ]);
        if (cabPreviewSummary) content += `<div class="cab-summary">📊 جمع کابینت: ${cabPreviewSummary}</div>`;
        content += `</div>`;
    });
    const finalPreviewSummary = joinNonZeroMetrics([
        ['انجام‌شده', done, ''], ['انجام‌نشده', notDone, ''], ['فیوژن تار→پیگتیل', totalPigtail, ''],
        ['تار→تار', totalFiberToFiber, ''],
        ['مجموع فیوژن', totalPigtail + totalFiberToFiber, ''], ['اسپلیترها', totalSplitter, ''],
        ['Duplex', totalAdapterDuplex, ''], ['Simplex', totalAdapterSimplex, '']
    ]);
    content += `<div class="summary"><b>خلاصه نهایی:</b> ${finalPreviewSummary}</div><button class="no-print" onclick="window.print()">🖨️ چاپ</button></div><script>setTimeout(()=>window.print(),700)<\/script></body></html>`;
    return content;
}