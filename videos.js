/* =========================================================
   추천동영상 (videos.js)
   업로드해주신 recommended-videos-editable.html 의 스크립트를
   그대로 옮기되, 기존 app.js와 이름이 겹치지 않도록 IIFE로 감쌌습니다.
   (이 화면 안의 변경사항은 이 브라우저의 localStorage에 저장됩니다.)
   ========================================================= */
(function () {

const STORAGE_KEY = 'recommendedVideos.v1';

const SAMPLE = {
  subCategories: [
    {
      id: uid(), title:"TOSS INSIGHT | 토스 인사이트", author:"토스",
      summary:"재생목록 · 동영상 7개 · 조회수 102,348회", cover:"", coverCaption:"이 개념을 알면 PO의 실패는 줄어듭니다",
      videos:[
        {id:uid(),title:"토스 리더가 말하는 PO가 꼭 알아야할 개념 | PO SESSION",meta:"토스 · 조회수 23만회 · 3년 전",duration:"30:13",thumb:"",url:"https://www.youtube.com/results?search_query=토스+PO+개념"},
        {id:uid(),title:"토스 리더가 말하는 유저를 떠나지 않게 만드는 단 하나의 개념 | PO SESSION",meta:"토스 · 조회수 16만회 · 3년 전",duration:"29:41",thumb:"",url:"https://www.youtube.com/results?search_query=토스+리텐션"},
        {id:uid(),title:"토스 리더가 말하는 유저를 끌어당기는 서비스 개선 | PO SESSION",meta:"토스 · 조회수 5.8만회 · 3년 전",duration:"21:56",thumb:"",url:"https://www.youtube.com/results?search_query=토스+서비스+개선"}
      ]
    }
  ]
};

function uid(){return 'id'+Math.random().toString(36).slice(2,9);}

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return JSON.parse(JSON.stringify(SAMPLE));
}
function save(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
  // app.js가 로드돼 있으면 Supabase(app_data)로도 동기화
  if (typeof pushToSupabase === 'function') pushToSupabase();
}

let state = load();
let current = 0;

/* ============================================================
   유틸
   ============================================================ */
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

// 유튜브 URL이면 썸네일 자동 추출
function ytThumb(url){
  if(!url) return '';
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : '';
}

/* ============================================================
   렌더링
   ============================================================ */
const $subtabs  = document.getElementById('subtabs');
const $playlist = document.getElementById('playlist');

function renderTabs(){
  const tabs = state.subCategories.map((s,i)=>
    `<button class="subtab ${i===current?'active':''}" data-i="${i}">${esc(s.title)}</button>`
  ).join('');
  $subtabs.innerHTML = tabs + `<button class="subtab add" id="addSub">＋ 서브카테고리 추가</button>`;
  $subtabs.querySelectorAll('.subtab[data-i]').forEach(b=>{
    b.onclick = ()=>{ current = +b.dataset.i; render(); };
  });
  document.getElementById('addSub').onclick = ()=> openSubModal(null);
}

function render(){
  renderTabs();
  if(state.subCategories.length === 0){
    $playlist.innerHTML = `<div class="empty">아직 서브카테고리가 없습니다. 위의 <b>＋ 서브카테고리 추가</b>를 눌러 시작하세요.</div>`;
    return;
  }
  if(current >= state.subCategories.length) current = 0;
  const s = state.subCategories[current];
  const cover = s.cover ? `<img src="${esc(s.cover)}" alt="">` : '';

  const items = s.videos.map((v,i)=>{
    const thumbSrc = v.thumb || ytThumb(v.url);
    const t = thumbSrc ? `<img src="${esc(thumbSrc)}" alt="" onerror="this.style.display='none'">` : '';
    return `
      <div class="vitem">
        <div class="idx">${i+1}</div>
        <div class="vthumb" data-open="${esc(v.url)}">${t}<span class="dur">${esc(v.duration)}</span></div>
        <div class="vinfo">
          <p class="vtitle" data-open="${esc(v.url)}">${esc(v.title)}</p>
          <p class="vmeta">${esc(v.meta)}</p>
          <span class="quick" data-open="${esc(v.url)}">▶ 간단보기</span>
        </div>
        <div class="vtools">
          <button class="btn sm" data-editvid="${v.id}">수정</button>
        </div>
      </div>`;
  }).join('');

  $playlist.innerHTML = `
    <div class="feature">
      <div class="thumb">${cover}<div class="ov"></div><div class="cap">${esc(s.coverCaption||s.title)}</div></div>
      <div class="body">
        <h2>${esc(s.title)}</h2>
        <p class="meta">게시자: ${esc(s.author)}<br>${esc(s.summary)}</p>
        <div class="actions">
          <button class="play-all" id="playAll">▶ 모두 재생</button>
          <button class="mini" id="editSub">✎ 편집</button>
        </div>
      </div>
    </div>
    <div class="videolist">
      <div class="list-head">
        <span class="t">동영상 ${s.videos.length}개</span>
        <button class="btn primary sm" id="addVid">＋ 동영상 추가</button>
      </div>
      ${items || '<div class="empty" style="text-align:left;padding:20px 8px;">아직 동영상이 없습니다. ＋ 동영상 추가를 눌러 링크를 넣으세요.</div>'}
    </div>`;

  // 재생/열기
  $playlist.querySelectorAll('[data-open]').forEach(el=>{
    el.onclick = ()=>{ const u = el.getAttribute('data-open'); if(u) window.open(u,'_blank','noopener'); };
  });
  const playAll = document.getElementById('playAll');
  if(playAll) playAll.onclick = ()=>{ const f=s.videos[0]; if(f&&f.url) window.open(f.url,'_blank','noopener'); };
  document.getElementById('editSub').onclick = ()=> openSubModal(current);
  document.getElementById('addVid').onclick = ()=> openVidModal(null);
  $playlist.querySelectorAll('[data-editvid]').forEach(b=>{
    b.onclick = ()=> openVidModal(b.getAttribute('data-editvid'));
  });
}

/* ============================================================
   서브카테고리 모달
   ============================================================ */
const subBg=document.getElementById('subModalBg'), subForm=document.getElementById('subForm');
let editingSubIndex = null;

function openSubModal(index){
  editingSubIndex = index;
  const isEdit = index !== null;
  document.getElementById('subModalTitle').textContent = isEdit ? '서브카테고리 수정' : '서브카테고리 추가';
  document.getElementById('subDeleteBtn').style.display = isEdit ? 'inline-block' : 'none';
  const s = isEdit ? state.subCategories[index] : {title:'',author:'',summary:'',coverCaption:'',cover:''};
  subForm.title.value=s.title||''; subForm.author.value=s.author||'';
  subForm.summary.value=s.summary||''; subForm.coverCaption.value=s.coverCaption||''; subForm.cover.value=s.cover||'';
  subBg.classList.add('show'); subForm.title.focus();
}
document.getElementById('subSaveBtn').onclick=()=>{
  if(!subForm.title.value.trim()){ subForm.title.focus(); return; }
  const data={title:subForm.title.value.trim(),author:subForm.author.value.trim(),summary:subForm.summary.value.trim(),coverCaption:subForm.coverCaption.value.trim(),cover:subForm.cover.value.trim()};
  if(editingSubIndex!==null){ Object.assign(state.subCategories[editingSubIndex],data); }
  else{ state.subCategories.push({id:uid(),...data,videos:[]}); current=state.subCategories.length-1; }
  save(); subBg.classList.remove('show'); render();
};
document.getElementById('subDeleteBtn').onclick=()=>{
  if(editingSubIndex===null) return;
  if(!confirm('이 서브카테고리와 안의 모든 동영상을 삭제할까요?')) return;
  state.subCategories.splice(editingSubIndex,1);
  if(current>=state.subCategories.length) current=Math.max(0,state.subCategories.length-1);
  save(); subBg.classList.remove('show'); render();
};

/* ============================================================
   동영상 모달
   ============================================================ */
const vidBg=document.getElementById('vidModalBg'), vidForm=document.getElementById('vidForm');
let editingVidId = null;

function openVidModal(vidId){
  editingVidId = vidId;
  const isEdit = vidId !== null;
  document.getElementById('vidModalTitle').textContent = isEdit ? '동영상 수정' : '동영상 추가';
  document.getElementById('vidDeleteBtn').style.display = isEdit ? 'inline-block' : 'none';
  const s = state.subCategories[current];
  const v = isEdit ? s.videos.find(x=>x.id===vidId) : {title:'',url:'',meta:'',duration:'',thumb:''};
  vidForm.title.value=v.title||''; vidForm.url.value=v.url||'';
  vidForm.meta.value=v.meta||''; vidForm.duration.value=v.duration||''; vidForm.thumb.value=v.thumb||'';
  vidBg.classList.add('show'); vidForm.title.focus();
}
document.getElementById('vidSaveBtn').onclick=()=>{
  if(!vidForm.title.value.trim()){ vidForm.title.focus(); return; }
  if(!vidForm.url.value.trim()){ vidForm.url.focus(); return; }
  const s = state.subCategories[current];
  const data={title:vidForm.title.value.trim(),url:vidForm.url.value.trim(),meta:vidForm.meta.value.trim(),duration:vidForm.duration.value.trim(),thumb:vidForm.thumb.value.trim()};
  if(editingVidId!==null){ Object.assign(s.videos.find(x=>x.id===editingVidId),data); }
  else{ s.videos.push({id:uid(),...data}); }
  // 요약 자동 갱신
  s.summary = `재생목록 · 동영상 ${s.videos.length}개`;
  save(); vidBg.classList.remove('show'); render();
};
document.getElementById('vidDeleteBtn').onclick=()=>{
  if(editingVidId===null) return;
  if(!confirm('이 동영상을 삭제할까요?')) return;
  const s=state.subCategories[current];
  s.videos=s.videos.filter(x=>x.id!==editingVidId);
  s.summary=`재생목록 · 동영상 ${s.videos.length}개`;
  save(); vidBg.classList.remove('show'); render();
};

/* 모달 닫기 공통 */
document.querySelectorAll('#subModalBg [data-close], #vidModalBg [data-close]').forEach(b=> b.onclick=()=>{ subBg.classList.remove('show'); vidBg.classList.remove('show'); });
[subBg,vidBg].forEach(bg=> bg.onclick=e=>{ if(e.target===bg) bg.classList.remove('show'); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ subBg.classList.remove('show'); vidBg.classList.remove('show'); } });

/* 데이터 내보내기 (백업용 JSON) */
document.getElementById('exportBtn').onclick=()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='recommended-videos.json'; a.click();
  URL.revokeObjectURL(a.href);
};

render();

/* ============================================================
   app.js(Supabase 동기화)와 연결하기 위한 브리지
   - getState: 현재 추천동영상 데이터를 반환
   - setState: 다른 기기/Supabase에서 받아온 데이터를 반영
   ============================================================ */
window.VideoApp = {
  getState: function () { return state; },
  setState: function (newState) {
    if (!newState || typeof newState !== 'object') return;
    state = newState;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
    current = 0;
    render();
  }
};

})();
