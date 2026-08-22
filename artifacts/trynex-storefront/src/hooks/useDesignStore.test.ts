import { beforeEach, describe, expect, it } from "vitest";
import { useDesignStore } from "./useDesignStore";

const imageLayer = {
  id: "layer-1",
  name: "Test artwork",
  type: "image" as const,
  visible: true,
  locked: false,
  face: "front" as const,
  transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
  src: "data:image/png;base64,iVBORw0KGgo=",
  naturalW: 512,
  naturalH: 512,
};

describe("Design Studio history", () => {
  beforeEach(() => {
    useDesignStore.setState(useDesignStore.getInitialState(), true);
  });

  it("restores and reapplies a layer visibility edit with undo and redo", () => {
    useDesignStore.getState().addLayer(imageLayer);
    useDesignStore.getState().setLayerVisibility(imageLayer.id, false);

    expect(useDesignStore.getState().layers[0].visible).toBe(false);

    useDesignStore.getState().undo();
    expect(useDesignStore.getState().layers[0].visible).toBe(true);

    useDesignStore.getState().redo();
    expect(useDesignStore.getState().layers[0].visible).toBe(false);
  });
});
