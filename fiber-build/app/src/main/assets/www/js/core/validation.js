/* ================================================================
   Central validation - V9
   Single source of truth for report data integrity.
   ================================================================ */

function normalizeDigits(value) {
    return String(value ?? '')
        .replace(/[۰-۹]/g, ch => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)])
        .replace(/[٠-٩]/g, ch => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(ch)]);
}

function isValidJalaliDateString(value) {
    const raw = normalizeDigits(value).trim();
    const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(raw);
    if (!m) return false;

    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
    if (year < 1300 || year > 1500) return false;
    if (month < 1 || month > 12 || day < 1) return false;

    const maxDay = month <= 6 ? 31 : month <= 11 ? 30 : (isJalaliLeapYear(year) ? 30 : 29);
    return day <= maxDay;
}

function isNonEmpty(value) {
    return String(value ?? '').trim() !== '';
}

function validStatus(status) {
    return status === undefined || status === null || status === '' || status === 'done' || status === 'not_done';
}

function validateCabinetIdentity(cab, seenCabinets) {
    if (!isNonEmpty(cab?.cabinetNumber))
        return { ok: false, message: 'شماره یکی از کابینت‌ها وارد نشده است.' };

    if (!isNonEmpty(cab?.province) || !isNonEmpty(cab?.city) || !isNonEmpty(cab?.region))
        return { ok: false, message: `اطلاعات استان، شهر یا منطقه کابینت ${cab.cabinetNumber} ناقص است.` };

    const cabinetNumber = normalizeDigits(cab.cabinetNumber).trim();
    const region = String(cab.region).trim();

    if (!/^\d+$/.test(cabinetNumber) || !isValidCabinetForRegion(cabinetNumber, region)) {
        return {
            ok: false,
            message: `شماره کابینت ${cab.cabinetNumber} با منطقه ${region} مطابقت ندارد.`
        };
    }

    const key = `${region}|${cabinetNumber}`;
    if (seenCabinets.has(key)) {
        return {
            ok: false,
            message: `کابینت ${cab.cabinetNumber} در منطقه ${region} بیش از یک بار ثبت شده است.`
        };
    }
    seenCabinets.add(key);
    return { ok: true };
}

function validateDropCabinet(cab) {
    if (!Array.isArray(cab.teams) || !cab.teams.length)
        return { ok: false, message: `برای کابینت ${cab.cabinetNumber} حداقل یک تیم دراپ ثبت کنید.` };

    for (const team of cab.teams) {
        if (!isNonEmpty(team.teamName))
            return { ok: false, message: `نام تیم دراپ در کابینت ${cab.cabinetNumber} وارد نشده است.` };
        if (!Array.isArray(team.routes) || !team.routes.length)
            return { ok: false, message: `برای تیم ${team.teamName} حداقل یک مسیر دراپ ثبت کنید.` };

        for (const route of team.routes) {
            if (!validStatus(route.status))
                return { ok: false, message: 'وضعیت یکی از مسیرهای دراپ نامعتبر است.' };
            if (!isNonEmpty(route.source) || !isNonEmpty(route.destination))
                return { ok: false, message: `اطلاعات مبدأ/مقصد دراپ کابینت ${cab.cabinetNumber} ناقص است.` };

            if (route.status === 'not_done') {
                if (!isNonEmpty(route.reason))
                    return { ok: false, message: 'برای مسیر انجام‌نشده دراپ، دلیل الزامی است.' };
            } else {
                if (!isNonEmpty(route.startCode) || !isNonEmpty(route.endCode) || !isNonEmpty(route.cableType))
                    return { ok: false, message: 'کد ابتدا، کد انتها و نوع کابل دراپ برای مسیر انجام‌شده الزامی است.' };
                if (!isNonEmpty(route.clamp) || !isNonEmpty(route.wire1) || !isNonEmpty(route.wire15))
                    return { ok: false, message: 'بست، مفتول ۱ و مفتول ۱.۵ برای مسیر انجام‌شده دراپ الزامی هستند.' };
            }
        }
    }
    return { ok: true };
}

function validateFusionCabinet(cab) {
    if (!Array.isArray(cab.teams) || !cab.teams.length)
        return { ok: false, message: `برای کابینت ${cab.cabinetNumber} حداقل یک تیم فیوژن ثبت کنید.` };

    const requiredFields = [
        ['fiberToPigtail', 'فیوژن تار به پیگتیل'],
        ['fiberToFiber', 'فیوژن تار به تار'],
        ['splitter1x2', 'اسپلیتر 1×2'],
        ['splitter1x4', 'اسپلیتر 1×4'],
        ['splitter1x8', 'اسپلیتر 1×8'],
        ['splitter1x16', 'اسپلیتر 1×16'],
        ['adapterDuplex', 'آداپتور Duplex'],
        ['adapterSimplex', 'آداپتور Simplex']
    ];

    for (const team of cab.teams) {
        if (!isNonEmpty(team.teamName))
            return { ok: false, message: `نام تیم فیوژن در کابینت ${cab.cabinetNumber} وارد نشده است.` };
        if (!Array.isArray(team.boxes) || !team.boxes.length)
            return { ok: false, message: `برای تیم ${team.teamName} حداقل یک باکس فیوژن ثبت کنید.` };

        for (const box of team.boxes) {
            if (!validStatus(box.status))
                return { ok: false, message: 'وضعیت یکی از باکس‌های فیوژن نامعتبر است.' };
            if (!isNonEmpty(box.boxName))
                return { ok: false, message: `نام باکس فیوژن کابینت ${cab.cabinetNumber} ناقص است.` };
            if (box.status === 'not_done') {
                if (!isNonEmpty(box.reason))
                    return { ok: false, message: 'برای باکس فیوژن انجام‌نشده، دلیل الزامی است.' };
            } else {
                for (const [key, label] of requiredFields) {
                    if (!isNonEmpty(box[key]))
                        return { ok: false, message: `فیلد «${label}» برای باکس فیوژن انجام‌شده الزامی است.` };
                }
            }
        }
    }
    return { ok: true };
}

function validateFatCabinet(cab) {
    if (!Array.isArray(cab.teams) || !cab.teams.length)
        return { ok: false, message: `برای کابینت ${cab.cabinetNumber} حداقل یک تیم FAT ثبت کنید.` };

    for (const team of cab.teams) {
        if (!isNonEmpty(team.teamName))
            return { ok: false, message: `نام تیم FAT در کابینت ${cab.cabinetNumber} وارد نشده است.` };
        if (!Array.isArray(team.boxes) || !team.boxes.length)
            return { ok: false, message: `برای تیم ${team.teamName} حداقل یک باکس FAT ثبت کنید.` };

        for (const box of team.boxes) {
            if (!isNonEmpty(box.code)) return { ok: false, message: 'کد باکس FAT الزامی است.' };
            if (!validStatus(box.status)) return { ok: false, message: 'وضعیت یکی از باکس‌های FAT نامعتبر است.' };
            if (box.status === 'not_done' && !isNonEmpty(box.reason))
                return { ok: false, message: 'برای باکس FAT نصب‌نشده، دلیل الزامی است.' };
        }
    }
    return { ok: true };
}

function validateShootCabinet(cab) {
    if (!Array.isArray(cab.teams) || !cab.teams.length)
        return { ok: false, message: `برای کابینت ${cab.cabinetNumber} حداقل یک تیم شوت ثبت کنید.` };

    for (const team of cab.teams) {
        if (!isNonEmpty(team.teamName))
            return { ok: false, message: `نام تیم شوت در کابینت ${cab.cabinetNumber} وارد نشده است.` };
        if (!Array.isArray(team.routes) || !team.routes.length)
            return { ok: false, message: `برای تیم ${team.teamName} حداقل یک مسیر شوت ثبت کنید.` };

        for (const route of team.routes) {
            if (!validStatus(route.status)) return { ok: false, message: 'وضعیت یکی از مسیرهای شوت نامعتبر است.' };
            if (!isNonEmpty(route.routeName) || !isNonEmpty(route.source))
                return { ok: false, message: `نام مسیر و مبدأ در شوت تیم ${team.teamName} الزامی است.` };
            if (!Array.isArray(route.destinations) || !route.destinations.some(isNonEmpty))
                return { ok: false, message: `حداقل یک مقصد برای مسیر ${route.routeName} وارد کنید.` };

            if (route.status === 'not_done') {
                if (!isNonEmpty(route.reason)) return { ok: false, message: 'برای مسیر شوت انجام‌نشده، دلیل الزامی است.' };
            } else if (!isNonEmpty(route.startCode) || !isNonEmpty(route.endCode) || !isNonEmpty(route.cableType)) {
                return { ok: false, message: `کدها و نوع کابل مسیر شوت ${route.routeName} الزامی است.` };
            }
        }
    }
    return { ok: true };
}

function validateOmranCabinet(cab) {
    if (!Array.isArray(cab.teams) || !cab.teams.length)
        return { ok: false, message: `برای کابینت ${cab.cabinetNumber} حداقل یک تیم عمران ثبت کنید.` };

    for (const team of cab.teams) {
        if (!isNonEmpty(team.teamName))
            return { ok: false, message: `نام تیم عمران در کابینت ${cab.cabinetNumber} وارد نشده است.` };
        if (!Array.isArray(team.items) || !team.items.length)
            return { ok: false, message: `برای تیم ${team.teamName} حداقل یک آیتم عمران ثبت کنید.` };

        for (const item of team.items) {
            if (!isNonEmpty(item.type)) return { ok: false, message: 'نوع عملیات عمران الزامی است.' };
            if (item.type === 'نصب هندهول' && !isNonEmpty(item.handholeName || item.description))
                return { ok: false, message: 'برای «نصب هندهول»، نام هندهول الزامی است.' };
            if (!validStatus(item.status)) return { ok: false, message: 'وضعیت یکی از آیتم‌های عمران نامعتبر است.' };
            if (item.status === 'not_done' && !isNonEmpty(item.reason))
                return { ok: false, message: 'برای آیتم عمران انجام‌نشده، توضیحات/دلیل عدم اجرا الزامی است.' };

            if (item.status === 'done' && item.type !== 'نصب کابینت' && item.type !== 'نصب هندهول' &&
                (item.value === '' || item.value === null || item.value === undefined || Number.isNaN(Number(item.value)))) {
                return { ok: false, message: `مقدار عملیات «${item.type}» وارد نشده یا نامعتبر است.` };
            }
            if ((item.type === 'نصب کابینت' || item.type === 'نصب هندهول') && Number(item.value) !== 1)
                return { ok: false, message: `مقدار عملیات «${item.type}» باید به صورت خودکار ۱ باشد.` };
        }
    }
    return { ok: true };
}

const REPORT_VALIDATORS = {
    drop: validateDropCabinet,
    fusion: validateFusionCabinet,
    fat: validateFatCabinet,
    shoot: validateShootCabinet,
    omran: validateOmranCabinet
};

function validateReportData(config, data) {
    if (!config || !config.reportType)
        return { ok: false, message: 'پیکربندی گزارش نامعتبر است.' };
    if (!data || typeof data !== 'object' || data.reportType !== config.reportType)
        return { ok: false, message: 'نوع گزارش نامعتبر است.' };
    if (!isValidJalaliDateString(data.date))
        return { ok: false, message: 'تاریخ گزارش نامعتبر است.' };
    if (!Array.isArray(data.cabinets) || !data.cabinets.length)
        return { ok: false, message: 'حداقل یک کابینت باید ثبت شود.' };
    if (!isNonEmpty(data.contractor)) return { ok: false, message: 'نام پیمانکار وارد نشده است.' };
    if (!isNonEmpty(data.reporter)) return { ok: false, message: 'نام مسئول گزارش وارد نشده است.' };

    const seenCabinets = new Set();
    const validator = REPORT_VALIDATORS[config.reportType];
    if (!validator) return { ok: false, message: `نوع گزارش «${config.reportType}» پشتیبانی نمی‌شود.` };

    for (const cabinet of data.cabinets) {
        const identity = validateCabinetIdentity(cabinet, seenCabinets);
        if (!identity.ok) return identity;
        const result = validator(cabinet);
        if (!result.ok) return result;
    }
    return { ok: true };
}

function validateCurrentReport(config) {
    const data = config.collect();
    if (!config.validate()) return { ok: false, message: 'تاریخ، پیمانکار یا مسئول گزارش کامل نیست.' };
    return validateReportData(config, data);
}
