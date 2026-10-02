        function saveReport(config) {
            const validation = validateCurrentReport(config);
            if (!validation.ok) { showToast(validation.message, true); return; }
            const data = config.collect();
            try {
                const item = persistReport(config, data, 'final');
                safeLocalStorageSet(DRAFT_PREFIX + config.reportType, JSON.stringify(item));
                const fileName = generateFileName(config.reportType, data.date, 'json');
                const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json;charset=utf-8' });
                downloadBlob(blob, fileName);
                showToast('گزارش ذخیره شد.', false);
            } catch (e) { showToast('ذخیره‌سازی انجام نشد.', true); }
        }

        function loadReport(config) {
            try {
                const store = readReportStore().filter(x => x.reportType === config.reportType)
                    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
                if (!store.length) {
                    const raw = localStorage.getItem(config.key);
                    if (raw) {
                        try { const old = JSON.parse(raw); if (old.reportType === config.reportType) store.push(old); } catch (
                        _) {}
                    }
                }
                const draftRaw = localStorage.getItem(DRAFT_PREFIX + config.reportType);
                if (draftRaw) {
                    try {
                        const draft = JSON.parse(draftRaw);
                        if (!store.some(x => x.id === draft.id)) store.unshift({ ...draft, status: 'draft' });
                    } catch (_) {}
                }
                if (!store.length) { showToast('هیچ داده‌ای یافت نشد.', true); return; }
                const lines = store.slice(0, 30).map((x, i) => {
                    const state = x.status === 'draft' ? 'پیش‌نویس' : 'نهایی';
                    const cabinetCount = x.cabinets ? x.cabinets.length : 0;
                    let detail = '';
                    if (config.reportType === 'drop') {
                        const routes = x.cabinets.reduce((sum, c) => sum + (c.routes ? c.routes.length : 0), 0);
                        detail = ` | ${routes} مسیر`;
                    } else if (config.reportType === 'fusion') {
                        const boxes = x.cabinets.reduce((sum, c) => sum + (c.boxes ? c.boxes.length : 0), 0);
                        detail = ` | ${boxes} باکس`;
                    } else if (config.reportType === 'fat') {
                        const boxes = x.cabinets.reduce((sum, c) => sum + (c.teams ? c.teams.reduce((s, t) => s + t
                            .boxes.length, 0) : 0), 0);
                        detail = ` | ${boxes} باکس FAT`;
                    } else if (config.reportType === 'shoot') {
                        const routes = x.cabinets.reduce((sum, c) => sum + (c.teams ? c.teams.reduce((s, t) => s + t
                            .routes.length, 0) : 0), 0);
                        detail = ` | ${routes} مسیر شوت`;
                    } else if (config.reportType === 'omran') {
                        const items = x.cabinets.reduce((sum, c) => sum + (c.teams ? c.teams.reduce((s, t) => s + t
                            .items.length, 0) : 0), 0);
                        detail = ` | ${items} آیتم`;
                    }
                    return `${i + 1}) ${x.date || 'بدون تاریخ'} | ${x.contractor || 'بدون پیمانکار'} | ${cabinetCount} کابینت${detail} | ${state}`;
                });
                const answer = prompt('شماره گزارش موردنظر را وارد کنید:\n\n' + lines.join('\n') + '\n\nلغو = Cancel');
                if (answer === null) return;
                const index = parseInt(answer, 10) - 1;
                if (!Number.isInteger(index) || index < 0 || index >= Math.min(store.length, 30)) { showToast(
                        'شماره گزارش نامعتبر است.', true); return; }
                const data = store[index];
                const cabinetCount = data.cabinets ? data.cabinets.length : 0;
                if (!confirm(`گزارش انتخاب‌شده: ${data.date} | ${data.contractor} | ${cabinetCount} کابینت\nآیا ادامه می‌دهید?`))
                    return;
                const check = validateReportData(config, data);
                if (!check.ok) { showToast(check.message, true); return; }
                suppressAutosave = true;
                config.render(data);
                suppressAutosave = false;
                showToast(data.status === 'draft' ? 'پیش‌نویس بازیابی شد.' : 'گزارش بازیابی شد.', false);
            } catch (e) { suppressAutosave = false;
                showToast('خطا در بازیابی.', true); }
        }

        function importReport(config) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(ev) {
                    try {
                        let data = JSON.parse(ev.target.result);
                        if (!data.reportType) { showToast('فایل معتبر نیست.', true); return; }
                        if (data.reportType !== config.reportType) { showToast(
                                `نوع گزارش مطابقت ندارد.`, true); return; }
                        const check = validateReportData(config, data);
                        if (!check.ok) { showToast(check.message, true); return; }
                        const item = persistReport(config, data, 'final');
                        suppressAutosave = true;
                        config.render(data);
                        suppressAutosave = false;
                        showToast('فایل بارگذاری شد.', false);
                    } catch (err) { showToast('خطا در خواندن فایل.', true); }
                };
                reader.readAsText(file);
            };
            input.click();
        }

        function exportExcel(config) {
            const validation = validateCurrentReport(config); if (!validation.ok) { showToast(validation.message, true); return; }
            const data = config.collect();
            const rows = config.prepareExcel(data);
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = config.columnWidths || [];
            XLSX.utils.book_append_sheet(wb, ws, config.reportName);
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const fileName = generateFileName(config.reportType, data.date, 'xlsx');
            downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), fileName);
            showToast('خروجی Excel ساخته شد.', false);
        }

        function exportCSV(config) {
            const validation = validateCurrentReport(config); if (!validation.ok) { showToast(validation.message, true); return; }
            const data = config.collect();
            const rows = config.prepareCSV(data);
            const sep = ';';
            let csv = '\uFEFF';
            rows.forEach(row => { csv += row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(sep) + '\n'; });
            const fileName = generateFileName(config.reportType, data.date, 'csv');
            downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
            showToast('خروجی CSV ساخته شد.', false);
        }

        async function exportJSON(config) {
    const validation = validateCurrentReport(config);
    if (!validation.ok) { showToast(validation.message, true); return; }
    const data = config.collect();
    const fileName = generateFileName(config.reportType, data.date, 'json');
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

    // تلاش برای اشتراک‌گذاری از طریق منوی اندروید
    try {
        const file = new File([blob], fileName, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'گزارش ' + config.reportName,
                text: 'تاریخ: ' + data.date
            });
            return;
        }
    } catch (e) {
        if (e.name === 'AbortError') return; // کاربر انصراف داد
        console.warn('Share failed:', e);
    }

    // Fallback: اگه اشتراک‌گذاری ممکن نبود، دانلود کن
    downloadBlob(blob, fileName);
    showToast('خروجی JSON ساخته شد.', false);
}

        function generateTextReport(config, type) {
            const validation = validateCurrentReport(config); if (!validation.ok) { showToast(validation.message, true); return; }
            const data = config.collect();
            const text = config.formatText(data, type);
            navigator.clipboard.writeText(text).then(() => {
                showToast(`گزارش ${type==='summary'?'خلاصه':'کامل'} کپی شد.`, false);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                showToast(`گزارش ${type==='summary'?'خلاصه':'کامل'} کپی شد.`, false);
            });
        }

        function previewReport(config) {
            const validation = validateCurrentReport(config); if (!validation.ok) { showToast(validation.message, true); return; }
            const data = config.collect();
            const html = config.previewHTML(data);
            const w = window.open('', '_blank');
            if (!w) { showToast('پنجره مسدود شد.', true); return; }
            w.document.write(html);
            w.document.close();
        }

        function newReport(config) {
    if (!confirm('گزارش فعلی پاک شود؟')) return;
    suppressAutosave = true;
    try {
        const form = document.getElementById(config.reportType === 'drop' ? 'formDrop' : config.reportType ===
            'fusion' ? 'formFusion' : config.reportType === 'fat' ? 'formFat' : config.reportType === 'shoot' ?
            'formShoot' : 'formOmran');
        if (form) form.reset();
        const container = document.getElementById(config.containerId);
        if (container) container.innerHTML = '';
        if (config.reportType === 'drop') addDropCabinet();
        else if (config.reportType === 'fusion') addFusionCabinet();
        else if (config.reportType === 'fat') addFatCabinet();
        else if (config.reportType === 'shoot') addShootCabinet();
        else if (config.reportType === 'omran') addOmranCabinet();

        // پر کردن مجدد تاریخ شمسی امروز بعد از پاک‌سازی
        if (typeof fillTodayJalali === 'function') fillTodayJalali(config.reportType);

        localStorage.removeItem(DRAFT_PREFIX + config.reportType);
        showToast('گزارش جدید ایجاد شد.', false);
        setTimeout(() => { document.getElementById(config.contractorId)?.focus(); }, 200);
    } finally { suppressAutosave = false; }
        }

        // ================================================================
        //  بخش ۳: پیکربندی (Config) صفحات
        // ================================================================

        function getCommonFields(config) {
            const date = getDateStr(config.dateIds.year, config.dateIds.month, config.dateIds.day);
            const contractor = document.getElementById(config.contractorId).value.trim();
            const reporter = document.getElementById(config.reporterId).value.trim();
            return { date, contractor, reporter };
        }

        // ---- دراپ ----
