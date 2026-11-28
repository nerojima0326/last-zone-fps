// v109 선택한 모드의 코드·화면만 늦게 연결한다.
export async function load() {
  const url=new URL('./mode.js',import.meta.url);url.search=location.search?new URL(import.meta.url).search:new URL(import.meta.url).search;
  const {Mode}=await import(url.href);window.G.ZombieMode=Mode;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./zombie.css'+new URL(import.meta.url).search,import.meta.url).href;document.head.appendChild(css);
  await Mode.mount();return Mode;
}
