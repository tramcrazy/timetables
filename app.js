// Simple client-side exam timetable generator
(function(){
  const STORAGE_KEY = 'exam_timetable_data_v1';
  let subjects = [];

  const $ = id => document.getElementById(id);
  const SELECTION_KEY = 'exam_timetable_selected_v1';
  const EXTRA_KEY = 'exam_timetable_extra_v1';

  // Normalize subject entries so each subject has an `exams` array
  function normalizeSubject(s){
    const name = s.name || '';
    let exams = [];
    // Support three shapes:
    // 1) { datetime: '2026-01-10T09:00' } (legacy full ISO)
    // 2) { date: '2026-01-10', period: 'morning' } (new preferred)
    // 3) single-root subject with datetime/date
    function normalizeExam(e){
      const notes = e.notes || '';
      const lengthMinutes = Number(e.lengthMinutes || e.length || e.duration || e.durationMinutes || 60);
      // determine period and build an internal datetime (ISO) for sorting
      let period = (e.period || e.timeOfDay || '').toString().toLowerCase();
      let raw = e.datetime || e.date || '';
      let datetime = '';
      if(raw){
        // if raw includes a time component, use it and infer period if missing
        if(raw.indexOf('T') !== -1){
          datetime = raw;
          if(!period){
            const hr = new Date(datetime).getHours(); period = hr < 12 ? 'morning' : 'afternoon';
          }
        } else {
          // date-only; apply default times for morning/afternoon
          if(period === 'afternoon') datetime = raw + 'T13:00';
          else datetime = raw + 'T09:00'; // default to morning
        }
      }
      // if still no period but have datetime, infer from time
      if(!period && datetime){ period = (new Date(datetime).getHours() < 12) ? 'morning' : 'afternoon'; }
      return { datetime, period, notes, lengthMinutes };
    }

    if(Array.isArray(s.exams)){
      exams = s.exams.map(normalizeExam);
    } else if(s.datetime || s.date){
      exams = [normalizeExam(s)];
    } else {
      // if object has nested exam-like keys, try to pick them up conservatively
      exams = [];
    }
    return { name, exams };
  }

  // Format just the date part (no time)
  function formatDateOnly(iso){
    const d = new Date(iso);
    if(isNaN(d)) return iso;
    return d.toLocaleDateString([], {weekday:'short', year:'numeric', month:'short', day:'numeric'});
  }

  function capitalize(s){ return s && s.length ? (s[0].toUpperCase() + s.slice(1)) : s; }

  // Format an exam for display: date + period (Morning/Afternoon)
  function formatExamLabel(e){
    if(!e) return '';
    const dt = e.datetime || '';
    const datePart = dt ? formatDateOnly(dt) : '';
    const period = e.period ? capitalize(e.period) : '';
    if(datePart && period) return `${datePart} · ${period}`;
    if(datePart) return datePart;
    // fallback to full datetime formatter
    return formatDateTime(dt);
  }

  function earliestExamDate(subject){
    if(!subject || !Array.isArray(subject.exams) || subject.exams.length===0) return Infinity;
    let min = Infinity;
    subject.exams.forEach(e=>{ const t = new Date(e.datetime).getTime(); if(!isNaN(t) && t < min) min = t; });
    return min;
  }
  async function loadInitialData(){
    // priority: localStorage -> data.json (fetch) -> built-in sample
    const stored = localStorage.getItem(STORAGE_KEY);
    if(stored){
      try{ subjects = JSON.parse(stored).map(normalizeSubject); renderAll(); return; }catch(e){ console.warn('Invalid stored JSON', e); }
    }

    try{
      const res = await fetch('data.json');
  if(res.ok){ subjects = (await res.json()).map(normalizeSubject); saveToStorage(); renderAll(); return; }
    }catch(e){ console.warn('No data.json or failed fetch', e); }

    // fallback sample (new format)
    subjects = [{ name: 'Sample Subject', exams: [{ datetime: new Date().toISOString(), notes:'', lengthMinutes:60 }] }];
    saveToStorage(); renderAll();
  }

  function saveToStorage(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects, null, 2)); }

  function renderSubjectsList(){
    const container = $('subjects-list'); container.innerHTML = '';
    // sort subjects by their earliest exam date
    subjects.sort((a,b)=> earliestExamDate(a) - earliestExamDate(b));
    const savedSet = new Set(loadSelectedNames());
    subjects.forEach((s, i)=>{
      const el = document.createElement('label'); el.className='list-group-item d-flex justify-content-between align-items-start';
      const left = document.createElement('div');
      left.className='ms-2 me-auto d-flex align-items-start';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.index=i; cb.className='form-check-input me-2'; cb.checked = savedSet.has(s.name);
      cb.addEventListener('change', ()=>{ saveSelectionFromDOM(); renderPreview(); updateGenerateButtonState(); });
      left.appendChild(cb);
      const textWrap = document.createElement('div');
      const title = document.createElement('div'); title.textContent = s.name; title.style.fontWeight='600';
      const meta = document.createElement('div'); meta.className = 'small text-muted';
  const nextTs = earliestExamDate(s);
  const nextText = nextTs === Infinity ? 'No exams' : formatDateOnly(new Date(nextTs).toISOString());
      meta.textContent = `${s.exams.length} exam${s.exams.length!==1? 's':''} · ${nextText}`;
      textWrap.appendChild(title); textWrap.appendChild(meta);
      left.appendChild(textWrap);
      el.appendChild(left);

      container.appendChild(el);
    });
  }

  function getSelectedSubjects(){
    const checks = document.querySelectorAll('#subjects-list input[type=checkbox]');
    const out = [];
    checks.forEach(c=>{ if(c.checked) out.push(subjects[Number(c.dataset.index)]); });
    return out.sort((a,b)=> earliestExamDate(a) - earliestExamDate(b));
  }

  function saveSelectedNames(names){
    try{ localStorage.setItem(SELECTION_KEY, JSON.stringify(names||[])); }catch(e){ console.warn('Failed saving selections', e); }
  }

  function loadSelectedNames(){
    try{ const raw = localStorage.getItem(SELECTION_KEY); if(!raw) return []; return JSON.parse(raw) || []; }catch(e){ return []; }
  }

  function saveSelectionFromDOM(){
    const names = [];
    document.querySelectorAll('#subjects-list input[type=checkbox]').forEach(c=>{ if(c.checked) { const s = subjects[Number(c.dataset.index)]; if(s && s.name) names.push(s.name); } });
    saveSelectedNames(names);
  }

  function updateGenerateButtonState(){
    const btn = $('generate-pdf'); if(!btn) return;
    const any = document.querySelectorAll('#subjects-list input[type=checkbox]:checked').length > 0;
    btn.disabled = !any;
  }

  function formatDateTime(iso){
    const d = new Date(iso);
    if(isNaN(d)) return iso;
    return d.toLocaleString([], {weekday:'short', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
  }

  function formatDuration(minutes){
    minutes = Number(minutes) || 0;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if(hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if(hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  }

  function renderPreview(){
    const container = $('timetable-preview'); container.innerHTML = '';
    const selected = getSelectedSubjects();
    const student = $('student-name').value || '';
    const title = document.createElement('div'); title.className='mb-3';
    title.innerHTML = `<h3>${student? escapeHtml(student) + ' — ' : ''}Exam Timetable</h3>`;
    container.appendChild(title);

    if(selected.length===0){
      const p = document.createElement('p'); p.className='text-muted'; p.textContent = 'No subjects selected.'; container.appendChild(p); return;
    }

    // sort selected subjects by earliest exam date
    selected.sort((a,b)=> earliestExamDate(a) - earliestExamDate(b));
    const extra = !!document.getElementById('extra-time-toggle') && document.getElementById('extra-time-toggle').checked;

    selected.forEach(s=>{
      const subjWrapper = document.createElement('div'); subjWrapper.className='mb-3';
      const subjHeader = document.createElement('div'); subjHeader.style.fontWeight='700'; subjHeader.textContent = s.name;
      subjWrapper.appendChild(subjHeader);

      const exams = (s.exams || []).slice().sort((a,b)=> new Date(a.datetime) - new Date(b.datetime));
      if(exams.length===0){
        const none = document.createElement('div'); none.className='text-muted small'; none.textContent='(no exams)'; subjWrapper.appendChild(none);
      }else{
        exams.forEach(e=>{
          const length = Number(e.lengthMinutes || 60);
          const adjusted = Math.round(length * (extra? 1.25 : 1));

          const row = document.createElement('div'); row.className='exam-row';
          // show date (no specific time) and period + duration once
          const h = document.createElement('div'); h.className='exam-title';
          h.textContent = `${formatExamLabel(e)} · ${formatDuration(adjusted)}${extra? ' (incl. extra time)':''}`;
          const meta = document.createElement('div'); meta.className='exam-meta';
          meta.innerHTML = `<div class='small text-muted'>${e.notes || ''}</div>`;
          row.appendChild(h); row.appendChild(meta);
          subjWrapper.appendChild(row);
        });
      }
      container.appendChild(subjWrapper);
    });
  }

  function escapeHtml(s){ return s.replace(/[&<>]/g, c=>({ '&':'&amp;','<':'&lt;', '>':'&gt;' }[c])); }

  async function generatePDF(){
    const selected = getSelectedSubjects();
    if(selected.length===0){ alert('Please select at least one subject.'); return; }

    // render a clean printable node and attach off-screen so html2canvas can measure styles
    const node = document.createElement('div');
    node.style.width='1000px'; node.style.padding='24px'; node.style.background='#fff'; node.style.color='#111';
    node.style.position = 'absolute'; node.style.left = '-9999px'; node.style.top = '0';
    const student = $('student-name').value || '';
    const title = document.createElement('h1'); title.textContent = (student? student + ' — ' : '') + 'Exam Timetable';
    title.style.fontSize='28px'; node.appendChild(title);
    const subtitle = document.createElement('div'); subtitle.className='mb-3'; subtitle.textContent = 'Generated on: ' + new Date().toLocaleString(); node.appendChild(subtitle);

    // flatten all exams from selected subjects and sort them by date
    const extra = !!document.getElementById('extra-time-toggle') && document.getElementById('extra-time-toggle').checked;
    const allExams = [];
    selected.forEach(s=>{
      (s.exams || []).forEach(e=>{
        allExams.push({
          subject: s.name,
          datetime: e.datetime,
          period: e.period,
          notes: e.notes,
          lengthMinutes: Number(e.lengthMinutes || e.length || e.duration || e.durationMinutes || 60)
        });
      });
    });

    allExams.sort((a,b)=> new Date(a.datetime) - new Date(b.datetime));

    if(allExams.length===0){
      const none = document.createElement('div'); none.style.color='#666'; none.textContent='(no exams)'; node.appendChild(none);
    }else{
          allExams.forEach(e=>{
            const length = Number(e.lengthMinutes || 60);
            const adjusted = Math.round(length * (extra? 1.25 : 1));

            const row = document.createElement('div'); row.style.borderBottom='1px solid #eee'; row.style.padding='8px 0';
              const dateEl = document.createElement('div'); dateEl.textContent = `${formatExamLabel(e)} · ${formatDuration(adjusted)}${extra? ' (incl. extra time)':''}`; dateEl.style.fontWeight='700';
              const subjEl = document.createElement('div'); subjEl.textContent = e.subject; subjEl.style.fontStyle='italic'; subjEl.style.color='#111'; subjEl.style.marginBottom='4px';
              // notes shown below; duration is already in the dateEl
              const notes = document.createElement('div'); notes.style.color='#666'; notes.style.fontSize='13px'; notes.textContent = e.notes || '';
            row.appendChild(dateEl);
            row.appendChild(subjEl);
            row.appendChild(notes);
            node.appendChild(row);
          });
    }

    document.body.appendChild(node);

    // robust jsPDF detection (UMD build exposes window.jspdf.jsPDF)
    const jsPDFClass = (window.jspdf && (window.jspdf.jsPDF || window.jspdf.default)) || window.jsPDF || null;

    try{
      if(!window.html2canvas && typeof html2canvas === 'undefined') throw new Error('html2canvas not found');
      if(!jsPDFClass) throw new Error('jsPDF not found');

      const canvas = await html2canvas(node, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDFClass({unit:'pt', format:'a4'});
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pageWidth) / imgProps.width;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, pdfHeight);
      // if content is longer than a page, add pages
      if(pdfHeight > pageHeight){
        let remaining = pdfHeight - pageHeight;
        while(remaining > 0){
          position = - (pageHeight * (pdf.internal.pages.length-1));
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pageWidth, pdfHeight);
          remaining -= pageHeight;
        }
      }
      const filename = ((student||'timetable') + '-exam-timetable.pdf').replace(/\s+/g,'_');
      pdf.save(filename);
    }catch(err){
      console.error('PDF generation error:', err);
      const msg = err && (err.message || String(err)) ? (err.message || String(err)) : 'unknown error';
      alert('PDF generation failed: '+msg);
    }finally{
      // clean up
      if(node && node.parentNode) node.parentNode.removeChild(node);
    }
  }

  // Subject editing modal removed for student-facing UI.

  function renderAll(){ renderSubjectsList(); renderPreview(); updateGenerateButtonState(); }
  
  function saveExtraState(value){
    try{ localStorage.setItem(EXTRA_KEY, value? '1':'0'); }catch(e){ console.warn('Failed saving extra state', e); }
  }

  function loadExtraState(){
    try{ const v = localStorage.getItem(EXTRA_KEY); return v === '1'; }catch(e){ return false; }
  }
  

  // wire up UI
  document.addEventListener('DOMContentLoaded', ()=>{
    loadInitialData();
    $('generate-pdf').addEventListener('click', generatePDF);
    // edit-data-btn removed from UI
  $('select-all').addEventListener('click', ()=>{ document.querySelectorAll('#subjects-list input[type=checkbox]').forEach(c=>c.checked=true); saveSelectionFromDOM(); renderPreview(); updateGenerateButtonState(); });
  $('clear-selection').addEventListener('click', ()=>{ document.querySelectorAll('#subjects-list input[type=checkbox]').forEach(c=>c.checked=false); saveSelectionFromDOM(); renderPreview(); updateGenerateButtonState(); });

    $('download-json-btn').addEventListener('click', ()=>{
      const blob = new Blob([JSON.stringify(subjects, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'subjects.json'; a.click(); URL.revokeObjectURL(url);
    });

    $('import-json-btn').addEventListener('click', ()=>{ $('import-file-input').click(); });
    $('import-file-input').addEventListener('change', async (e)=>{
      const f = e.target.files[0]; if(!f) return; try{
        const txt = await f.text(); const parsed = JSON.parse(txt); if(!Array.isArray(parsed)) throw new Error('JSON must be array');
        const prev = new Set(loadSelectedNames());
        subjects = parsed.map(normalizeSubject);
        const names = subjects.map(s=>s.name);
        const kept = names.filter(n=>prev.has(n));
        saveToStorage();
        saveSelectedNames(kept);
        renderAll();
        updateGenerateButtonState();
        alert('Imported successfully');
      }catch(err){ alert('Import failed: '+err.message); }
      e.target.value = '';
    });

    // keep preview in sync when name changes
    $('student-name').addEventListener('input', renderPreview);
    const extraToggle = document.getElementById('extra-time-toggle');
    if(extraToggle){
      // restore saved state
      try{ extraToggle.checked = loadExtraState(); }catch(e){}
      extraToggle.addEventListener('change', ()=>{ saveExtraState(extraToggle.checked); renderPreview(); });
    }
    // initial button state after data loaded
    setTimeout(()=>{ updateGenerateButtonState(); }, 200);
  });

})();
