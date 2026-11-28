// v109 선택한 모드의 코드·화면만 늦게 연결한다.
export async function load() {
  const url=new URL('./mode.js',import.meta.url);url.search=new URL(import.meta.url).search;
  const {Mode}=await import(url.href);window.G.ZombieMode=Mode;
  const parts=await Promise.all(['models','navigation','ai','mission','scene','audio','ui'].map(name=>import(new URL('./'+name+'.js'+url.search,import.meta.url).href)));Mode.modules={Models:parts[0].Models,Nav:parts[1].Nav,Brain:parts[2].Brain,TYPES:parts[2].TYPES,Combat:parts[2].Combat,DIFFICULTIES:parts[3].DIFFICULTIES,STAGES:parts[3].STAGES,layout:parts[3].layout,Scene:parts[4].Scene,Sound:parts[5].Sound,HUD:parts[6].HUD};
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./zombie.css'+new URL(import.meta.url).search,import.meta.url).href;document.head.appendChild(css);
  await Mode.mount();return Mode;
}
