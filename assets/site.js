/* Progressive enhancement: all research pages and paper links work without JS. */
(() => {
  'use strict';
  const $ = (s,root=document) => root.querySelector(s);
  const $$ = (s,root=document) => [...root.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionPaused = reduceMotion.matches;
  /* Card preview videos.
     - The <img> under each video is the poster; the video is revealed only once it has a real frame,
       and stays revealed afterwards (a paused frame looks identical to the poster, so no blink on return).
     - Videos are fetched through a small queue (MAX_LOADS at a time, in page order) instead of all at once,
       so the first visible card starts quickly rather than every card crawling in together.
     - Data-saver connections keep the posters only. */
  const backgroundVideos=$$('[data-background-video]');
  const visibleVideos=new Set();
  const saveData=!!(navigator.connection&&navigator.connection.saveData);
  const downlink=navigator.connection&&navigator.connection.downlink;
  const MAX_LOADS=downlink&&downlink<5?1:2; /* one at a time on slow links */
  const queue=[];let loading=0;
  function finishLoad(video){if(video.dataset.loadState!=='loading')return;video.dataset.loadState='ready';loading--;pumpQueue();updateVideo(video);}
  function pumpQueue(){
    queue.sort((a,b)=>backgroundVideos.indexOf(a)-backgroundVideos.indexOf(b));
    for(let i=0;loading<MAX_LOADS&&i<queue.length;){
      const video=queue[i];
      if(video.dataset.loadState||!visibleVideos.has(video)){queue.splice(i,1);continue;} /* scrolled past before its turn: fetch it when it returns */
      /* the same clip used twice (e.g. XoNav in Research Vision and in the grid): wait for the first copy, then reuse the browser cache */
      if(backgroundVideos.some(v=>v!==video&&v.dataset.src===video.dataset.src&&v.dataset.loadState==='loading')){i++;continue;}
      queue.splice(i,1);
      video.dataset.loadState='loading';loading++;
      video.addEventListener('canplaythrough',()=>finishLoad(video),{once:true});
      video.addEventListener('error',()=>{finishLoad(video);video.dataset.loadState='failed';},{once:true});
      setTimeout(()=>finishLoad(video),8000); /* never let one slow file block the queue */
      video.preload='auto';video.src=video.dataset.src;video.load(); /* playback starts at canplaythrough, so it does not freeze mid-loop */
    }
  }
  function requestLoad(video){if(saveData||video.dataset.loadState||queue.includes(video))return;queue.push(video);pumpQueue();}
  backgroundVideos.forEach(video=>{
    video.muted=true;
    const reveal=()=>video.classList.add('is-playing');
    video.addEventListener('playing',reveal);
    video.addEventListener('loadeddata',()=>{if(video.currentTime>0||!video.paused)reveal();});
  });
  function updateVideo(video) {
    const shouldPlay=!motionPaused&&visibleVideos.has(video)&&!document.hidden;
    if(!shouldPlay){if(!video.paused)video.pause();return;}
    if(!video.dataset.loadState){requestLoad(video);return;}
    if(video.dataset.loadState==='failed'||!video.paused)return;
    const promise=video.play();
    if(promise)promise.catch(()=>{ /* interrupted or blocked (e.g. iOS Low Power Mode): the poster stays; retry on next visibility change */ });
  }
  function updateMotion() {
    document.documentElement.classList.toggle('motion-paused',motionPaused);
    $$('img[data-loop]').forEach(img=>{
      const next=motionPaused ? img.dataset.still : img.dataset.loop;
      if(next && img.getAttribute('src')!==next) img.src=next;
    });
    backgroundVideos.forEach(updateVideo);
  }
  reduceMotion.addEventListener('change',event=>{motionPaused=event.matches;updateMotion();});
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting)visibleVideos.add(entry.target);else visibleVideos.delete(entry.target);
      updateVideo(entry.target);
    }),{rootMargin:'300px 0px'});
    backgroundVideos.forEach(video=>observer.observe(video));
  } else backgroundVideos.forEach(video=>visibleVideos.add(video));
  document.addEventListener('visibilitychange',()=>backgroundVideos.forEach(updateVideo));
  updateMotion();

  const menu=$('[data-menu-toggle]'),nav=$('#primary-nav');
  function closeMenu(){if(!menu||!nav)return;nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');}
  if(menu&&nav){
    menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav.classList.toggle('is-open',open);});
    $$('a',nav).forEach(a=>a.addEventListener('click',closeMenu));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
    document.addEventListener('click',event=>{if(!event.target.closest('.nav-shell'))closeMenu();});
  }

  const projectCards=$$('[data-project-card]');
  $$('[data-project-filter]').forEach(button=>button.addEventListener('click',()=>{
    const category=button.dataset.projectFilter;
    $$('[data-project-filter]').forEach(b=>{const active=b===button;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});
    let count=0;
    projectCards.forEach(card=>{const show=category==='all'||card.dataset.category===category;card.hidden=!show;if(show)count++;});
    const output=$('[data-project-count]');if(output)output.textContent=`${count} research projects`;
  }));

  $$('[data-show-more]').forEach(button=>button.addEventListener('click',()=>{
    const expanded=button.getAttribute('aria-expanded')!=='true';
    button.setAttribute('aria-expanded',String(expanded));
    $$('[data-overflow]',button.closest('.publication-column')).forEach(item=>{item.hidden=!expanded;});
    const text=expanded?'Show fewer':`Show all ${button.dataset.count}`;
    button.childNodes.forEach(node=>{if(node.nodeType===Node.TEXT_NODE)node.textContent=text+' ';});
  }));

  const search=$('[data-publication-search]'),publicationCards=$$('.bibliography-list [data-publication]');
  let publicationType='all';
  function filterPublications(){
    if(!search)return;
    const query=search.value.trim().toLocaleLowerCase();let count=0;
    const terms=query.split(/\s+/).filter(Boolean);
    publicationCards.forEach(card=>{
      const show=(publicationType==='all'||publicationType===card.dataset.type)&&terms.every(term=>card.dataset.search.includes(term));
      card.hidden=!show;if(show)count++;
    });
    const output=$('[data-publication-count]');if(output)output.textContent=`${count} ${count===1?'publication':'publications'}`;
    const empty=$('[data-publication-empty]');if(empty)empty.hidden=count>0;
    const clear=$('[data-clear-search]');if(clear)clear.hidden=!query;
  }
  if(search){
    search.addEventListener('input',filterPublications);
    $$('[data-pub-filter]').forEach(button=>button.addEventListener('click',()=>{
      publicationType=button.dataset.pubFilter;
      $$('[data-pub-filter]').forEach(b=>{const active=b===button;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});filterPublications();
    }));
    const clear=$('[data-clear-search]');if(clear)clear.addEventListener('click',()=>{search.value='';filterPublications();search.focus();});
    const reset=$('[data-reset-publications]');if(reset)reset.addEventListener('click',()=>{search.value='';publicationType='all';$$('[data-pub-filter]').forEach(b=>{const active=b.dataset.pubFilter==='all';b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});filterPublications();search.focus();});
    filterPublications();
  }

  const imageDialog=$('#image-dialog');
  let opener=null;
  function openDialog(dialog,button){opener=button;dialog.showModal();document.body.classList.add('dialog-open');}
  function closeDialog(dialog){if(!dialog)return;dialog.close();}
  $$('[data-image]').forEach(button=>button.addEventListener('click',()=>{
    const image=$('#dialog-image');image.src=button.dataset.image;
    image.alt=button.dataset.caption||$('img',button)?.alt||'Research figure';
    $('#image-caption').textContent=button.dataset.caption||'';openDialog(imageDialog,button);
  }));
  $$('.media-dialog').forEach(dialog=>{
    $$('[data-close-dialog]',dialog).forEach(button=>button.addEventListener('click',()=>closeDialog(dialog)));
    dialog.addEventListener('click',event=>{const rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))closeDialog(dialog);});
    dialog.addEventListener('close',()=>{
      const video=$('video',dialog);if(video){video.pause();video.removeAttribute('src');video.load();}
      document.body.classList.remove('dialog-open');if(opener)opener.focus();
    });
  });

  const tocLinks=$$('.project-toc a');
  if(tocLinks.length&&'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){if(entry.isIntersecting){tocLinks.forEach(a=>a.classList.toggle('is-current',a.hash==='#'+entry.target.id));}}
    },{rootMargin:'-18% 0px -62% 0px',threshold:0});
    tocLinks.forEach(a=>{const section=$(a.hash);if(section)observer.observe(section);});
  }
})();
