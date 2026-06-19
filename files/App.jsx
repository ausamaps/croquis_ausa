import { Stage, Layer, Rect } from "react-konva";
import { useState, useEffect, useRef } from "react";

const CANVAS_W = 800;
const CANVAS_H = 600;

function App() {
  const stageRef = useRef(null);
  const containerRef = useRef(null);

  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 10 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function updateSize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    }

    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const getMinScale = () => {
    if (!containerSize.width || !containerSize.height) return 1;
    return Math.min(
      containerSize.width / CANVAS_W,
      containerSize.height / CANVAS_H
    );
  };

  const limitarPosicion = (pos, sc) => {
    const scaledW = CANVAS_W * sc;
    return {
      x: Math.max(containerSize.width - scaledW, Math.min(0, pos.x)),
      y: 10,
    };
  };

  useEffect(() => {
    if (!containerSize.width || !containerSize.height) return;
    const min = getMinScale();
    setScale(min);
    setStagePos({
      x: (containerSize.width - CANVAS_W * min) / 2,
      y: 10,
    });
  }, [containerSize]);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "#1a1a1a" }}>

      {/* Panel izquierdo */}
      <div style={{ width: 220, background: "#2c2c2c", flexShrink: 0 }} />

      {/* Área central */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Barra de título */}
        <div style={{
          textAlign: "center",
          padding: "10px",
          color: "#00d4ff",
          background: "#1e1e1e",
          fontFamily: "monospace",
          fontSize: 13,
          letterSpacing: 2,
          flexShrink: 0,
          borderBottom: "1px solid #333",
        }}>
          EDITOR DE CROQUIS DE SEGURIDAD VIAL
        </div>

        {/* Contenedor del canvas */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: "hidden",
            background: "#333",
            position: "relative",
          }}
        >
          {containerSize.width > 0 && containerSize.height > 0 && (
            <Stage
              ref={stageRef}
              width={containerSize.width}
              height={containerSize.height}
              scaleX={scale}
              scaleY={scale}
              x={stagePos.x}
              y={stagePos.y}
              draggable={scale > getMinScale() + 0.02}
              dragBoundFunc={(pos) => limitarPosicion({ x: pos.x, y: 10 }, scale)}
              onDragEnd={(e) => {
                setStagePos(limitarPosicion({ x: e.target.x(), y: 10 }, scale));
              }}
              onWheel={(e) => {
                e.evt.preventDefault();
                const scaleBy = 1.05;
                const oldScale = scale;
                const pointer = stageRef.current.getPointerPosition();

                const mousePointTo = {
                  x: (pointer.x - stagePos.x) / oldScale,
                  y: (pointer.y - stagePos.y) / oldScale,
                };

                let newScale = e.evt.deltaY > 0
                  ? oldScale / scaleBy
                  : oldScale * scaleBy;

                const min = getMinScale();
                newScale = Math.max(min, Math.min(3, newScale));
                setScale(newScale);

                setStagePos(limitarPosicion(
                  { x: pointer.x - mousePointTo.x * newScale, y: 10 },
                  newScale
                ));
              }}
            >
              <Layer>
                {/* Fondo blanco del canvas */}
                <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="white" stroke="black" />

                {/* Grilla vertical */}
                {[...Array(40)].map((_, i) => (
                  <Rect key={"v" + i} x={i * 20} y={0} width={1} height={CANVAS_H} fill="#ddd" />
                ))}

                {/* Grilla horizontal */}
                {[...Array(30)].map((_, i) => (
                  <Rect key={"h" + i} x={0} y={i * 20} width={CANVAS_W} height={1} fill="#ddd" />
                ))}
              </Layer>
            </Stage>
          )}
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ width: 220, background: "#2c2c2c", flexShrink: 0 }} />
    </div>
  );
}

export default App;
