        function safeLocalStorageSet(key, value) {
            try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
        }

        function readReportStore() {
            try { return JSON.parse(localStorage.getItem(REPORT_STORE_KEY) || '[]'); } catch (e) { return []; }
        }

        function writeReportStore(items) {
            return safeLocalStorageSet(REPORT_STORE_KEY, JSON.stringify(items));
        }

        function createReportId() {
            return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        }

        function enrichReport(data, status = 'final') {
            const now = new Date().toISOString();
            return {
                ...data,
                id: data.id || createReportId(),
                status: data.status || status,
                createdAt: data.createdAt || now,
                updatedAt: now,
                schemaVersion: 2
            };
        }

        function persistReport(config, data, status = 'final') {
            const item = enrichReport(data, status);
            let store = readReportStore().filter(x => x.id !== item.id);
            store.push(item);
            store.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
            store = store.slice(0, 100);
            writeReportStore(store);
            safeLocalStorageSet(config.key, JSON.stringify(item));
            return item;
        }

        function scheduleAutosave(config) {
			if (suppressAutosave) return;
			if (autosaveTimer) return; // تایمر در حال اجراست؛ ریست نمی‌شود
			autosaveTimer = setTimeout(() => {
				autosaveTimer = null;
				try {
					const data = config.collect();
					if (!data.contractor && !data.reporter && !data.cabinets?.length) return;
					const item = enrichReport(data, 'draft');
					safeLocalStorageSet(DRAFT_PREFIX + config.reportType, JSON.stringify(item));
					showToast('پیش‌نویس ذخیره شد.', false);
				} catch (e) { console.warn('Autosave failed:', e); }
			}, 20000);
		}

        function generateFileName(reportType, dateStr, ext) {
            if (!dateStr) throw new Error('تاریخ گزارش ضروری است.');
            const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
            const englishDigits = '0123456789';
            let enDate = dateStr.replace(/[۰-۹]/g, function(m) {
                return englishDigits[persianDigits.indexOf(m)];
            });
            enDate = enDate.replace(/[^0-9/]/g, '');
            const parts = enDate.split('/');
            if (parts.length === 3) {
                const year = parts[0].padStart(4, '0');
                const month = parts[1].padStart(2, '0');
                const day = parts[2].padStart(2, '0');
                enDate = `${year}-${month}-${day}`;
            } else {
                throw new Error('فرمت تاریخ نامعتبر است.');
            }
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            const time = `${h}${min}${s}`;
            return `${reportType}_${enDate}-${time}.${ext}`;
        }

