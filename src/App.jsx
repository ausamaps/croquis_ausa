import { Stage, Layer, Rect, Image as KonvaImage, Transformer, Line } from "react-konva";
import { useState, useEffect, useRef, useCallback } from "react";
import useImage from "use-image";
const BASE = import.meta.env.BASE_URL;

const C = {
  appBg:   "#030810",
  panelBg: "#060d18",
  cyan:    "#00d8ff",
  cyanDim: "#0a3a50",
  cyanMid: "#006070",
  text:    "#c0dce8",
  textMid: "#5a9ab0",
  textDim: "#1e4a5e",
  red:     "#ff2040",
};

function parseDSL(buf) {
  const d = new Uint8Array(buf);
  const find = (seq, from) => {
    outer: for (let i = from; i <= d.length - seq.length; i++) {
      for (let j = 0; j < seq.length; j++) if (d[i+j] !== seq[j]) continue outer;
      return i;
    }
    return -1;
  };
  const PNG  = [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
  const IEND = [0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82];
  const out = [];
  let pos = 7;
  while (pos < d.length - 10) {
    const nl = d[pos];
    if (nl >= 3 && nl <= 80 && pos+nl+1 < d.length) {
      const nb = d.slice(pos+1, pos+1+nl);
      if (nb.every(b => b>=32 && b<127) && d[pos+1+nl]===0) {
        const name = String.fromCharCode(...nb);
        const pi = find(PNG, pos+1+nl+1);
        if (pi !== -1 && pi-(pos+1+nl+1) < 200) {
          const ii = find(IEND, pi);
          if (ii !== -1) { out.push({name, pngData:d.slice(pi, ii+IEND.length)}); pos=ii+IEND.length; continue; }
        }
      }
    }
    pos++;
  }
  return out;
}

const upscale = bytes => new Promise(res => {
  const url = URL.createObjectURL(new Blob([bytes], {type:"image/png"}));
  const img = new Image();
  img.onload = () => {
    const c = Object.assign(document.createElement("canvas"), {width:128, height:128});
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, 128, 128); URL.revokeObjectURL(url); res(c.toDataURL("image/png"));
  };
  img.onerror = () => { URL.revokeObjectURL(url); res(null); };
  img.src = url;
});

let _id = 1;
const uid = () => `e${_id++}`;
const CW = 800, CH = 600, GRID = 15;
const snapV = v => Math.round(v / GRID) * GRID;

const BUILTIN = {
  "Vehículos": [
    {slug:"auto_medio",label:"Auto mediano",src:`${BASE}assets/lib/auto_medio.svg`,w:40,h:70},
    {slug:"auto_chico",label:"Auto chico",src:`${BASE}assets/lib/auto_chico.svg`,w:36,h:65},
    {slug:"car_mid",label:"Auto mediano 2",src:`${BASE}assets/lib/car_mid.svg`,w:40,h:70},
    {slug:"car_compact",label:"Auto compacto",src:`${BASE}assets/lib/car_compact.svg`,w:36,h:65},
    {slug:"car_veh2",label:"Auto top-view",src:`${BASE}assets/lib/car_veh2.svg`,w:40,h:70},
    {slug:"van",label:"Camioneta",src:`${BASE}assets/lib/van.svg`,w:50,h:70},
    {slug:"minivan",label:"Minivan",src:`${BASE}assets/lib/minivan.svg`,w:50,h:70},
    {slug:"pickup",label:"Pickup",src:`${BASE}assets/lib/pickup.svg`,w:44,h:70},
    {slug:"trailer",label:"Trailer",src:`${BASE}assets/lib/trailer.svg`,w:100,h:45},
    {slug:"truck_veh",label:"Camión",src:`${BASE}assets/lib/truck_veh.svg`,w:100,h:45},
    {slug:"camion_vuelco",label:"Camión vuelco",src:`${BASE}assets/lib/camion_vuelco.svg`,w:70,h:55},
    {slug:"grua",label:"Grúa",src:`${BASE}assets/lib/grua.svg`,w:90,h:45},
    {slug:"moto_arriba",label:"Moto",src:`${BASE}assets/lib/moto_arriba.svg`,w:30,h:60},
    {slug:"volcado",label:"Veh. volcado",src:`${BASE}assets/lib/volcado.svg`,w:70,h:50},
    {slug:"persona",label:"Persona",src:`${BASE}assets/lib/persona.svg`,w:25,h:55},
  ],
  "Calles y vías": [
    {slug:"road_cross_2",label:"Cruce 2 carriles",src:`${BASE}assets/lib/road_cross_2.svg`,w:120,h:120},
    {slug:"road_4lane_v",label:"4 carriles vert.",src:`${BASE}assets/lib/road_4lane_v.svg`,w:60,h:120},
    {slug:"road_t_top",label:"T-inter. arriba",src:`${BASE}assets/lib/road_t_top.svg`,w:120,h:90},
    {slug:"road_t_bot",label:"T-inter. abajo",src:`${BASE}assets/lib/road_t_bot.svg`,w:120,h:90},
    {slug:"road_curve_2l",label:"Curva 2c izq.",src:`${BASE}assets/lib/road_curve_2l.svg`,w:100,h:100},
    {slug:"road_curve_2r",label:"Curva 2c der.",src:`${BASE}assets/lib/road_curve_2r.svg`,w:100,h:100},
    {slug:"road_curve_4r",label:"Curva 4c der.",src:`${BASE}assets/lib/road_curve_4r.svg`,w:100,h:100},
    {slug:"road_y",label:"Y-intersec.",src:`${BASE}assets/lib/road_y.svg`,w:100,h:100},
    {slug:"road_3junc",label:"Bifurc. 3",src:`${BASE}assets/lib/road_3junc.svg`,w:100,h:100},
    {slug:"road_junc_l",label:"Empalme izq.",src:`${BASE}assets/lib/road_junc_l.svg`,w:100,h:100},
    {slug:"road_junc_r",label:"Empalme der.",src:`${BASE}assets/lib/road_junc_r.svg`,w:100,h:100},
    {slug:"railroad_cross",label:"Cruce ferrov.",src:`${BASE}assets/lib/railroad_cross.svg`,w:100,h:100},
  ],
  "Señales": [
    {slug:"sign_stop",label:"PARE",src:`${BASE}assets/lib/sign_stop.svg`,w:40,h:40},
    {slug:"sign_traffic_light",label:"Semáforo",src:`${BASE}assets/lib/sign_traffic_light.svg`,w:30,h:55},
    {slug:"sign_all_way",label:"Todos pasan",src:`${BASE}assets/lib/sign_all_way.svg`,w:40,h:40},
    {slug:"sign_wrong_way",label:"Contramano",src:`${BASE}assets/lib/sign_wrong_way.svg`,w:40,h:40},
    {slug:"sign_left",label:"Doblar izq.",src:`${BASE}assets/lib/sign_left.svg`,w:40,h:40},
    {slug:"sign_right",label:"Doblar der.",src:`${BASE}assets/lib/sign_right.svg`,w:40,h:40},
    {slug:"sign_ped_ahead",label:"Peatones",src:`${BASE}assets/lib/sign_ped_ahead.svg`,w:40,h:40},
    {slug:"sign_school",label:"Escuela",src:`${BASE}assets/lib/sign_school.svg`,w:40,h:40},
    {slug:"sign_curve",label:"Curva",src:`${BASE}assets/lib/sign_curve.svg`,w:40,h:40},
    {slug:"sign_two_way",label:"Doble mano",src:`${BASE}assets/lib/sign_two_way.svg`,w:40,h:40},
  ],
  "Entorno": [
    {slug:"tree",label:"Árbol",src:`${BASE}assets/lib/tree.svg`,w:40,h:50},
    {slug:"fir",label:"Pino",src:`${BASE}assets/lib/fir.svg`,w:35,h:55},
    {slug:"house",label:"Casa",src:`${BASE}assets/lib/house.svg`,w:55,h:50},
    {slug:"gas_station",label:"Est. servicio",src:`${BASE}assets/lib/gas_station.svg`,w:55,h:50},
    {slug:"compass",label:"Norte",src:`${BASE}assets/lib/compass.svg`,w:50,h:50},
    {slug:"park",label:"Parque",src:`${BASE}assets/lib/park.svg`,w:55,h:55},
  ],
  "Fotos propias": [
    {slug:"u_auto",label:"Auto (foto)",src:`${BASE}assets/auto.png`,w:50,h:85},
    {slug:"u_moto",label:"Moto (foto)",src:`${BASE}assets/moto.png`,w:75,h:55},
    {slug:"u_camion",label:"Camión (foto)",src:`${BASE}assets/camion.png`,w:130,h:55},
    {slug:"u_peaton",label:"Peatón (foto)",src:`${BASE}assets/peaton.png`,w:40,h:85},
    {slug:"u_calle",label:"Calle recta",src:`${BASE}assets/calle_recta.png`,w:180,h:75},
    {slug:"u_rotonda",label:"Rotonda",src:`${BASE}assets/rotonda.png`,w:110,h:110},
    {slug:"u_semaf",label:"Semáforo (foto)",src:`${BASE}assets/semaforo.png`,w:45,h:90},
    {slug:"u_stop",label:"STOP (foto)",src:`${BASE}assets/senial_stop.png`,w:50,h:90},
  ],
};
const GRP_ICON = {"Vehículos":"🚗","Calles y vías":"🛣️","Señales":"🚦","Entorno":"🌳","Fotos propias":"📷"};

function CornerBrackets({color="#00d8ff",size=14,lw=2,opacity=0.85}) {
  const s={width:size,height:size,position:"absolute",pointerEvents:"none",zIndex:20};
  const b=`${lw}px solid ${color}`;
  return(<>
    <div style={{...s,top:0,left:0,borderTop:b,borderLeft:b,opacity}}/>
    <div style={{...s,top:0,right:0,borderTop:b,borderRight:b,opacity}}/>
    <div style={{...s,bottom:0,left:0,borderBottom:b,borderLeft:b,opacity}}/>
    <div style={{...s,bottom:0,right:0,borderBottom:b,borderRight:b,opacity}}/>
  </>);
}

function HudPanel({children,style}) {
  return(
    <div className="hud-panel" style={{position:"relative",...style}}>
      <CornerBrackets/>
      {children}
    </div>
  );
}

function HudBtn({icon,label,onClick,disabled,active,danger}) {
  const cls=["hud-btn",active?"active":"",danger?"danger":""].filter(Boolean).join(" ");
  return(<button className={cls} onClick={onClick} disabled={disabled}>
    <span className="btn-icon">{icon}</span>
    <span style={{flex:1}}>{label}</span>
  </button>);
}

function GroupRow({label,count,open,onToggle,onRemove}) {
  return(
    <div style={{display:"flex",alignItems:"center",marginBottom:2}}>
      <div className="lib-group-row" onClick={onToggle} style={{flex:1}}>
        <div className="lib-group-icon">{GRP_ICON[label]||"📁"}</div>
        <span className="lib-group-label">{label}<span style={{color:"#5a9ab0",fontWeight:400,fontSize:11}}> ({count})</span></span>
        <i className={`lib-group-chevron ${open?"open":""}`}>∨</i>
      </div>
      {onRemove&&(<button onClick={onRemove}
        style={{marginLeft:4,padding:"4px 7px",background:"transparent",border:"1px solid #0a3a50",
          borderRadius:6,color:"#1e4a5e",cursor:"pointer",fontSize:10,transition:"all 0.1s"}}
        onMouseEnter={e=>{e.currentTarget.style.color="#ff2040";e.currentTarget.style.borderColor="#ff2040";}}
        onMouseLeave={e=>{e.currentTarget.style.color="#1e4a5e";e.currentTarget.style.borderColor="#0a3a50";}}>✕</button>)}
    </div>
  );
}

function LibItem({label,src,onAdd,onDragStart,onDragEnd}) {
  return(
    <div className="lib-item" draggable onClick={onAdd}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title="Arrastrar al canvas">
      <img src={src} alt={label} style={{width:24,height:24,objectFit:"contain",flexShrink:0,imageRendering:"auto"}}/>
      <span>{label}</span>
    </div>
  );
}

function CanvasEl({el,isSel,onSel,onChange,snap}) {
  const src=el.dataUrl||el.src||`${BASE}assets/lib/${el.slug}.png`;
  const [img]=useImage(src);
  const ref=useRef(null),tr=useRef(null);
  useEffect(()=>{
    if(isSel&&tr.current&&ref.current){tr.current.nodes([ref.current]);tr.current.getLayer()?.batchDraw();}
  },[isSel]);
  return(<>
    <KonvaImage ref={ref} id={el.id} image={img} x={el.x} y={el.y}
      width={el.w} height={el.h} rotation={el.r||0} draggable
      onClick={onSel} onTap={onSel}
      onDragEnd={e=>onChange({x:snap?snapV(e.target.x()):e.target.x(),y:snap?snapV(e.target.y()):e.target.y()})}
      onTransformEnd={()=>{const n=ref.current;onChange({x:n.x(),y:n.y(),
        w:Math.max(8,n.width()*n.scaleX()),h:Math.max(8,n.height()*n.scaleY()),r:n.rotation()});
        n.scaleX(1);n.scaleY(1);}}
    />
    {isSel&&<Transformer ref={tr} borderStroke="#00d8ff" borderStrokeWidth={1.5}
      anchorStroke="#00d8ff" anchorFill="#060d18" anchorSize={8} keepRatio={false}
      boundBoxFunc={(o,n)=>n.width<8||n.height<8?o:n}/>}
  </>);
}

function HeaderBtn({children,onClick,disabled,title}) {
  const [hov,setHov]=useState(false);
  return(
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",
        background:hov&&!disabled?"rgba(0,216,255,0.08)":"transparent",
        border:`1px solid ${hov&&!disabled?"#006070":"#0a3a50"}`,
        borderRadius:7,color:disabled?"#1e4a5e":hov?"#c0dce8":"#5a9ab0",
        cursor:disabled?"not-allowed":"pointer",fontSize:16,fontWeight:700,transition:"all 0.12s"}}>
      {children}
    </button>
  );
}

function PreviewModal({lib,onConfirm,onCancel}) {
  const [sel,setSel]=useState(null);
  if(!lib)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(2,6,12,0.92)",
      backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:700,maxWidth:"92vw",maxHeight:"85vh",display:"flex",flexDirection:"column",
        background:"#060d18",border:"1px solid #0a3a50",borderRadius:4,overflow:"hidden",position:"relative"}}>
        <CornerBrackets size={16} lw={2} opacity={0.9}/>
        <div style={{height:2,background:"linear-gradient(90deg,transparent,#00d8ff,transparent)",opacity:0.5}}/>
        <div style={{padding:"14px 20px",flexShrink:0,borderBottom:"1px solid #0a3a50",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#00d8ff",letterSpacing:2,textTransform:"uppercase"}}>{lib.name}</div>
            <div style={{fontSize:10,color:"#1e4a5e",marginTop:3}}>{lib.shapes.length} elementos</div>
          </div>
          <button onClick={onCancel} className="hud-btn" style={{width:"auto",padding:"0 14px",marginBottom:0}}>✕ Cerrar</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(86px,1fr))",gap:6}}>
            {lib.shapes.map((s,i)=>(
              <div key={i} onClick={()=>setSel(sel===i?null:i)}
                style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 6px 8px",gap:6,
                  cursor:"pointer",borderRadius:10,background:sel===i?"rgba(0,216,255,0.1)":"rgba(6,13,24,0.9)",
                  border:`1px solid ${sel===i?"#00d8ff":"#0a3a50"}`,transition:"all 0.12s"}}>
                <img src={s.dataUrl} alt={s.name} style={{width:52,height:52,objectFit:"contain"}}/>
                <span style={{fontSize:8.5,color:sel===i?"#00d8ff":"#1e4a5e",textAlign:"center",lineHeight:1.3,
                  overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",width:"100%"}}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{padding:"12px 20px",flexShrink:0,borderTop:"1px solid #0a3a50",display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="hud-btn" onClick={onCancel} style={{width:"auto",padding:"0 16px",marginBottom:0}}>Cancelar</button>
          <button className="hud-btn" onClick={()=>onConfirm(lib,null)} style={{width:"auto",padding:"0 16px",marginBottom:0}}>+ Todo ({lib.shapes.length})</button>
          <button className={`hud-btn ${sel!==null?"active":""}`} disabled={sel===null}
            onClick={()=>sel!==null&&onConfirm(lib,sel)} style={{width:"auto",padding:"0 16px",marginBottom:0}}>
            {sel!==null?`+ "${lib.shapes[sel].name}"`:"Seleccioná un shape"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// APP — KEY ARCHITECTURE:
// The Konva Stage is ALWAYS CW×CH pixels. NEVER changes size.
// Zoom = CSS transform:scale() on the div wrapping the Stage.
// Pan  = CSS left/top positioning of that wrapper div.
// The viewport div clips with overflow:hidden.
// This means the canvas white area is ALWAYS the same physical size —
// only its visible portion changes when zooming.
// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  const stageRef  = useRef(null);
  const canvasRef = useRef(null);
  const draggedLibItemRef = useRef(null);

  // Canvas is ALWAYS CW×CH — no measurement needed
  // zoom: how much content is magnified inside the fixed white box
  // pan: offset of content inside the white box (only relevant when zoom > 1)
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({x:0, y:0});

  const [els,     setEls]     = useState([]);
  const [selId,   setSelId]   = useState(null);
  const [grid,    setGrid]    = useState(true);
  const [snap,    setSnap]    = useState(true);
  const [hist,    setHist]    = useState([[]]);
  const [hi,      setHi]      = useState(0);
  const [dynLibs, setDynLibs] = useState([]);
  const [openGrp, setOpenGrp] = useState({});
  const [preview, setPreview] = useState(null);

  const isOpen = g => openGrp[g] === true;
  const toggle = g => setOpenGrp(p => ({...p, [g]: !p[g]}));

  // Clamp pan so content never exposes the white background beyond the drawing area
  // When zoomed in: content can pan but never go outside the CW×CH area
  const clampPan = useCallback((px, py, z) => {
    // How much the scaled content overflows the fixed CW×CH box
    const overW = CW * (z - 1);
    const overH = CH * (z - 1);
    return {
      x: Math.min(0, Math.max(-overW, px)),
      y: Math.min(0, Math.max(-overH, py)),
    };
  }, []);

  // Wheel zoom: zoom toward cursor position inside the white canvas
  const onCanvasWheel = useCallback(e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZ = Math.max(1, Math.min(4, zoom * factor));  // min=1 (100%), max=4 (400%)
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;  // cursor x inside white canvas
    const cy = e.clientY - rect.top;
    // Canvas logical coords under cursor at current zoom
    const lx = (cx - pan.x) / zoom;
    const ly = (cy - pan.y) / zoom;
    // New pan keeping same logical point under cursor
    const newPan = clampPan(cx - lx * newZ, cy - ly * newZ, newZ);
    setZoom(newZ);
    setPan(newPan);
  }, [zoom, pan, clampPan]);

  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    el.addEventListener("wheel", onCanvasWheel, {passive: false});
    return () => el.removeEventListener("wheel", onCanvasWheel);
  }, [onCanvasWheel]);

  // Zoom to exact scale, centered
  const zoomTo = useCallback((newZ) => {
    const z = Math.max(1, Math.min(4, newZ));
    setZoom(z);
    // Center the content when zooming via buttons
    setPan(clampPan(-(CW * (z-1)) / 2, -(CH * (z-1)) / 2, z));
  }, [clampPan]);

  // Reset to 100% centered
  const fitView = useCallback(() => {
    setZoom(1);
    setPan({x:0, y:0});
  }, []);

  // canvasSize is always CW×CH (used only to trigger Stage render)
  const canvasSize = {w: CW, h: CH};

  // History
  const pushH = useCallback(e => {
    setHist(h => [...h.slice(0, hi+1), JSON.parse(JSON.stringify(e))].slice(-50));
    setHi(i => Math.min(i+1, 49));
  }, [hi]);
  const undo = useCallback(() => {
    if (hi <= 0) return;
    const i = hi-1; setEls(JSON.parse(JSON.stringify(hist[i]))); setHi(i); setSelId(null);
  }, [hi, hist, setEls, setHi, setSelId]);
  const redo = useCallback(() => {
    if (hi >= hist.length-1) return;
    const i = hi+1; setEls(JSON.parse(JSON.stringify(hist[i]))); setHi(i);
  }, [hi, hist, setEls, setHi]);

  // Keyboard
  useEffect(() => {
    const h = e => {
      if (document.activeElement?.tagName === "INPUT") return;
      if ((e.ctrlKey||e.metaKey) && e.key==="z") { e.preventDefault(); undo(); }
      if ((e.ctrlKey||e.metaKey) && e.key==="y") { e.preventDefault(); redo(); }
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key) && selId) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const dx = e.key==="ArrowLeft" ? -step : e.key==="ArrowRight" ? step : 0;
        const dy = e.key==="ArrowUp" ? -step : e.key==="ArrowDown" ? step : 0;
        const n = els.map(el => {
          if (el.id !== selId) return el;
          return {
            ...el,
            x: Math.max(0, Math.min(CW - el.w, el.x + dx)),
            y: Math.max(0, Math.min(CH - el.h, el.y + dy)),
          };
        });
        setEls(n);
        pushH(n);
      }
      if ((e.key==="Delete"||e.key==="Backspace") && selId) {
        const n=els.filter(e=>e.id!==selId); setEls(n); pushH(n); setSelId(null);
      }
      if (e.key==="Escape") { setSelId(null); setPreview(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selId, els, pushH, undo, redo]);

  // Element ops
  const addEl = (item, pos) => {
    const w=item.w||60, h=item.h||60;
    const baseX = pos ? pos.x - w / 2 : CW / 2 - w / 2;
    const baseY = pos ? pos.y - h / 2 : CH / 2 - h / 2;
    const x = Math.max(0, Math.min(CW - w, snap ? snapV(baseX) : baseX));
    const y = Math.max(0, Math.min(CH - h, snap ? snapV(baseY) : baseY));
    const e = { id:uid(), slug:item.slug, src:item.src, dataUrl:item.dataUrl,
      label:item.label||item.name,
      x, y,
      w, h, r:0 };
    const n = [...els, e]; setEls(n); pushH(n); setSelId(e.id);
  };
  const updEl = (id, p) => { const n=els.map(e=>e.id===id?{...e,...p}:e); setEls(n); pushH(n); };
  const delSel = () => {
    if (!selId) return;
    const n=els.filter(e=>e.id!==selId); setEls(n); pushH(n); setSelId(null);
  };
  const moveZ = dir => {
    if (!selId) return;
    const i=els.findIndex(e=>e.id===selId); if(i===-1) return;
    const a=[...els];
    if (dir==="up"    && i<a.length-1) [a[i],a[i+1]]=[a[i+1],a[i]];
    if (dir==="down"  && i>0)           [a[i],a[i-1]]=[a[i-1],a[i]];
    if (dir==="front") { const[e]=a.splice(i,1); a.push(e); }
    if (dir==="back")  { const[e]=a.splice(i,1); a.unshift(e); }
    setEls(a); pushH(a);
  };

  const startLibDrag = (item, e) => {
    draggedLibItemRef.current = item;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", item.label || item.name || item.slug || "elemento");
  };

  const clearLibDrag = () => {
    draggedLibItemRef.current = null;
  };

  const onCanvasDragOver = e => {
    if (!draggedLibItemRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onCanvasDrop = e => {
    const item = draggedLibItemRef.current;
    if (!item) return;
    e.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    addEl(item, {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    });
    clearLibDrag();
  };

  const loadDSL=()=>{
    const inp=Object.assign(document.createElement("input"),{type:"file",accept:".dsl",multiple:true});
    inp.onchange=async e=>{
      for(const f of Array.from(e.target.files)){
        const name=f.name.replace(/\.dsl$/i,"");
        if(dynLibs.some(l=>l.name===name))continue;
        try{
          const raw=parseDSL(await f.arrayBuffer());
          const shapes=await Promise.all(raw.map(async s=>({name:s.name,dataUrl:await upscale(s.pngData)})));
          setPreview({name,shapes:shapes.filter(s=>s.dataUrl)});
        }catch(err){console.error(err);}
      }
    };inp.click();
  };
  const confirmPreview=(lib,idx)=>{
    setPreview(null);
    if(idx===null)setDynLibs(p=>[...p,lib]);
    else addEl({label:lib.shapes[idx].name,dataUrl:lib.shapes[idx].dataUrl,w:60,h:60});
  };
  const save=()=>{
    const b=new Blob([JSON.stringify({els,v:3},null,2)],{type:"application/json"});
    Object.assign(document.createElement("a"),{href:URL.createObjectURL(b),download:"croquis.json"}).click();
  };
  const loadF=()=>{
    const i=Object.assign(document.createElement("input"),{type:"file",accept:".json"});
    i.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
      r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.els){setEls(d.els);pushH(d.els);setSelId(null);}}catch(err){console.error(err);}};
      r.readAsText(f);};i.click();
  };
  const expPNG=()=>{
    const p=selId;setSelId(null);
    setTimeout(()=>{const u=stageRef.current?.toDataURL({pixelRatio:2});
      if(u)Object.assign(document.createElement("a"),{href:u,download:"croquis.png"}).click();
      setSelId(p);},60);
  };

  // Grid lines
  // Grid lines fill exactly CW×CH — the white box IS the canvas boundary
  const gridLines = [];
  if (grid) {
    for (let i = 0; i <= CW / GRID; i++)
      gridLines.push(<Line key={`v${i}`} points={[i*GRID, 0, i*GRID, CH]}
        stroke={i%4===0 ? "rgba(0,180,215,0.22)" : "rgba(0,180,215,0.09)"}
        strokeWidth={i%4===0 ? 0.8 : 0.35} />);
    for (let i = 0; i <= CH / GRID; i++)
      gridLines.push(<Line key={`h${i}`} points={[0, i*GRID, CW, i*GRID]}
        stroke={i%4===0 ? "rgba(0,180,215,0.22)" : "rgba(0,180,215,0.09)"}
        strokeWidth={i%4===0 ? 0.8 : 0.35} />);
  }

  const selEl=els.find(e=>e.id===selId);
  const libDef=selEl?Object.values(BUILTIN).flat().find(l=>l.slug===selEl.slug):null;

  const tbBtn=active=>({
    height:28,padding:"0 10px",display:"flex",alignItems:"center",gap:5,
    background:active?"rgba(0,216,255,0.15)":"rgba(6,13,24,0.8)",
    border:`1px solid ${active?"#00d8ff":"#0a3a50"}`,
    borderRadius:6,color:active?"#00d8ff":"#5a9ab0",
    cursor:"pointer",fontSize:11,fontWeight:600,letterSpacing:0.5,
    boxShadow:active?"0 0 10px rgba(0,216,255,0.2)":"none",transition:"all 0.12s",
  });

  return(
    <div className="hud-app">
      {preview&&<PreviewModal lib={preview} onConfirm={confirmPreview} onCancel={()=>setPreview(null)}/>}

      {/* TOP BAR */}
      <div style={{height:52,flexShrink:0,position:"relative",
        background:"linear-gradient(180deg,#081426 0%,#060d18 100%)",
        borderBottom:"1px solid #0a3a50",
        display:"flex",alignItems:"center",padding:"0 14px"}}>
        <svg style={{position:"absolute",left:290,top:0,height:"100%",width:40,pointerEvents:"none"}}
          viewBox="0 0 40 52" preserveAspectRatio="none">
          <line x1="0" y1="52" x2="40" y2="0" stroke="#0d3a52" strokeWidth="1.5"/>
        </svg>
        <svg style={{position:"absolute",right:250,top:0,height:"100%",width:40,pointerEvents:"none"}}
          viewBox="0 0 40 52" preserveAspectRatio="none">
          <line x1="40" y1="52" x2="0" y2="0" stroke="#0d3a52" strokeWidth="1.5"/>
        </svg>

        <div style={{display:"flex",alignItems:"center",gap:6,zIndex:1}}>
          <HeaderBtn onClick={undo} disabled={hi<=0} title="Deshacer">‹</HeaderBtn>
          <HeaderBtn onClick={redo} disabled={hi>=hist.length-1} title="Rehacer">↺</HeaderBtn>
          <div style={{display:"flex",alignItems:"center",background:"rgba(6,13,24,0.9)",
            border:"1px solid #0a3a50",borderRadius:7,overflow:"hidden",height:28}}>
            <button onClick={()=>zoomTo(zoom/1.15)}
              style={{width:26,height:"100%",background:"transparent",border:"none",
                borderRight:"1px solid #0a3a50",color:"#5a9ab0",fontSize:14,cursor:"pointer"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,216,255,0.1)";e.currentTarget.style.color="#00d8ff";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#5a9ab0";}}>−</button>
            <span style={{minWidth:48,textAlign:"center",fontSize:11,fontWeight:700,color:"#00d8ff"}}>{Math.round(zoom*100)}%</span>
            <button onClick={()=>zoomTo(zoom*1.15)}
              style={{width:26,height:"100%",background:"transparent",border:"none",
                borderLeft:"1px solid #0a3a50",color:"#5a9ab0",fontSize:14,cursor:"pointer"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,216,255,0.1)";e.currentTarget.style.color="#00d8ff";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#5a9ab0";}}>+</button>
          </div>
        </div>

        <h1 style={{position:"absolute",left:"50%",transform:"translateX(-50%)",
          margin:0,fontSize:18,fontWeight:800,letterSpacing:5,color:"#00d8ff",
          textTransform:"uppercase",whiteSpace:"nowrap",zIndex:1,
          textShadow:"0 0 24px rgba(0,216,255,0.7),0 0 50px rgba(0,216,255,0.25)",
          fontFamily:"'Exo 2','Segoe UI',sans-serif"}}>
          Editor de Croquis de Seguridad Vial
        </h1>

        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,zIndex:1}}>
          <HeaderBtn onClick={fitView} title="Ajustar vista">⊡</HeaderBtn>
          <div style={{width:1,height:18,background:"#0a3a50"}}/>
          <HeaderBtn title="Configuración">☀</HeaderBtn>
          <HeaderBtn title="Perfil">☺</HeaderBtn>
          <HeaderBtn title="Cerrar">×</HeaderBtn>
        </div>
      </div>

      {/* SECONDARY TOOLBAR */}
      <div style={{height:40,flexShrink:0,background:"#030810",
        borderBottom:"1px solid #0a3a50",
        display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"0 14px"}}>
        {[{icon:"↩",act:undo,dis:hi<=0},{icon:"↪",act:redo,dis:hi>=hist.length-1}].map((b,i)=>(
          <button key={i} onClick={b.act} disabled={b.dis}
            style={{...tbBtn(false),padding:0,width:28,justifyContent:"center",opacity:b.dis?0.3:1,cursor:b.dis?"not-allowed":"pointer"}}
            onMouseEnter={e=>{if(!b.dis){e.currentTarget.style.borderColor="#00d8ff";e.currentTarget.style.color="#00d8ff";e.currentTarget.style.background="rgba(0,216,255,0.08)";}}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#0a3a50";e.currentTarget.style.color="#5a9ab0";e.currentTarget.style.background="rgba(6,13,24,0.8)";}}>
            {b.icon}
          </button>
        ))}
        <div style={{display:"flex",alignItems:"center",background:"rgba(6,13,24,0.9)",
          border:"1px solid #0a3a50",borderRadius:6,overflow:"hidden",height:28}}>
          <button onClick={()=>zoomTo(zoom/1.1)}
            style={{width:26,height:"100%",background:"transparent",border:"none",
              borderRight:"1px solid #0a3a50",color:"#5a9ab0",fontSize:14,cursor:"pointer"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,216,255,0.1)";e.currentTarget.style.color="#00d8ff";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#5a9ab0";}}>−</button>
          <span style={{minWidth:48,textAlign:"center",fontSize:11,fontWeight:700,color:"#00d8ff"}}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>zoomTo(zoom*1.1)}
            style={{width:26,height:"100%",background:"transparent",border:"none",
              borderLeft:"1px solid #0a3a50",color:"#5a9ab0",fontSize:14,cursor:"pointer"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,216,255,0.1)";e.currentTarget.style.color="#00d8ff";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#5a9ab0";}}>+</button>
        </div>
        <div style={{display:"flex",alignItems:"center",background:"rgba(6,13,24,0.9)",
          border:"1px solid #0a3a50",borderRadius:6,overflow:"hidden",height:28}}>
          <button onClick={()=>setGrid(v=>!v)}
            style={{...tbBtn(grid),height:28,borderRadius:0,border:"none",borderRight:"1px solid #0a3a50"}}>⊞ GRILLA</button>
          <button onClick={()=>setSnap(v=>!v)}
            style={{...tbBtn(snap),height:28,borderRadius:0,border:"none"}}>⊹ SNAP</button>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{flex:1,display:"flex",overflow:"hidden",padding:"8px",gap:"6px",background:"#030810",alignItems:"flex-start"}}>

        {/* LEFT PANEL */}
        <HudPanel style={{width:280,flexShrink:0,display:"flex",flexDirection:"column",background:"#060d18"}}>
          <div className="panel-title-bar" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:15,fontWeight:800,letterSpacing:2,color:"#00d8ff",
              textTransform:"uppercase",fontFamily:"'Exo 2',sans-serif",
              textShadow:"0 0 10px rgba(0,216,255,0.4)"}}>Librería</span>
            <button onClick={loadDSL}
              style={{padding:"4px 12px",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",
                background:"linear-gradient(135deg,rgba(0,216,255,0.22),rgba(0,100,130,0.12))",
                border:"1.5px solid #00d8ff",borderRadius:20,color:"#00d8ff",cursor:"pointer",
                boxShadow:"0 0 10px rgba(0,216,255,0.22)",transition:"all 0.13s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,216,255,0.32)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="linear-gradient(135deg,rgba(0,216,255,0.22),rgba(0,100,130,0.12))";}}>
              + DSL
            </button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
            {Object.entries(BUILTIN).map(([g,items])=>(
              <div key={g} style={{marginBottom:3}}>
                <GroupRow label={g} count={items.length} open={isOpen(g)} onToggle={()=>toggle(g)}/>
                {isOpen(g)&&(<div style={{paddingLeft:6,paddingBottom:4}}>
                  {items.map(it=><LibItem key={it.slug} label={it.label}
                    src={it.src || `${BASE}assets/lib/${it.slug}.png`}
                    onAdd={()=>addEl(it)}
                    onDragStart={e=>startLibDrag(it,e)}
                    onDragEnd={clearLibDrag}/>)}
                </div>)}
              </div>
            ))}
            {dynLibs.map(lib=>(
              <div key={lib.name} style={{marginBottom:3}}>
                <GroupRow label={lib.name} count={lib.shapes.length} open={isOpen(lib.name)}
                  onToggle={()=>toggle(lib.name)} onRemove={()=>setDynLibs(p=>p.filter(l=>l.name!==lib.name))}/>
                {isOpen(lib.name)&&(<div style={{paddingLeft:6,paddingBottom:4}}>
                  {lib.shapes.map((s,i)=>{
                    const item={label:s.name,dataUrl:s.dataUrl,w:60,h:60};
                    return <LibItem key={i} label={s.name} src={s.dataUrl}
                      onAdd={()=>addEl(item)}
                      onDragStart={e=>startLibDrag(item,e)}
                      onDragEnd={clearLibDrag}/>;
                  })}
                </div>)}
              </div>
            ))}
            {dynLibs.length===0&&(
              <div style={{margin:"8px 4px",padding:"12px",background:"rgba(0,216,255,0.03)",
                border:"1px solid #0a3a50",borderRadius:8,textAlign:"center",position:"relative"}}>
                <CornerBrackets size={7} lw={1} opacity={0.4}/>
                <p style={{fontSize:11,color:"#1e4a5e",lineHeight:1.7,margin:0}}>
                  Clic en <strong style={{color:"#00d8ff"}}>+ DSL</strong> para previsualizar
                  y cargar librerías de la carpeta <code style={{color:"#006070"}}>Lib/</code>
                </p>
              </div>
            )}
          </div>
        </HudPanel>

        {/* ══ CANVAS AREA ══════════════════════════════════════════════════
            The white rectangle is ALWAYS exactly CW×CH pixels (800×600).
            It sits centered in the available space.
            The Stage inside also = CW×CH. scaleX/Y control zoom of content.
            The white box itself NEVER changes size.
            ═══════════════════════════════════════════════════════════════ */}
        <div style={{
          flex:1, position:"relative",
          background:"#030810",
          display:"flex", alignItems:"center", justifyContent:"center",
          overflow:"hidden",
        }}>
          {/* HUD decorative frame — same size as the white canvas */}
          <div style={{
            position:"relative",
            width: CW + 16,   /* 8px padding on each side */
            height: CH + 16,
            flexShrink:0,
          }}>
            {/* Corner brackets */}
            <CornerBrackets color="#00d8ff" size={18} lw={2} opacity={0.9}/>
            {/* Frame border */}
            <div style={{position:"absolute",inset:0,border:"1px solid #0a3a50",pointerEvents:"none",zIndex:5}}/>
            {/* Center ticks */}
            <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:50,height:2,
              background:"linear-gradient(90deg,transparent,#00d8ff,transparent)",opacity:0.5,pointerEvents:"none",zIndex:5}}/>
            <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:50,height:2,
              background:"linear-gradient(90deg,transparent,#00d8ff,transparent)",opacity:0.4,pointerEvents:"none",zIndex:5}}/>
            <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:2,height:40,
              background:"linear-gradient(180deg,transparent,#00d8ff,transparent)",opacity:0.4,pointerEvents:"none",zIndex:5}}/>
            <div style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",width:2,height:40,
              background:"linear-gradient(180deg,transparent,#00d8ff,transparent)",opacity:0.4,pointerEvents:"none",zIndex:5}}/>

            {/* THE WHITE CANVAS — exactly CW×CH — NEVER changes size */}
            <div
              ref={canvasRef}
              onDragOver={onCanvasDragOver}
              onDrop={onCanvasDrop}
              style={{
                position:"absolute",
                inset:8,                /* 8px inside the frame */
                width: CW, height: CH,  /* FIXED — always 800×600 */
                background:"white",
                overflow:"hidden",
                cursor: zoom > 1 ? "grab" : "default",
              }}
            >
              {canvasSize.w > 0 && (
                <Stage
                  ref={stageRef}
                  width={CW}
                  height={CH}
                  scaleX={zoom}
                  scaleY={zoom}
                  x={pan.x}
                  y={pan.y}
                  draggable={zoom > 1}
                  dragBoundFunc={pos => clampPan(pos.x, pos.y, zoom)}
                  onDragEnd={e => setPan(clampPan(e.target.x(), e.target.y(), zoom))}
                  onWheel={onCanvasWheel}
                  onMouseDown={e => { if (e.target === e.target.getStage()) setSelId(null); }}
                >
                  <Layer>
                    {gridLines}
                    {els.map(el => (
                      <CanvasEl key={el.id} el={el}
                        isSel={el.id === selId}
                        onSel={() => setSelId(el.id)}
                        onChange={p => updEl(el.id, p)}
                        snap={snap} />
                    ))}
                  </Layer>
                </Stage>
              )}
            </div>
          </div>

          {/* Status */}
          <div style={{
            position:"absolute", bottom:6, right:14,
            fontSize:10, color:"#1e4a5e", letterSpacing:0.5,
            pointerEvents:"none", fontFamily:"'Exo 2',monospace",
          }}>
            {Math.round(zoom * 100)}% · {els.length} elemento{els.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <HudPanel style={{width:240,flexShrink:0,display:"flex",flexDirection:"column",background:"#060d18"}}>
          <div className="panel-title-bar" style={{display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
            <span style={{fontSize:15,fontWeight:800,letterSpacing:2,color:"#00d8ff",
              textTransform:"uppercase",fontFamily:"'Exo 2',sans-serif",
              textShadow:"0 0 10px rgba(0,216,255,0.4)"}}>Herramientas</span>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"10px 10px"}}>
            <HudBtn icon="💾" label="Guardar"      onClick={save}/>
            <HudBtn icon="📂" label="Cargar"       onClick={loadF}/>
            <HudBtn icon="🖼️" label="Exportar PNG" onClick={expPNG}/>
            <div className="hud-divider"/>
            <HudBtn icon="⊞" label="Grilla"        onClick={()=>setGrid(v=>!v)} active={grid}/>
            <HudBtn icon="⊹" label="Snap a grilla" onClick={()=>setSnap(v=>!v)} active={snap}/>
            <div className="hud-divider"/>
            <HudBtn icon="⬆️" label="Subir"     onClick={()=>moveZ("up")}    disabled={!selId}/>
            <HudBtn icon="⬇️" label="Bajar"     onClick={()=>moveZ("down")}  disabled={!selId}/>
            <HudBtn icon="⏫" label="Al frente" onClick={()=>moveZ("front")} disabled={!selId}/>
            <HudBtn icon="⏬" label="Al fondo"  onClick={()=>moveZ("back")}  disabled={!selId}/>
            <div className="hud-divider"/>
            <HudBtn icon="↩️" label="Deshacer (Ctrl+Z)" onClick={undo} disabled={hi<=0}/>
            <HudBtn icon="🗑️" label="Eliminar (Del)"    onClick={delSel} disabled={!selId} danger/>

            {selEl&&(
              <div style={{marginTop:10,padding:"11px",position:"relative",
                background:"rgba(0,216,255,0.03)",border:"1px solid #0a3a50",borderRadius:6}}>
                <CornerBrackets size={8} lw={1.5} opacity={0.5}/>
                <div style={{fontSize:9,color:"#1e4a5e",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>Seleccionado</div>
                <div style={{fontSize:12,color:"#00d8ff",fontWeight:700,marginBottom:10,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selEl.label}</div>
                <div style={{fontSize:9,color:"#1e4a5e",marginBottom:3,letterSpacing:1}}>ROTACIÓN: {Math.round(selEl.r||0)}°</div>
                <input type="range" min={0} max={360} value={Math.round(selEl.r||0)}
                  onChange={e=>updEl(selId,{r:parseFloat(e.target.value)})}
                  style={{width:"100%",accentColor:"#00d8ff",marginBottom:10}}/>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  {[["W","w"],["H","h"]].map(([l,k])=>(
                    <div key={k} style={{flex:1}}>
                      <div style={{fontSize:9,color:"#1e4a5e",marginBottom:3}}>{l}</div>
                      <input type="number" min={8} max={800} value={Math.round(selEl[k])}
                        onChange={e=>updEl(selId,{[k]:Math.max(8,parseFloat(e.target.value)||8)})}
                        style={{width:"100%",background:"rgba(0,216,255,0.05)",border:"1px solid #0a3a50",
                          borderRadius:6,color:"#c0dce8",padding:"4px 6px",fontSize:11,outline:"none"}}/>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:9,color:"#1e4a5e",marginBottom:5,letterSpacing:1}}>ESCALA RÁPIDA</div>
                <div style={{display:"flex",gap:4}}>
                  {[0.5,1,1.5,2].map(f=>(
                    <button key={f}
                      onClick={()=>updEl(selId,{w:Math.round((libDef?.w||selEl.w)*f),h:Math.round((libDef?.h||selEl.h)*f)})}
                      style={{flex:1,padding:"4px 0",background:"rgba(0,216,255,0.05)",border:"1px solid #0a3a50",
                        borderRadius:6,color:"#5a9ab0",cursor:"pointer",fontSize:10,fontWeight:600,transition:"all 0.1s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="#00d8ff";e.currentTarget.style.color="#00d8ff";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="#0a3a50";e.currentTarget.style.color="#5a9ab0";}}>
                      ×{f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {els.length>0&&(
              <div style={{marginTop:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{flex:1,height:1,background:"#0a3a50"}}/>
                  <span style={{fontSize:9,color:"#1e4a5e",letterSpacing:1.5,textTransform:"uppercase",whiteSpace:"nowrap"}}>Capas ({els.length})</span>
                  <div style={{flex:1,height:1,background:"#0a3a50"}}/>
                </div>
                <div style={{maxHeight:160,overflowY:"auto"}}>
                  {[...els].reverse().map((el,i)=>{
                    const src = el.dataUrl || el.src || `${BASE}assets/lib/${el.slug}.png`;
                    const on=el.id===selId;
                    return(
                      <div key={el.id} onClick={()=>setSelId(el.id)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"4px 7px",marginBottom:2,
                          borderRadius:6,cursor:"pointer",transition:"all 0.1s",
                          background:on?"rgba(0,216,255,0.09)":"transparent",
                          border:`1px solid ${on?"#006070":"transparent"}`}}>
                        <img src={src} alt="" style={{width:13,height:13,objectFit:"contain",flexShrink:0}}/>
                        <span style={{fontSize:10,flex:1,overflow:"hidden",textOverflow:"ellipsis",
                          whiteSpace:"nowrap",color:on?"#00d8ff":"#1e4a5e"}}>{el.label}</span>
                        <span style={{fontSize:9,color:"#1e4a5e"}}>{els.length-i}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </HudPanel>

      </div>
    </div>
  );
}
