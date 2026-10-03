import { LogoMark3D } from "./LogoMark3D";

// First-visit splash. Server-rendered + two tiny inline scripts, so it paints
// before hydration and never waits on React:
//  1) before paint: if this browser session already saw it, hide it instantly
//  2) on window load: fade out (minimum ~1.6s so the wordmark finishes, hard cap 3.2s, tap to skip)
// Visibility is driven by a class on <html> (suppressHydrationWarning there),
// never by removing React-owned DOM.
const BEFORE = `try{if(sessionStorage.getItem('st_splash')){document.documentElement.classList.add('st-splash-off')}else{sessionStorage.setItem('st_splash','1');document.documentElement.classList.add('st-splash-on')}}catch(e){document.documentElement.classList.add('st-splash-off')}`;
const AFTER = `(function(){var d=document.documentElement;if(!d.classList.contains('st-splash-on'))return;var done=false;function hide(){if(done)return;done=true;d.classList.add('st-splash-out');setTimeout(function(){d.classList.remove('st-splash-on');d.classList.add('st-splash-off')},650)}function soon(){setTimeout(hide,Math.max(0,1600-performance.now()))}if(document.readyState==='complete')soon();else addEventListener('load',soon);setTimeout(hide,3200);var el=document.getElementById('st-splash');if(el)el.addEventListener('click',hide)})()`;

const WORD = "StarTech";

export function Splash() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BEFORE }} />
      <div id="st-splash" role="status" aria-label="Loading StarTech Electronics">
        <div className="st-splash-glow" aria-hidden />
        <LogoMark3D size={112} />
        <p className="st-splash-word" aria-hidden>
          {[...WORD].map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.35 + i * 0.05}s` }}>{ch}</span>
          ))}
        </p>
        <p className="st-splash-sub" aria-hidden>Electronics · Sarena Mobile Mall · Since 2003</p>
        <span className="st-splash-line" aria-hidden><span /></span>
      </div>
      <script dangerouslySetInnerHTML={{ __html: AFTER }} />
    </>
  );
}
