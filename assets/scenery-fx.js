/* Bomisu.pl: animacje sceny (wiatr, fale, mgła, drzewa, domek).
   Wszystko to elementy DOM animowane przez transform i opacity, więc działa
   na GPU i prawie nie obciąża procesora. Układ współrzędnych: 1920x320,
   dopasowany do assets/mountains-lake.svg (cover, przyklejony do dołu). */
(function () {
  'use strict';
  var D = {"lake":"M670.2,266 C670.8,268.1 668.7,270.2 665.3,272.2 C661.9,274.2 655.7,276.2 649.7,278 C643.6,279.8 636.2,281.5 629,283.1 C621.8,284.7 614.3,286.2 606.4,287.7 C598.5,289.1 590.3,290.5 581.6,291.7 C572.8,292.9 563.2,294 553.7,295 C544.2,296 534.3,296.8 524.7,297.7 C515.1,298.6 505.8,299.4 496.2,300.4 C486.6,301.3 477.4,302.4 467.2,303.4 C457,304.3 446.4,305.3 435.2,305.9 C424,306.5 411.7,306.9 400,306.9 C388.3,306.9 376.1,306.5 364.9,305.9 C353.6,305.3 342.9,304.4 332.5,303.5 C322.1,302.7 312.3,301.8 302.3,300.9 C292.2,300.1 282.1,299.3 272.2,298.5 C262.3,297.6 252,296.7 242.8,295.6 C233.6,294.5 224.8,293.3 217.1,291.9 C209.5,290.5 203.1,288.9 197,287.3 C191,285.7 185.9,284 180.8,282.3 C175.7,280.7 170.6,279 166.4,277.2 C162.2,275.4 157.9,273.6 155.3,271.7 C152.7,269.9 151.2,267.9 151,266 C150.9,264.1 152.6,262.1 154.3,260.2 C156,258.3 159,256.5 161.4,254.6 C163.8,252.6 165.9,250.7 168.7,248.8 C171.5,246.8 173.7,244.7 178.2,242.7 C182.7,240.8 187.9,238.7 195.6,237.1 C203.2,235.4 213.2,233.9 224,232.8 C234.8,231.7 247.9,231 260.3,230.5 C272.6,230 285.9,229.8 298.1,229.6 C310.4,229.4 322.2,229.3 333.8,229.2 C345.3,229.1 356.4,229 367.4,229 C378.5,229 389.3,229.1 400,229.3 C410.7,229.5 421.1,229.9 431.5,230.2 C441.8,230.6 451.8,231.1 462.2,231.4 C472.5,231.8 482.9,232.1 493.6,232.5 C504.4,232.9 515.8,233.2 526.7,233.8 C537.6,234.4 548.9,235.1 558.8,236.1 C568.6,237.1 577.8,238.4 585.7,239.7 C593.7,241.1 600.1,242.7 606.7,244.3 C613.3,245.9 619,247.5 625.3,249.2 C631.6,250.9 638.4,252.5 644.5,254.3 C650.6,256.1 657.5,257.9 661.8,259.9 C666.1,261.8 669.6,263.9 670.2,266Z","trees":[[-5.0,214.3,22.0,49.7,"M11,1 L12.8,9.6 L11.7,8.6 L14.6,18.2 L12.4,17.2 L16.4,26.8 L13.1,25.8 L18.2,35.4 L13.9,34.4 L20,44 L12.6,44 L12.6,48.7 L9.4,48.7 L9.4,44 L2,44 L8.1,34.4 L3.8,35.4 L8.8,25.8 L5.6,26.8 L9.5,17.2 L7.4,18.2 L10.3,8.6 L9.2,9.6Z",47.7],[6.3,202.0,31.5,61.4,"M15.7,1 L18.5,11.7 L16.8,10.7 L21.2,22.4 L17.9,21.4 L24,33.1 L19,32.1 L26.7,43.8 L20.1,42.8 L29.5,54.5 L17.3,54.5 L17.3,60.4 L14.1,60.4 L14.1,54.5 L2,54.5 L11.3,42.8 L4.7,43.8 L12.4,32.1 L7.5,33.1 L13.5,21.4 L10.2,22.4 L14.6,10.7 L13,11.7Z",59.4],[25.3,189.1,29.4,73.6,"M14.7,1 L17.3,13.9 L15.7,12.9 L19.8,26.8 L16.7,25.8 L22.3,39.7 L17.8,38.7 L24.9,52.5 L18.8,51.5 L27.4,65.4 L16.3,65.4 L16.3,72.6 L13.1,72.6 L13.1,65.4 L2,65.4 L10.6,51.5 L4.5,52.5 L11.7,38.7 L7.1,39.7 L12.7,25.8 L9.6,26.8 L13.7,12.9 L12.2,13.9Z",71.6],[45.5,189.9,25.0,71.9,"M12.5,1 L14.6,13.6 L13.3,12.6 L16.7,26.2 L14.2,25.2 L18.8,38.7 L15,37.7 L20.9,51.3 L15.8,50.3 L23,63.9 L14.1,63.9 L14.1,70.9 L10.9,70.9 L10.9,63.9 L2,63.9 L9.1,50.3 L4.1,51.3 L10,37.7 L6.2,38.7 L10.8,25.2 L8.3,26.2 L11.7,12.6 L10.4,13.6Z",69.9],[60.4,209.1,31.2,51.5,"M15.6,1 L18.3,9.9 L16.7,8.9 L21,18.8 L17.8,17.8 L23.7,27.8 L18.8,26.8 L26.4,36.7 L19.9,35.7 L29.2,45.6 L17.2,45.6 L17.2,50.5 L14,50.5 L14,45.6 L2,45.6 L11.2,35.7 L4.7,36.7 L12.3,26.8 L7.4,27.8 L13.4,17.8 L10.1,18.8 L14.5,8.9 L12.9,9.9Z",49.5],[79.8,197.6,28.4,61.2,"M14.2,1 L16.6,11.7 L15.2,10.7 L19.1,22.3 L16.1,21.3 L21.5,33 L17.1,32 L23.9,43.6 L18.1,42.6 L26.4,54.3 L15.8,54.3 L15.8,60.2 L12.6,60.2 L12.6,54.3 L2,54.3 L10.3,42.6 L4.4,43.6 L11.3,32 L6.9,33 L12.2,21.3 L9.3,22.3 L13.2,10.7 L11.7,11.7Z",59.2],[100.2,213.6,23.5,42.4,"M11.8,1 L13.7,8.3 L12.5,7.3 L15.7,15.5 L13.3,14.5 L17.6,22.8 L14.1,21.8 L19.6,30.1 L14.9,29.1 L21.5,37.4 L13.4,37.4 L13.4,41.4 L10.2,41.4 L10.2,37.4 L2,37.4 L8.6,29.1 L4,30.1 L9.4,21.8 L5.9,22.8 L10.2,14.5 L7.9,15.5 L11,7.3 L9.8,8.3Z",40.4],[113.5,196.5,29.0,57.4,"M14.5,1 L17,11 L15.5,10 L19.5,21 L16.5,20 L22,30.9 L17.5,29.9 L24.5,40.9 L18.5,39.9 L27,50.9 L16.1,50.9 L16.1,56.4 L12.9,56.4 L12.9,50.9 L2,50.9 L10.5,39.9 L4.5,40.9 L11.5,29.9 L7,30.9 L12.5,20 L9.5,21 L13.5,10 L12,11Z",55.4],[684.0,210.4,24.1,48.9,"M12,1 L14,9.4 L12.8,8.4 L16,17.9 L13.6,16.9 L18,26.3 L14.4,25.3 L20.1,34.7 L15.2,33.7 L22.1,43.2 L13.6,43.2 L13.6,47.9 L10.4,47.9 L10.4,43.2 L2,43.2 L8.8,33.7 L4,34.7 L9.6,25.3 L6,26.3 L10.4,16.9 L8,17.9 L11.2,8.4 L10,9.4Z",46.9],[1313.1,191.4,31.9,70.5,"M15.9,1 L18.7,13.3 L17,12.3 L21.5,25.7 L18.2,24.7 L24.3,38 L19.3,37 L27.1,50.3 L20.4,49.3 L29.9,62.6 L17.5,62.6 L17.5,69.5 L14.3,69.5 L14.3,62.6 L2,62.6 L11.5,49.3 L4.8,50.3 L12.6,37 L7.6,38 L13.7,24.7 L10.4,25.7 L14.8,12.3 L13.1,13.3Z",68.5],[1333.4,200.8,26.0,61.0,"M13,1 L15.2,11.6 L13.9,10.6 L17.4,22.2 L14.7,21.2 L19.6,32.8 L15.6,31.8 L21.8,43.5 L16.5,42.5 L24,54.1 L14.6,54.1 L14.6,60 L11.4,60 L11.4,54.1 L2,54.1 L9.5,42.5 L4.2,43.5 L10.3,31.8 L6.4,32.8 L11.2,21.2 L8.6,22.2 L12.1,10.6 L10.8,11.6Z",59.0],[1349.6,211.2,27.0,51.4,"M13.5,1 L15.8,9.9 L14.4,8.9 L18.1,18.8 L15.3,17.8 L20.4,27.7 L16.2,26.7 L22.7,36.6 L17.2,35.6 L25,45.5 L15.1,45.5 L15.1,50.4 L11.9,50.4 L11.9,45.5 L2,45.5 L9.8,35.6 L4.3,36.6 L10.7,26.7 L6.6,27.7 L11.6,17.8 L8.9,18.8 L12.6,8.9 L11.2,9.9Z",49.4],[1361.8,189.6,28.7,74.1,"M14.3,1 L16.8,14 L15.3,13 L19.3,27 L16.3,26 L21.7,39.9 L17.3,38.9 L24.2,52.9 L18.3,51.9 L26.7,65.9 L15.9,65.9 L15.9,73.1 L12.7,73.1 L12.7,65.9 L2,65.9 L10.4,51.9 L4.5,52.9 L11.4,38.9 L6.9,39.9 L12.4,26 L9.4,27 L13.4,13 L11.9,14Z",72.1],[1381.1,225.5,28.6,40.1,"M14.3,1 L16.7,7.9 L15.3,6.9 L19.2,14.7 L16.3,13.7 L21.7,21.6 L17.2,20.6 L24.1,28.4 L18.2,27.4 L26.6,35.3 L15.9,35.3 L15.9,39.1 L12.7,39.1 L12.7,35.3 L2,35.3 L10.4,27.4 L4.5,28.4 L11.3,20.6 L6.9,21.6 L12.3,13.7 L9.4,14.7 L13.3,6.9 L11.8,7.9Z",38.1],[1415.6,210.1,26.7,57.9,"M13.4,1 L15.6,11.1 L14.3,10.1 L17.9,21.1 L15.2,20.1 L20.2,31.2 L16.1,30.2 L22.5,41.3 L17,40.3 L24.7,51.3 L15,51.3 L15,56.9 L11.8,56.9 L11.8,51.3 L2,51.3 L9.7,40.3 L4.3,41.3 L10.6,30.2 L6.5,31.2 L11.6,20.1 L8.8,21.1 L12.5,10.1 L11.1,11.1Z",55.9],[1677.2,215.2,23.6,48.4,"M11.8,1 L13.8,9.4 L12.6,8.4 L15.7,17.7 L13.4,16.7 L17.7,26.1 L14.2,25.1 L19.7,34.4 L14.9,33.4 L21.6,42.8 L13.4,42.8 L13.4,47.4 L10.2,47.4 L10.2,42.8 L2,42.8 L8.7,33.4 L4,34.4 L9.5,25.1 L5.9,26.1 L10.2,16.7 L7.9,17.7 L11,8.4 L9.8,9.4Z",46.4],[1700.1,205.5,25.0,56.1,"M12.5,1 L14.6,10.7 L13.3,9.7 L16.7,20.5 L14.2,19.5 L18.8,30.2 L15,29.2 L20.9,40 L15.8,39 L23,49.7 L14.1,49.7 L14.1,55.1 L10.9,55.1 L10.9,49.7 L2,49.7 L9.1,39 L4.1,40 L10,29.2 L6.2,30.2 L10.8,19.5 L8.3,20.5 L11.7,9.7 L10.4,10.7Z",54.1],[1709.1,216.8,23.2,44.2,"M11.6,1 L13.5,8.6 L12.4,7.6 L15.4,16.2 L13.1,15.2 L17.4,23.8 L13.9,22.8 L19.3,31.4 L14.7,30.4 L21.2,39 L13.2,39 L13.2,43.2 L10,43.2 L10,39 L2,39 L8.5,30.4 L3.9,31.4 L9.3,22.8 L5.8,23.8 L10.1,15.2 L7.8,16.2 L10.8,7.6 L9.7,8.6Z",42.2],[1730.4,186.2,22.9,73.5,"M11.4,1 L13.3,13.9 L12.2,12.9 L15.2,26.7 L12.9,25.7 L17.1,39.6 L13.7,38.6 L19,52.5 L14.4,51.5 L20.9,65.4 L13,65.4 L13,72.5 L9.8,72.5 L9.8,65.4 L2,65.4 L8.4,51.5 L3.9,52.5 L9.2,38.6 L5.8,39.6 L9.9,25.7 L7.7,26.7 L10.7,12.9 L9.5,13.9Z",71.5],[1747.7,207.3,25.7,51.9,"M12.9,1 L15,10 L13.7,9 L17.2,19 L14.6,18 L19.4,27.9 L15.5,26.9 L21.5,36.9 L16.3,35.9 L23.7,45.9 L14.5,45.9 L14.5,50.9 L11.3,50.9 L11.3,45.9 L2,45.9 L9.4,35.9 L4.2,36.9 L10.2,26.9 L6.3,27.9 L11.1,18 L8.5,19 L12,9 L10.7,10Z",49.9],[1778.8,196.0,20.3,62.9,"M10.2,1 L11.8,12 L10.8,11 L13.4,22.9 L11.5,21.9 L15.1,33.9 L12.1,32.9 L16.7,44.8 L12.8,43.8 L18.3,55.8 L11.8,55.8 L11.8,61.9 L8.6,61.9 L8.6,55.8 L2,55.8 L7.5,43.8 L3.6,44.8 L8.2,32.9 L5.3,33.9 L8.9,21.9 L6.9,22.9 L9.5,11 L8.5,12Z",60.9],[1777.6,183.3,27.8,75.6,"M13.9,1 L16.3,14.2 L14.8,13.2 L18.6,27.5 L15.8,26.5 L21,40.7 L16.7,39.7 L23.4,54 L17.7,53 L25.8,67.2 L15.5,67.2 L15.5,74.6 L12.3,74.6 L12.3,67.2 L2,67.2 L10.1,53 L4.4,54 L11,39.7 L6.8,40.7 L12,26.5 L9.1,27.5 L12.9,13.2 L11.5,14.2Z",73.6],[1784.6,211.6,29.9,47.3,"M15,1 L17.6,9.2 L16,8.2 L20.2,17.3 L17,16.3 L22.7,25.5 L18.1,24.5 L25.3,33.6 L19.1,32.6 L27.9,41.8 L16.6,41.8 L16.6,46.3 L13.4,46.3 L13.4,41.8 L2,41.8 L10.8,32.6 L4.6,33.6 L11.9,24.5 L7.2,25.5 L12.9,16.3 L9.8,17.3 L13.9,8.2 L12.4,9.2Z",45.3]],"cabin":[1292,260.5],"cross":[398,62.8],"cable":[1388,201.6,1480,105.4],"lamps":[[1752,72.5],[1779,87.4],[1806,93.9],[1835,98.1],[1862,111.6]],"moonX":490,"YS":226,"CX":400,"CY":266,"RX":245,"RY":40};
  var host = document.querySelector('.scenery');
  if (!host) return;
  var land = host.querySelector('.scenery-land') || host;
  var stage = document.createElement('div');
  stage.className = 'fx-stage';
  stage.setAttribute('aria-hidden', 'true');
  host.appendChild(stage);

  var css = document.createElement('style');
  css.textContent = [
    '.fx-stage{position:absolute;left:0;top:0;width:1920px;height:320px;transform-origin:0 0;pointer-events:none}',
    '.fx-stage div{position:absolute;pointer-events:none}',
    '.fx-lake{left:0;top:0;width:1920px;height:320px;clip-path:path("' + D.lake + '")}',
    '.fx-tree{transform-origin:50% 100%;animation:fxSway var(--d,4.4s) ease-in-out infinite}',
    '.fx-tree svg{display:block}',
    '.fx-wave{border-radius:50%;opacity:0;background:radial-gradient(ellipse at center,rgba(220,236,255,.8) 0,rgba(220,236,255,0) 70%);animation:fxWave var(--d,5s) ease-in-out infinite}',
    '.fx-streak{border-radius:50%;background:radial-gradient(ellipse at center,rgba(222,238,255,.62) 0,rgba(222,238,255,0) 70%);animation:fxDrift var(--d,6s) ease-in-out infinite alternate}',
    '.fx-gust{opacity:0;background:linear-gradient(90deg,rgba(188,214,255,0),rgba(207,226,255,.16),rgba(188,214,255,0));animation:fxGust var(--d,17s) linear infinite}',
    '.fx-mist{border-radius:50%;opacity:0;background:radial-gradient(ellipse at center,rgba(143,180,240,.22) 0,rgba(143,180,240,0) 70%);animation:fxMist var(--d,60s) linear infinite}',
    '.fx-star{border-radius:50%;background:#d8e9ff;opacity:.1;animation:fxTwinkle var(--d,4s) ease-in-out infinite}',
    '.fx-smoke{border-radius:50%;opacity:0;background:radial-gradient(circle,rgba(185,205,240,.55) 0,rgba(185,205,240,0) 70%);animation:fxSmoke 6.6s ease-out infinite}',
    '.fx-glow{border-radius:50%;background:radial-gradient(circle,rgba(255,207,112,.55) 0,rgba(255,207,112,0) 70%);animation:fxFlicker 5s ease-in-out infinite}',
    '.fx-glint{border-radius:50%;background:radial-gradient(circle,rgba(232,241,255,.55) 0,rgba(232,241,255,0) 70%);animation:fxGlint 6s ease-in-out infinite}',
    '.fx-gondola{border-radius:50%;background:#ffd9a0;box-shadow:0 0 3px rgba(255,217,160,.8);animation:fxGondola 52s linear infinite alternate}',
    '.fx-lamp{border-radius:50%;background:#fff1c1;opacity:.2;animation:fxTwinkle var(--d,4s) ease-in-out infinite}',
    '@keyframes fxSway{0%,100%{transform:rotate(calc(var(--a,1.2deg) * -0.8))}50%{transform:rotate(var(--a,1.2deg))}}',
    '@keyframes fxWave{0%{opacity:0;transform:translateX(-5px) scaleX(.55)}35%{opacity:.5}100%{opacity:0;transform:translateX(9px) scaleX(1.25)}}',
    '@keyframes fxDrift{from{transform:translateX(-8px)}to{transform:translateX(8px)}}',
    '@keyframes fxGust{0%{opacity:0;transform:translateX(0) skewX(-20deg)}18%{opacity:1}82%{opacity:1}100%{opacity:0;transform:translateX(930px) skewX(-20deg)}}',
    '@keyframes fxMist{0%{opacity:0;transform:translateX(-70px) scaleX(.9)}50%{opacity:var(--p,.8)}100%{opacity:0;transform:translateX(130px) scaleX(1.15)}}',
    '@keyframes fxTwinkle{0%,100%{opacity:.1}50%{opacity:.85}}',
    '@keyframes fxSmoke{0%{opacity:0;transform:translate(0,0) scale(.6)}15%{opacity:.5}100%{opacity:0;transform:translate(9px,-30px) scale(2.2)}}',
    '@keyframes fxFlicker{0%,100%{opacity:.85}35%{opacity:.55}60%{opacity:1}80%{opacity:.7}}',
    '@keyframes fxGlint{0%,100%{opacity:.15}50%{opacity:.75}}',
    '@keyframes fxGondola{to{transform:translate(var(--dx),var(--dy))}}'
  ].join('\n');
  document.head.appendChild(css);

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function box(parent, cls, x, y, w, h, vars) {
    var e = document.createElement('div');
    e.className = cls;
    e.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' + (vars || '');
    parent.appendChild(e);
    return e;
  }
  function delay(d) { return 'animation-delay:-' + rnd(0, d).toFixed(1) + 's;'; }

  /* Drzewa: kołyszą się w prawo i w lewo, wyższe mocniej. */
  D.trees.forEach(function (t) {
    var e = document.createElement('div');
    var dur = rnd(3.4, 6.4);
    e.className = 'fx-tree';
    e.style.cssText = 'left:' + t[0] + 'px;top:' + t[1] + 'px;width:' + t[2] + 'px;height:' + t[3] +
      'px;--d:' + dur.toFixed(1) + 's;--a:' + (t[5] > 55 ? 2.2 : 1.5) + 'deg;' + delay(dur);
    e.innerHTML = '<svg width="' + t[2] + '" height="' + t[3] + '" viewBox="0 0 ' + t[2] + ' ' + t[3] +
      '"><path d="' + t[4] + '" fill="#04070f"/></svg>';
    stage.appendChild(e);
  });

  /* Jezioro: fale od wiatru, pasma księżyca, podmuchy i odbite gwiazdy. */
  var lake = box(stage, 'fx-lake', 0, 0, 1920, 320);
  var top = D.YS + 4, bot = D.CY + D.RY - 7;
  for (var i = 0; i < 54; i++) {
    var y = rnd(top, bot);
    var v = (y - D.CY) / D.RY;
    var hw = D.RX * Math.sqrt(Math.max(0, 1 - v * v)) * 0.82;
    var depth = (y - D.YS) / (2 * D.RY);
    var w = (6 + depth * 15) * rnd(0.7, 1.3);
    if (hw < w + 6) continue;
    var x = D.CX + rnd(-hw + w, hw - w);
    var dur = rnd(3, 7);
    box(lake, 'fx-wave', (x - w).toFixed(1), (y - 1).toFixed(1), (2 * w).toFixed(1), (1.6 + depth * 2.2).toFixed(1),
      '--d:' + dur.toFixed(1) + 's;' + delay(dur));
  }
  [[7, 60], [17, 54], [28, 58], [40, 46], [51, 48], [62, 36], [71, 26]].forEach(function (s, q) {
    var dur = 4.5 + q * 0.9;
    box(lake, 'fx-streak', D.moonX - s[1] + rnd(-5, 5), D.YS + s[0] - 1.5, 2 * s[1], 2.6 + q * 0.6,
      '--d:' + dur.toFixed(1) + 's;' + delay(dur));
  });
  box(lake, 'fx-gust', -300, D.YS, 300, 2 * D.RY + 10, '--d:17s;animation-delay:0s;');
  box(lake, 'fx-gust', -300, D.YS, 240, 2 * D.RY + 10, '--d:26s;animation-delay:-9s;');
  for (var k = 0; k < 16; k++) {
    var sy = rnd(D.YS + 6, D.CY + D.RY - 8), sv = (sy - D.CY) / D.RY;
    var sh = D.RX * Math.sqrt(Math.max(0, 1 - sv * sv)) * 0.8;
    var sd = rnd(3, 6.5);
    var s0 = rnd(0.8, 1.5);
    box(lake, 'fx-star', (D.CX + rnd(-sh, sh)).toFixed(1), sy.toFixed(1), (2 * s0).toFixed(1), (2 * s0).toFixed(1),
      '--d:' + sd.toFixed(1) + 's;' + delay(sd));
  }

  /* Mgła nad lasem: powstaje losowo, dryfuje z wiatrem i znika. */
  for (var m = 0; m < 16; m++) {
    var rx = rnd(110, 260), ry = rnd(9, 22), md = rnd(42, 95);
    box(stage, 'fx-mist', (rnd(-60, 1960) - rx).toFixed(1), (rnd(176, 246) - ry).toFixed(1), (2 * rx).toFixed(1), (2 * ry).toFixed(1),
      '--d:' + md.toFixed(0) + 's;--p:' + rnd(0.55, 1).toFixed(2) + ';' + delay(md));
  }

  /* Domek, krzyż, kolejka i czołówki. */
  var cx = D.cabin[0], cy = D.cabin[1];
  box(stage, 'fx-glow', cx - 4 - 28, cy - 8 - 28, 56, 56);
  box(stage, 'fx-glow', cx - 4 - 24, cy + 1 - 5, 48, 10);
  for (var q = 0; q < 3; q++) {
    box(stage, 'fx-smoke', cx + 9.2 - 3.5, cy - 35 - 3.5, 7, 7, 'animation-delay:-' + (q * 2.2).toFixed(1) + 's;');
  }
  box(stage, 'fx-glint', D.cross[0] - 7, D.cross[1] - 6 - 7, 14, 14);
  var c = D.cable;
  box(stage, 'fx-gondola', c[2] - 1.7, c[3] + 2 - 1.7, 3.4, 3.4, '--dx:' + (c[0] - c[2]) + 'px;--dy:' + (c[1] - c[3] - 2) + 'px;');
  D.lamps.forEach(function (l, n) {
    var d = 3 + n * 0.7;
    box(stage, 'fx-lamp', l[0] - 0.95, l[1] - 1.95, 1.9, 1.9, '--d:' + d.toFixed(1) + 's;animation-delay:-' + (n * 1.3).toFixed(1) + 's;');
  });

  /* Dopasowanie do tła: cover, przyklejone do dołu, pozioma pozycja z CSS. */
  function layout() {
    var cw = host.clientWidth, ch = host.clientHeight;
    if (!cw || !ch) return;
    var s = Math.max(cw / 1920, ch / 320);
    var px = getComputedStyle(land).backgroundPositionX;
    var pct = /%$/.test(px) ? parseFloat(px) / 100 : 0.5;
    stage.style.transform = 'translate(' + ((cw - 1920 * s) * pct).toFixed(2) + 'px,' + (ch - 320 * s).toFixed(2) + 'px) scale(' + s.toFixed(4) + ')';
  }
  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('pageshow', layout);
})();
