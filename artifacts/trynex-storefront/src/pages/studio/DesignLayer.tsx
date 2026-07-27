import { useRef, useEffect, useState } from "react";
import { Image as KonvaImage, Text as KonvaText, Rect, Circle, Star, Line, RegularPolygon, Transformer } from "react-konva";
import Konva from "konva";
import type { Layer, ImageLayer, TextLayer, ShapeLayer } from "./types";
import { useDesignStore } from "@/hooks/useDesignStore";
import { getGradientFill, getPatternFill } from "./gradient-utils";

interface Props {
  layer: Layer;
  isSelected: boolean;
  onSelect: () => void;
  stageScale?: number;
  printZoneCenter?: { x: number; y: number };
  printZoneSize?: { w: number; h: number };
}

export function DesignLayer({
  layer,
  isSelected,
  onSelect,
  stageScale = 1,
  printZoneCenter = { x: 300, y: 300 },
  printZoneSize,
}: Props) {
  const shapeRef = useRef<Konva.Shape>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const updateLayer = useDesignStore((s) => s.updateLayer);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (layer.type === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setImage(img);
      img.src = (layer as ImageLayer).src;
    }
  }, [layer.type, layer.type === "image" ? (layer as ImageLayer).src : null]);

  useEffect(() => {
    if (isSelected && shapeRef.current && trRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const cx = printZoneCenter.x + layer.transform.x * stageScale;
  const cy = printZoneCenter.y + layer.transform.y * stageScale;
  const baseScale = layer.transform.scale * stageScale;

  const dragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    updateLayer(layer.id, {
      transform: {
        ...layer.transform,
        x: (node.x() - printZoneCenter.x) / stageScale,
        y: (node.y() - printZoneCenter.y) / stageScale,
      },
    });
  };

  const transformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    updateLayer(layer.id, {
      transform: {
        ...layer.transform,
        x: (node.x() - printZoneCenter.x) / stageScale,
        y: (node.y() - printZoneCenter.y) / stageScale,
        rotation: node.rotation(),
        scale: node.scaleX() / stageScale,
        scaleX: node.scaleX() / stageScale,
        scaleY: node.scaleY() / stageScale,
      },
    });
  };

  const common = {
    rotation: layer.transform.rotation,
    opacity: layer.transform.opacity,
    draggable: !layer.locked,
    visible: layer.visible,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: dragEnd,
    onTransformEnd: transformEnd,
  };

  const transformer = isSelected ? (
    <Transformer ref={trRef} rotateEnabled flipEnabled anchorSize={8} borderStroke="#E85D04" />
  ) : null;

  if (layer.type === "image" && image) {
    const imgLayer = layer as ImageLayer;
    return (
      <>
        <KonvaImage
          ref={shapeRef as any}
          image={image}
          width={imgLayer.naturalW}
          height={imgLayer.naturalH}
          x={cx}
          y={cy}
          scaleX={baseScale * (imgLayer.flipH ? -1 : 1)}
          scaleY={baseScale * (imgLayer.flipV ? -1 : 1)}
          offsetX={imgLayer.naturalW / 2}
          offsetY={imgLayer.naturalH / 2}
          rotation={layer.transform.rotation}
          opacity={layer.transform.opacity}
          draggable={!layer.locked}
          visible={layer.visible}
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={dragEnd}
          onTransformEnd={transformEnd}
          filters={[
            Konva.Filters.Brighten,
            Konva.Filters.Contrast,
            Konva.Filters.HSL,
          ]}
          brightness={(imgLayer.brightness ?? 100) / 100 - 1}
          contrast={(imgLayer.contrast ?? 100) / 100}
          saturation={(imgLayer.saturation ?? 100) / 100}
        />
        {transformer}
      </>
    );
  }

  if (layer.type === "text") {
    const textLayer = layer as TextLayer;
    const fill: string | CanvasGradient = textLayer.gradient
      ? getGradientFill(textLayer.gradient, printZoneCenter, stageScale)
      : textLayer.color;
    return (
      <>
        <KonvaText
          ref={shapeRef as any}
          text={textLayer.text}
          fontFamily={textLayer.fontFamily}
          fontSize={textLayer.fontSize * baseScale}
          fontStyle={textLayer.fontStyle}
          fontWeight={textLayer.fontWeight}
          fill={fill}
          align={textLayer.textAlign || "center"}
          stroke={textLayer.strokeColor}
          strokeWidth={(textLayer.strokeWidth || 0) * baseScale}
          shadowColor={textLayer.shadowColor}
          shadowBlur={textLayer.shadowBlur || 0}
          shadowOffsetX={textLayer.shadowOffsetX || 0}
          shadowOffsetY={textLayer.shadowOffsetY || 0}
          letterSpacing={(textLayer.letterSpacing || 0) * baseScale}
          x={cx}
          y={cy}
          rotation={layer.transform.rotation}
          opacity={layer.transform.opacity}
          draggable={!layer.locked}
          visible={layer.visible}
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={dragEnd}
          onTransformEnd={transformEnd}
        />
        {transformer}
      </>
    );
  }

  if (layer.type === "shape") {
    const shape = layer as ShapeLayer;
    const fill: string | CanvasGradient = typeof shape.fill === "string"
      ? shape.fill
      : shape.fill.type === "pattern"
      ? (getPatternFill(shape.fill, stageScale) as string | CanvasGradient)
      : getGradientFill(shape.fill, printZoneCenter, stageScale);
    const stroke = shape.strokeColor || "#111111";
    const strokeWidth = (shape.strokeWidth || 0) * baseScale;
    const w = shape.width * baseScale;
    const h = shape.height * baseScale;

    switch (shape.shapeType) {
      case "rect":
        return (
          <>
            <Rect ref={shapeRef as any} width={w} height={h} x={cx} y={cy} offsetX={w / 2} offsetY={h / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
            {transformer}
          </>
        );
      case "circle":
        return (
          <>
            <Circle ref={shapeRef as any} radius={w / 2} x={cx} y={cy} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
            {transformer}
          </>
        );
      case "star":
        return (
          <>
            <Star ref={shapeRef as any} numPoints={5} innerRadius={w / 4} outerRadius={w / 2} x={cx} y={cy} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
            {transformer}
          </>
        );
      case "polygon":
        return (
          <>
            <RegularPolygon ref={shapeRef as any} sides={shape.sides || 6} radius={w / 2} x={cx} y={cy} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
            {transformer}
          </>
        );
      case "arrow":
        return (
          <>
            <Line
              ref={shapeRef as any}
              points={[0, 0, w, 0, w - 10 * baseScale, -10 * baseScale, w, 0, w - 10 * baseScale, 10 * baseScale]}
              stroke={fill}
              strokeWidth={8 * baseScale}
              lineCap="round"
              lineJoin="round"
              x={cx}
              y={cy}
              rotation={layer.transform.rotation}
              opacity={layer.transform.opacity}
              draggable={!layer.locked}
              visible={layer.visible}
              onClick={onSelect}
              onTap={onSelect}
              onDragEnd={dragEnd}
              onTransformEnd={transformEnd}
            />
            {transformer}
          </>
        );
      default:
        return null;
    }
  }

  return null;
}
