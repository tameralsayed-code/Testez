const firebaseConfig = { 
    apiKey: "AIzaSyBv9f9VzWWLMn4P_z-U-TKwkJBNaNdbAYI", 
    authDomain: "production-ez.firebaseapp.com", 
    databaseURL: "https://production-ez-default-rtdb.firebaseio.com", 
    projectId: "production-ez", 
    storageBucket: "production-ez.firebasestorage.app", 
    messagingSenderId: "1066742430577", 
    appId: "1:1066742430577:web:c3d40baf0cefccebb8d4d0" 
};
firebase.initializeApp(firebaseConfig); 
const db = firebase.database(); 
const auth = firebase.auth();

const Hierarchy = [ 
    "مدير الإدارة", "مدير الورشة", "مدير درفلة 1", "مدير درفلة 2", "مهندس الوردية", 
    "ملاحظ الوردية", "قائم بأعمال الملاحظ", "مشغل غرفة التحكم الرئيسية", 
    "مشغل غرفة تحكم الفرن", "مشغل غرفة التحكم النهائية", "فني تمييز المنتج النهائي", 
    "فني درفلة المرحلة الإبتدائية", "فني درفلة المرحلة النهائية", "فني مراقبة سرير التبريد" 
];

const { createApp, ref, reactive, computed, onMounted, onUpdated, nextTick } = Vue;

const app = createApp({
    setup() {
        const isAdmin = ref(false); 
        const isDarkMode = ref(false);
        const isLoading = ref(true);
        const toasts = ref([]);

        const headerClickCount = ref(0);
        let headerClickTimer = null;
        
        const loginData = reactive({ username: '', password: '' });

        const view = ref('home');
        const shift = ref(null);
        const query = ref('');
        const modal = ref(null);
        const selectedUid = ref(null);
        const showRolling = ref(false);

        const employees = ref([]);
        const customContacts = ref([]);
        const announcementsList = ref([]);
        const newAnnouncement = ref('');

        const form = reactive({ uid: '', jobTitle: '', newJob: '', nameSelect: '', newName: '', code: '', phone: '', status: 'active', department: '', line: '1', shift: 'A' });

        const showToast = (text, type = 'info') => {
            const id = Date.now();
            toasts.value.push({ id, text, type });
            setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3000);
        };

        const updateIcons = () => { nextTick(() => { try { lucide.createIcons(); } catch(e){} }); };

        const toggleDarkMode = () => {
            isDarkMode.value = !isDarkMode.value;
            const themeMeta = document.getElementById('theme-color-meta');
            
            if (isDarkMode.value) { 
                document.documentElement.classList.add('dark'); 
                localStorage.setItem('theme', 'dark'); 
                if(themeMeta) themeMeta.setAttribute('content', '#0f172a');
            } 
            else { 
                document.documentElement.classList.remove('dark'); 
                localStorage.setItem('theme', 'light'); 
                if(themeMeta) themeMeta.setAttribute('content', '#3B82F6');
            }
            updateIcons();
        };

        const handleHeaderClick = () => {
            headerClickCount.value++;
            clearTimeout(headerClickTimer);
            
            headerClickTimer = setTimeout(() => {
                headerClickCount.value = 0;
            }, 1500);

            if (headerClickCount.value >= 5) {
                headerClickCount.value = 0;
                if (isAdmin.value) {
                    isAdmin.value = false;
                    showToast("تم تسجيل الخروج من وضع الإدارة 🔒", "info");
                } else {
                    openModal('login');
                }
            }
        };

        const handleLogin = () => {
            if (loginData.username === 'admin' && loginData.password === '1234') {
                isAdmin.value = true;
                closeModal();
                showToast("تم تفعيل صلاحيات الإدارة بنجاح 🔓", "success");
                loginData.username = ''; 
                loginData.password = '';
            } else {
                showToast("بيانات الدخول غير صحيحة ❌", "error");
            }
        };

        const headerTitle = computed(() => {
            if (query.value) return "البحث"; 
            if (view.value === 'dashboard') return "لوحة القيادة"; 
            if (shift.value === 'office') return "طاقم الإدارة"; 
            if (shift.value === 'broadcast') return "الإعلانات"; 
            if (shift.value) return `وردية ${shift.value}`; 
            if (view.value === 'management') return "إدارة الإنتاج"; 
            if (view.value === 'prep') return "ورشة التجهيزات"; 
            if (view.value === 'line1') return "خط درفلة 1"; 
            if (view.value === 'line2') return "خط درفلة 2"; 
            if (view.value === 'announcements') return "الإعلانات الداخلية"; 
            return "قسم الإنتاج"; 
        });

        // قائمة العرض تفلتر الموظفين بناءً على أماكنهم، الموظف (غير المعين) لن يظهر هنا
        const filteredEmployees = computed(() => {
            let filtered = employees.value.filter(e => {
                if (view.value === 'management') return e.department === 'management';
                if (view.value === 'announcements') return e.department === 'announcements';
                return e.shift === shift.value && (view.value === 'prep' ? e.department === 'prep' : e.line === view.value.replace('line', ''));
            });
            if (view.value === 'management') filtered.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            return filtered;
        });

        const searchResults = computed(() => {
            let q = query.value.toLowerCase(); 
            return employees.value.filter(e => (e.name && e.name.toLowerCase().includes(q)) || (e.code && e.code.toString().includes(q)));
        });

        const activeCount = computed(() => filteredEmployees.value.filter(e => e.status !== 'sick').length);
        const sickCount = computed(() => filteredEmployees.value.filter(e => e.status === 'sick').length);
        
        // إحصائيات الموظفين النشطين في الشركة (نستبعد غير المعينين من إجمالي القوة العاملة)
        const activeCompanyEmployees = computed(() => employees.value.filter(e => e.department !== 'unassigned'));
        const sickEmployeesCount = computed(() => activeCompanyEmployees.value.filter(e => e.status === 'sick').length);
        
        const deptTotalCount = computed(() => employees.value.filter(e => (view.value === 'prep' && e.department === 'prep') || (view.value.startsWith('line') && e.line === view.value.replace('line', ''))).length);
        const deptActiveCount = computed(() => employees.value.filter(e => e.status !== 'sick' && ((view.value === 'prep' && e.department === 'prep') || (view.value.startsWith('line') && e.line === view.value.replace('line', '')))).length);
        const deptSickCount = computed(() => employees.value.filter(e => e.status === 'sick' && ((view.value === 'prep' && e.department === 'prep') || (view.value.startsWith('line') && e.line === view.value.replace('line', '')))).length);

        const latestAnnouncement = computed(() => announcementsList.value.length > 0 ? announcementsList.value[0] : null);
        const selectedEmployee = computed(() => employees.value.find(x => x.uid === selectedUid.value));

        const liveShift = computed(() => {
            const now = new Date(); const hour = now.getHours(); 
            let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); 
            let dutyType = (hour >= 8 && hour < 16) ? 'morning' : (hour >= 16 && hour < 24) ? 'noon' : 'evening'; 
            if (hour < 8) targetDate.setDate(targetDate.getDate() - 1); 
            let activeG = '-'; 
            for (let g of ['A', 'B', 'C', 'D']) { if (getGroupStatus(g, targetDate).type === dutyType) { activeG = g; break; } } 
            return { group: activeG, name: dutyType === 'morning' ? 'الأولى' : dutyType === 'noon' ? 'الثانية' : 'الثالثة', targetDate };
        });

        const availableJobs = computed(() => {
            const jobs = [...new Set([...Hierarchy, ...customContacts.value.map(i => i.job), ...employees.value.map(i => i.jobTitle)])].filter(Boolean);
            return jobs.sort((a, b) => { const indexA = Hierarchy.indexOf(a); const indexB = Hierarchy.indexOf(b); if (indexA === -1 && indexB === -1) return a.localeCompare(b, 'ar'); if (indexA === -1) return 1; if (indexB === -1) return -1; return indexA - indexB; });
        });

        const availableNames = computed(() => {
            if (!form.jobTitle || form.jobTitle === '__NEW_JOB__') return []; 
            const namesFromContacts = customContacts.value.filter(i => i.job === form.jobTitle).map(i => i.name);
            const namesFromEmployees = employees.value.filter(i => i.jobTitle === form.jobTitle).map(i => i.name);
            return [...new Set([...namesFromContacts, ...namesFromEmployees])].sort();
        });

        const availableSubstitutes = computed(() => {
            if(!selectedEmployee.value) return []; 
            // إظهار البدلاء من الموظفين المعينين فقط
            let raw = employees.value.filter(x => x.jobTitle === selectedEmployee.value.jobTitle && x.uid !== selectedUid.value && x.department !== 'unassigned'); 
            raw.sort((a, b) => (b.line === selectedEmployee.value.line ? 1 : 0) - (a.line === selectedEmployee.value.line ? 1 : 0)); 
            const unique = []; const seen = new Set(); 
            for (const sub of raw) { if (!seen.has(sub.name)) { seen.add(sub.name); unique.push(sub); } } 
            return unique;
        });

        const getGroupStatus = (group, date) => {
            const startDate = new Date(2025, 0, 1); const diff = Math.round((date - startDate) / 86400000); 
            const initialStatuses = { 'A': { type: 'evening', day: 3 }, 'B': { type: 'morning-rest', day: 1 }, 'C': { type: 'noon', day: 5 }, 'D': { type: 'morning', day: 1 } }; 
            let { type, day } = initialStatuses[group]; const remain = diff % 20;
            for (let i = 0; i < remain; i++) { 
                day++; 
                switch (type) { 
                    case 'morning': if (day > 5) { type='morning-rest'; day=1; } break; 
                    case 'morning-rest': if (day > 1) { type='noon'; day=1; } break; 
                    case 'noon': if (day > 5) { type='noon-rest'; day=1; } break; 
                    case 'noon-rest': if (day > 2) { type='evening'; day=1; } break; 
                    case 'evening': if (day > 5) { type='evening-rest'; day=1; } break; 
                    case 'evening-rest': if (day > 2) { type='morning'; day=1; } break; 
                } 
            } 
            return { type, day };
        };

        const pushState = () => { history.pushState({ view: view.value, shift: shift.value, query: query.value, modal: modal.value, uid: selectedUid.value }, ""); updateIcons(); };
        const navigate = (v) => { view.value = v; shift.value = (v === 'management' ? 'office' : v === 'announcements' ? 'broadcast' : null); query.value = ''; modal.value = null; pushState(); if(v === 'dashboard') setTimeout(() => initCharts(), 100); };
        const navigateShift = (s) => { shift.value = s; modal.value = null; pushState(); };
        const count = (dept, line = null) => employees.value.filter(e => line ? e.department === dept && e.line === line : e.department === dept).length;
        const getDeptName = (e) => e.department === 'unassigned' ? 'غير معين بوردية' : (e.department === 'management' ? 'إدارة الإنتاج' : (e.department === 'prep' ? 'ورشة التجهيزات' : (e.department === 'announcements' ? 'الإعلانات' : `خط درفلة ${e.line}`)));
        const cleanPhone = (p) => { let c = p.replace(/\D/g, ''); return c.startsWith('0') ? '20' + c.substring(1) : (c.startsWith('1') ? '20' + c : c); };
        const getShiftCardClass = (s) => { const status = getGroupStatus(s, liveShift.value.targetDate); if(s === liveShift.value.group) return 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800/50'; if(status.type.includes('rest')) return 'from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 border-rose-200 dark:border-rose-800/50'; return 'from-gray-50 to-slate-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'; };
        const getShiftIconClass = (s) => { const status = getGroupStatus(s, liveShift.value.targetDate); if(s === liveShift.value.group) return 'bg-gradient-to-br from-emerald-500 to-teal-500'; if(status.type.includes('rest')) return 'bg-gradient-to-br from-rose-500 to-red-500'; return 'bg-gradient-to-br from-gray-400 to-slate-500 dark:from-slate-600 dark:to-slate-700'; };
        const getShiftTextClass = (s) => { const status = getGroupStatus(s, liveShift.value.targetDate); if(s === liveShift.value.group) return 'text-emerald-600 dark:text-emerald-400'; if(status.type.includes('rest')) return 'text-rose-600 dark:text-rose-400'; return 'text-gray-500 dark:text-gray-400'; };
        const getShiftName = (s) => { const status = getGroupStatus(s, liveShift.value.targetDate); const typeMap = { 'morning':'الوردية الأولى', 'noon':'الوردية الثانية', 'evening':'الوردية الثالثة', 'morning-rest':'راحة', 'noon-rest':'راحة', 'evening-rest':'راحة' }; return typeMap[status.type] || 'خارج الدوام'; };

        const openModal = (type, uid = null) => { 
            modal.value = type; selectedUid.value = uid; 
            if (type === 'form') { 
                let dept = (view.value === 'management' ? 'management' : (view.value === 'prep' ? 'prep' : (view.value === 'announcements' ? 'announcements' : 'rolling'))); 
                let line = view.value.startsWith('line') ? view.value.replace('line', '') : '1'; 
                let shiftVal = (shift.value && !['office','broadcast'].includes(shift.value)) ? shift.value : 'A'; 
                if (uid) { 
                    let e = employees.value.find(x => x.uid === uid); 
                    if (e) { Object.assign(form, { uid: e.uid, jobTitle: e.jobTitle, newJob: '', nameSelect: e.name, newName: '', code: e.code || '', phone: e.phone || '', status: e.status || 'active', department: e.department, line: e.line, shift: ['A','B','C','D'].includes(e.shift) ? e.shift : 'A' }); } 
                } else { 
                    Object.assign(form, { uid: '', jobTitle: '', newJob: '', nameSelect: '', newName: '', code: '', phone: '', status: 'active', department: dept, line: line, shift: shiftVal }); 
                } 
            } 
            pushState(); 
        };
        const closeModal = () => { if(modal.value !== null) window.history.back(); };
        const openDetails = (uid) => openModal('details', uid);
        const showSubstitutes = (uid) => openModal('substitutes', uid);
        
        const onJobSelect = () => { if (form.jobTitle === '__NEW_JOB__') { form.nameSelect = '__NEW__'; } else { form.nameSelect = ''; form.code = ''; form.phone = ''; form.uid = ''; } };
        
        // 🔴 تعديل ذكي: عند اختيار اسم من القائمة المنسدلة، نمسك الـ UID الخاص به لكي ننقله ولا نكرره
        const onNameSelect = () => { 
            if (form.nameSelect !== '__NEW__' && form.nameSelect !== '') { 
                let personData = employees.value.find(i => i.name === form.nameSelect); 
                if (!personData) { personData = customContacts.value.find(i => i.name === form.nameSelect); }
                
                if (personData) { 
                    form.code = personData.code || ''; 
                    form.phone = personData.phone || ''; 
                    form.uid = personData.uid || ''; // احتفظ بالمعرف
                } else { 
                    form.code = ''; form.phone = ''; form.uid = '';
                }
            } else { 
                form.code = ''; form.phone = ''; form.uid = '';
            }
        };

        const publishAnnouncement = () => {
            if(!newAnnouncement.value.trim()) return showToast("اكتب نص الإعلان أولاً", "error");
            const ann = { id: "ANN-" + Date.now(), text: newAnnouncement.value.trim(), date: new Date().toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), timestamp: Date.now() };
            db.ref('announcements/' + ann.id).set(ann).then(() => { newAnnouncement.value = ''; showToast("تم نشر الإعلان للجميع", "success"); });
        };
        const deleteAnnouncement = (id) => { if(confirm("مسح الإعلان؟")) db.ref('announcements/' + id).remove(); };

        const saveEmployee = () => { 
            let finalName = form.nameSelect === '__NEW__' ? form.newName.trim() : form.nameSelect; 
            let finalJob = form.jobTitle === '__NEW_JOB__' ? form.newJob.trim() : form.jobTitle; 
            if (!finalName || !finalJob) return showToast("يرجى استكمال البيانات", "error"); 
            if (form.nameSelect === '__NEW__') { db.ref('contacts/' + finalName.replace(/[.#$[\]]/g, "")).set({ job: finalJob, name: finalName, code: form.code, phone: form.phone }); } 
            
            // إذا كان الموظف موجوداً مسبقاً سيتم استخدام الـ UID الخاص به ونقله، وإلا سيتم إنشاء واحد جديد
            let uid = form.uid || "ID-" + Date.now(); 
            let jobIdx = Hierarchy.indexOf(finalJob); 
            let emp = { uid: uid, name: finalName, code: form.code, jobTitle: finalJob, department: form.department, line: form.department === 'rolling' ? form.line : 'none', shift: form.department === 'management' ? 'office' : (form.department === 'announcements' ? 'broadcast' : form.shift), phone: form.phone, status: form.status, sortOrder: jobIdx !== -1 ? jobIdx * 100 : 99999 }; 
            
            db.ref('employees/' + uid).set(emp).then(() => { showToast("تم الحفظ وتعيين الموظف بنجاح", "success"); closeModal(); }); 
        };
        
        // 🔴 التعديل الأهم (نظام إخلاء الطرف / سحب الموظف) 🔴
        const deleteEmployee = (uid) => { 
            if (confirm('هل تريد إزالة هذا الموظف من مكانه الحالي؟ (سيبقى محفوظاً في النظام ومتاحاً للإضافة لأي وردية أخرى لاحقاً)')) { 
                db.ref('employees/' + uid).update({
                    department: 'unassigned', // جعله غير معين بأي قسم
                    shift: 'none',            // سحب الوردية
                    line: 'none'              // سحب الخط
                }).then(() => {
                    closeModal();
                    showToast("تم إخلاء طرف الموظف، وهو متاح للتعيين في مكان آخر", "success");
                }).catch(err => {
                    showToast("حدث خطأ أثناء الاتصال", "error");
                });
            } 
        };
        // ----------------------------------------------------

        const moveEmployee = (uid, direction) => { 
            if (view.value !== 'management') return; 
            let filtered = employees.value.filter(e => e.department === 'management').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)); 
            const idx = filtered.findIndex(e => e.uid === uid); if (idx < 0) return; 
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1; if (targetIdx < 0 || targetIdx >= filtered.length) return; 
            filtered.forEach((e, i) => e.sortOrder = i * 10); 
            let temp = filtered[idx].sortOrder; filtered[idx].sortOrder = filtered[targetIdx].sortOrder; filtered[targetIdx].sortOrder = temp; 
            filtered.forEach(e => db.ref(`employees/${e.uid}`).update({ sortOrder: e.sortOrder })); 
        };

        const initCharts = () => {
            if(window.chartInstances) { Object.values(window.chartInstances).forEach(c => c?.destroy()); } else { window.chartInstances = {}; }
            const textColor = isDarkMode.value ? '#f1f5f9' : '#1F2937'; const gridColor = isDarkMode.value ? '#334155' : '#E2E8F0';
            const activeColor = '#10B981'; const sickColor = '#F43F5E';
            
            // في الرسوم البيانية، نستخدم فقط الموظفين المعينين في الشركة (نستبعد غير المعينين)
            const chartsData = employees.value.filter(e => e.department !== 'unassigned');
            
            const active = chartsData.filter(e => e.status !== 'sick').length; 
            const sick = chartsData.filter(e => e.status === 'sick').length;
            
            if(document.getElementById('statusChart')) { window.chartInstances.status = new Chart(document.getElementById('statusChart'), { type: 'doughnut', data: { labels: ['متواجد', 'إجازة'], datasets: [{ data: [active, sick], backgroundColor: [activeColor, sickColor], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Tajawal' } } }, tooltip: { callbacks: { label: function(context) { return ' ' + context.label + ': ' + Number(context.raw).toString(); } } } }, cutout: '70%' } }); }
            
            let rolesSet = new Set();
            chartsData.forEach(e => { if(e.jobTitle) rolesSet.add(e.jobTitle); });
            let rolesLabels = Array.from(rolesSet);
            rolesLabels.sort((a, b) => { let idxA = Hierarchy.indexOf(a); let idxB = Hierarchy.indexOf(b); if (idxA === -1 && idxB === -1) return a.localeCompare(b, 'ar'); if (idxA === -1) return 1; if (idxB === -1) return -1; return idxA - idxB; });

            let rolesActiveData = rolesLabels.map(role => chartsData.filter(e => e.jobTitle === role && e.status !== 'sick').length);
            let rolesSickData = rolesLabels.map(role => chartsData.filter(e => e.jobTitle === role && e.status === 'sick').length);
            
            if(document.getElementById('rolesChart')) { 
                window.chartInstances.roles = new Chart(document.getElementById('rolesChart'), { 
                    type: 'bar', 
                    data: { 
                        labels: rolesLabels, 
                        datasets: [
                            { label: 'نشط', data: rolesActiveData, backgroundColor: activeColor, borderRadius: 4 },
                            { label: 'مرضي', data: rolesSickData, backgroundColor: sickColor, borderRadius: 4 }
                        ] 
                    }, 
                    options: { 
                        indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
                        interaction: { mode: 'index', intersect: false },
                        scales: { 
                            x: { stacked: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, callback: function(val) { return Number(val).toString(); } } }, 
                            y: { stacked: true, grid: { display: false }, ticks: { color: textColor, font: { family: 'Tajawal', weight: 'bold', size: 10 } } } 
                        }, 
                        plugins: { 
                            legend: { display: true, position: 'bottom', labels: { color: textColor, font: { family: 'Tajawal' } } },
                            tooltip: { callbacks: { label: function(context) { return ' ' + context.dataset.label + ': ' + Number(context.raw).toString(); } } }
                        } 
                    } 
                }); 
            }
            
            const shiftConfigs = [
                { label: 'A - درفلة 1', f: e => e.shift==='A' && e.department==='rolling' && e.line==='1' },
                { label: 'B - درفلة 1', f: e => e.shift==='B' && e.department==='rolling' && e.line==='1' },
                { label: 'C - درفلة 1', f: e => e.shift==='C' && e.department==='rolling' && e.line==='1' },
                { label: 'D - درفلة 1', f: e => e.shift==='D' && e.department==='rolling' && e.line==='1' },
                { label: 'A - درفلة 2', f: e => e.shift==='A' && e.department==='rolling' && e.line==='2' },
                { label: 'B - درفلة 2', f: e => e.shift==='B' && e.department==='rolling' && e.line==='2' },
                { label: 'C - درفلة 2', f: e => e.shift==='C' && e.department==='rolling' && e.line==='2' },
                { label: 'D - درفلة 2', f: e => e.shift==='D' && e.department==='rolling' && e.line==='2' },
                { label: 'A - تجهيزات', f: e => e.shift==='A' && e.department==='prep' },
                { label: 'B - تجهيزات', f: e => e.shift==='B' && e.department==='prep' },
                { label: 'C - تجهيزات', f: e => e.shift==='C' && e.department==='prep' },
                { label: 'D - تجهيزات', f: e => e.shift==='D' && e.department==='prep' },
                { label: 'الإدارة (Office)', f: e => e.department==='management' }
            ];

            let activeShifts = shiftConfigs.filter(c => chartsData.filter(c.f).length > 0);
            let shiftLabels = activeShifts.map(c => c.label);
            let shiftActiveData = activeShifts.map(c => chartsData.filter(e => c.f(e) && e.status !== 'sick').length);
            let shiftSickData = activeShifts.map(c => chartsData.filter(e => c.f(e) && e.status === 'sick').length);

            if(document.getElementById('shiftDistChart')) { 
                window.chartInstances.shiftDist = new Chart(document.getElementById('shiftDistChart'), { 
                    type: 'bar', 
                    data: { 
                        labels: shiftLabels, 
                        datasets: [
                            { label: 'نشط', data: shiftActiveData, backgroundColor: activeColor, borderRadius: 4 },
                            { label: 'مرضي', data: shiftSickData, backgroundColor: sickColor, borderRadius: 4 }
                        ] 
                    }, 
                    options: { 
                        indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
                        interaction: { mode: 'index', intersect: false },
                        scales: { 
                            x: { stacked: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, callback: function(val) { return Number(val).toString(); } } }, 
                            y: { stacked: true, grid: { display: false }, ticks: { color: textColor, font: { family: 'Tajawal', weight: 'bold', size: 10 } } } 
                        }, 
                        plugins: { 
                            legend: { display: true, position: 'bottom', labels: { color: textColor, font: { family: 'Tajawal' } } },
                            tooltip: { callbacks: { label: function(context) { return ' ' + context.dataset.label + ': ' + Number(context.raw).toString(); } } }
                        } 
                    } 
                }); 
            }
        };

        onMounted(() => {
            if(localStorage.getItem('theme') === 'dark') { isDarkMode.value = true; document.documentElement.classList.add('dark'); document.getElementById('theme-color-meta').setAttribute('content', '#0f172a'); }
            
            window.addEventListener('popstate', (e) => {
                if (e.state) { view.value = e.state.view || 'home'; shift.value = e.state.shift || null; query.value = e.state.query || ''; modal.value = e.state.modal || null; selectedUid.value = e.state.uid || null; if(view.value === 'home') showRolling.value = false; } 
                else { view.value = 'home'; shift.value = null; query.value = ''; modal.value = null; showRolling.value = false; }
                updateIcons(); if(view.value === 'dashboard') setTimeout(() => initCharts(), 100);
            });

            const cachedEmployees = localStorage.getItem('offline_employees');
            if (cachedEmployees) { 
                employees.value = JSON.parse(cachedEmployees); 
                isLoading.value = false; 
            }

            const cachedContacts = localStorage.getItem('offline_contacts');
            if (cachedContacts) { customContacts.value = JSON.parse(cachedContacts); }

            const cachedAnnouncements = localStorage.getItem('offline_announcements');
            if (cachedAnnouncements) { announcementsList.value = JSON.parse(cachedAnnouncements); }

            if (cachedEmployees && view.value === 'dashboard') { setTimeout(() => initCharts(), 100); }

            // 🟢 مراقبة الاتصال بالإنترنت 🟢
            let isFirstLoad = true;
            db.ref('.info/connected').on('value', function(snap) {
                if (snap.val() === true) {
                    if (!isFirstLoad) showToast("تمت استعادة الاتصال بالإنترنت 🟢", "success");
                    isFirstLoad = false;
                } else {
                    if (!isFirstLoad) {
                        setTimeout(() => { showToast("أنت الآن في وضع عدم الاتصال (أوفلاين) 🔴", "error"); }, 1500);
                    }
                }
            });

            auth.signInAnonymously().then(() => {
                // 🟢 استرجاع الموظفين بشكله الأصلي والاعتماد على حالة "unassigned" في الفلترة
                db.ref('employees').on('value', (s) => { 
                    const d = s.val(); 
                    
                    employees.value = d ? Object.values(d).sort((a, b) => { 
                        if (a.department === 'management' && b.department === 'management') return (a.sortOrder || 0) - (b.sortOrder || 0); 
                        const idxA = Hierarchy.indexOf(a.jobTitle); 
                        const idxB = Hierarchy.indexOf(b.jobTitle); 
                        if (idxA !== idxB) return idxA - idxB; 
                        return (a.sortOrder || 0) - (b.sortOrder || 0); 
                    }) : []; 
                    
                    localStorage.setItem('offline_employees', JSON.stringify(employees.value));
                    
                    isLoading.value = false; 
                    if(view.value === 'dashboard') setTimeout(() => initCharts(), 100); 
                });

                db.ref('contacts').on('value', (s) => { 
                    const d = s.val(); 
                    customContacts.value = d ? Object.values(d) : []; 
                    localStorage.setItem('offline_contacts', JSON.stringify(customContacts.value));
                });

                db.ref('announcements').orderByChild('timestamp').on('value', (s) => { 
                    const d = s.val(); 
                    announcementsList.value = d ? Object.values(d).sort((a,b) => b.timestamp - a.timestamp) : []; 
                    localStorage.setItem('offline_announcements', JSON.stringify(announcementsList.value));
                });

            }).catch(() => { 
                if (!cachedEmployees) { 
                    isLoading.value = false; 
                    showToast("لا يوجد اتصال بالإنترنت", "error"); 
                } 
            });
        });

        onUpdated(() => { updateIcons(); });

        return {
            isAdmin, isDarkMode, isLoading, toasts,
            view, shift, query, modal, selectedUid, showRolling, form, employees, announcementsList,
            headerTitle, filteredEmployees, searchResults, activeCount, sickCount, sickEmployeesCount, 
            deptTotalCount, deptActiveCount, deptSickCount, latestAnnouncement, selectedEmployee, liveShift,
            availableJobs, availableNames, availableSubstitutes, newAnnouncement, loginData, activeCompanyEmployees,
            sunIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
            moonIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-500"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
            toggleDarkMode, navigate, navigateShift, count, getDeptName, cleanPhone, getShiftCardClass, getShiftIconClass, getShiftTextClass, getShiftName,
            openModal, closeModal, openDetails, showSubstitutes, onJobSelect, onNameSelect,
            publishAnnouncement, deleteAnnouncement, saveEmployee, deleteEmployee, moveEmployee, handleHeaderClick, handleLogin
        };
    }
});

app.mount('#app');