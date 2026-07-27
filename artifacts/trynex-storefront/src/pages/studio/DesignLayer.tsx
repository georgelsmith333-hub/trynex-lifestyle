import { useRef, useEffect, useState } from "react";
import { Image as KonvaImage, Text as KonvaText, Rect, Circle, Star, Line, RegularPolygon, Transformer } from "react-konva";
import Konva from "konva";
import type { Layer, ImageLayer, TextLayer, ShapeLayer } from "./types";
import { useDesignStore } from "@/hooks/useDesignStore";

interface Props {
  layer: Layer;
  isSelected: boolean;
  onSelect: () => void;
}

export function DesignLayer({ layer, isSelected, onSelect }: Props) {
  const shapeRef = useRef<Konva.Shape>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const updateLayer = useDesignStore((s) => s.updateLayer);
  const selectLayer = useDesignStore((s) => s.selectLayer);
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

  const common = {
    x: layer.transform.x,
    y: layer.transform.y,
    scaleX: layer.transform.scaleX ?? layer.transform.scale,
    scaleY: layer.transform.scaleY ?? layer.transform.scale,
    rotation: layer.transform.rotation,
    opacity: layer.transform.opacity,
    draggable: !layer.locked,
    visible: layer.visible,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      updateLayer(layer.id, { transform: { ...layer.transform, x: e.target.x(), y: e.target.y() } });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      updateLayer(layer.id, {
        transform: {
          ...layer.transform,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          scale: node.scaleX(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
        },
      });
    },
  };

  if (layer.type === "image" && image) {
    const imgLayer = layer as ImageLayer;
    return (
      <>
        <KonvaImage
          ref={shapeRef as any}
          image={image}
          width={imgLayer.naturalW}
          height={imgLayer.naturalH}
          {...common}
          scaleX={common.scaleX * (imgLayer.flipH ? -1 : 1)}
          scaleY={common.scaleY * (imgLayer.flipV ? -1 : 1)}
          offsetX={imgLayer.naturalW / 2}
          offsetY={imgLayer.naturalH / 2}
          filters={[
            Konva.Filters.Brighten,
            Konva.Filters.Contrast,
            Konva.Filters.HSL,
          ]}
          brightness={(imgLayer.brightness ?? 100) / 100 - 1}
          contrast={(imgLayer.contrast ?? 100) / 100}
          saturation={(imgLayer.saturation ?? 100) / 100}
        />
        {isSelected && <Transformer ref={trRef} rotateEnabled flipEnabled anchorSize={8} borderStroke="#E85D04" />}
      </>
    );
  }

  if (layer.type === "text") {
    const textLayer = layer as TextLayer;
    return (
      <>
        <KonvaText
          ref={shapeRef as any}
          text={textLayer.text}
          fontFamily={textLayer.fontFamily}
          fontSize={textLayer.fontSize}
          fontStyle={textLayer.fontStyle}
          fontWeight={textLayer.fontWeight}
          fill={textLayer.color}
          align={textLayer.textAlign || "center"}
          stroke={textLayer.strokeColor}
          strokeWidth={textLayer.strokeWidth || 0}
          shadowColor={textLayer.shadowColor}
          shadowBlur={textLayer.shadowBlur || 0}
          shadowOffsetX={textLayer.shadowOffsetX || 0}
          shadowOffsetY={textLayer.shadowOffsetY || 0}
          letterSpacing={textLayer.letterSpacing || 0}
          {...common}
        />
        {isSelected && <Transformer ref={trRef} rotateEnabled flipEnabled anchorSize={8} borderStroke="#E85D04" />}
      </>
    );
  }

  if (layer.type === "shape") {
    const shape = layer as ShapeLayer;
    const fill = typeof shape.fill === "string" ? shape.fill : "#E85D04";
    const stroke = shape.strokeColor || "#111111";
    const strokeWidth = shape.strokeWidth || 0;
    const { width, height } = shape;

    switch (shape.shapeType) {
      case "rect":
        return (
          <>
            <Rect ref={shapeRef as any} width={width} height={height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
            {isSelected && <Transformer ref={trRef} rotateEnabled flipEnabled anchorSize={8} borderStroke="#E85D04" />}
          </>
        );
      case "circle":
        return (
          <>
            <Circle ref={shapeRef as any} radius={width / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
            {isSelected && <Transformer ref={trRef} rotateEnabled flipEnabled anchorSize={8} borderStroke="#E85D04" />}
          </>
        );
      case "star":
        return (
          <>
            <Star ref={shapeRef as any} numPoints={5} innerRadius={width / 4} outerRadius={width / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
            {isSelected && <Transformer ref={trRef} rotateEnabled flipEnabled anchorSize={8} borderStroke="#E85D04" />}
          </>
        );
      case "polygon":
        return (
          <>
            <RegularPolygon ref={shapeRef as any} sides={shape.sides || 6} radius={width / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...common} />
            {isSelected && <Transformer ref={trRef} rotateEnabled flipEnabled anchorSize={8} borderStroke="#E85D04" />}
          </>
        );
      case "arrow":
        return (
          <>
            <Line
              ref={shapeRef as any}
              points={[0, 0, width, 0, width - 10, -10, width, 0, width - 10, 10]}
              stroke={fill}
              strokeWidth={8}
              lineCap="round"
              lineJoin="round"
              {...common}
            />
            {isSelected && <Transformer ref={trRef} rotateEnabled flipEnabled anchorSize={8} borderStroke="#E85D04" />}
          </>
        );
      default:
        return null;
    }
  }

  return null;
}
