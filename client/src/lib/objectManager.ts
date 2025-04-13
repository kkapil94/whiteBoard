import { v4 as uuidv4 } from "uuid";

// Types
export interface Point {
  x: number;
  y: number;
}

export interface ShapeStyle {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
}

export interface ShapeBase {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  style: ShapeStyle;
  isSelected: boolean;
  zIndex: number;
}

export interface RectangleShape extends ShapeBase {
  type: "rectangle";
  width: number;
  height: number;
}

export interface CircleShape extends ShapeBase {
  type: "circle";
  radius: number;
}

export interface LineShape extends ShapeBase {
  type: "line";
  points: Point[];
}

export interface FreeDrawShape extends ShapeBase {
  type: "freeDraw";
  points: Point[];
}

export interface TextShape extends ShapeBase {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
}

export type Shape =
  | RectangleShape
  | CircleShape
  | LineShape
  | FreeDrawShape
  | TextShape;

// Object Manager Class
class ObjectManager {
  private shapes: Shape[] = [];
  private selectedShapes: Shape[] = [];
  private nextZIndex: number = 1;

  // Get all shapes
  getShapes(): Shape[] {
    return [...this.shapes];
  }

  // Get selected shapes
  getSelectedShapes(): Shape[] {
    return [...this.selectedShapes];
  }

  // Add a new shape
  addShape(shape: Partial<Shape>, type: string): Shape {
    const newShape: Shape = this.createShape(type, shape);
    this.shapes.push(newShape);
    return newShape;
  }

  // Create a shape based on type
  private createShape(type: string, props: Partial<Shape>): Shape {
    const baseShape: ShapeBase = {
      id: uuidv4(),
      type,
      x: props.x || 0,
      y: props.y || 0,
      rotation: props.rotation || 0,
      style: {
        strokeColor: props.style?.strokeColor || "#000000",
        fillColor: props.style?.fillColor || "transparent",
        strokeWidth: props.style?.strokeWidth || 2,
      },
      isSelected: false,
      zIndex: this.nextZIndex++,
    };

    switch (type) {
      case "rectangle":
        return {
          ...baseShape,
          type: "rectangle",
          width: (props as Partial<RectangleShape>).width || 0,
          height: (props as Partial<RectangleShape>).height || 0,
        };

      case "circle":
        return {
          ...baseShape,
          type: "circle",
          radius: (props as Partial<CircleShape>).radius || 0,
        };

      case "line":
        return {
          ...baseShape,
          type: "line",
          points: (props as Partial<LineShape>).points || [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ],
        };

      case "freeDraw":
        return {
          ...baseShape,
          type: "freeDraw",
          points: (props as Partial<FreeDrawShape>).points || [],
        };

      case "text":
        return {
          ...baseShape,
          type: "text",
          text: (props as Partial<TextShape>).text || "Text",
          fontSize: (props as Partial<TextShape>).fontSize || 16,
          fontFamily: (props as Partial<TextShape>).fontFamily || "Arial",
        };

      default:
        throw new Error(`Unsupported shape type: ${type}`);
    }
  }

  // Update a shape
  updateShape(id: string, props: Partial<Shape>): void {
    this.shapes = this.shapes.map((shape) => {
      if (shape.id === id) {
        if ("width" in shape && "height" in shape) {
          return { ...shape, ...props } as RectangleShape;
        } else if ("radius" in shape) {
          return { ...shape, ...props } as CircleShape;
        } else if ("text" in shape) {
          return { ...shape, ...props } as TextShape;
        } else {
          throw new Error(`Unsupported shape type: ${shape.type}`);
        }
      }
      return shape;
    });

    // Update selected shapes as well
    this.selectedShapes = this.selectedShapes.map((shape) => {
      if (shape.id === id) {
        if ("width" in shape && "height" in shape) {
          return { ...shape, ...props } as RectangleShape;
        } else if ("radius" in shape) {
          return { ...shape, ...props } as CircleShape;
        } else if ("text" in shape) {
          return { ...shape, ...props } as TextShape;
        } else {
          throw new Error(`Unsupported shape type: ${shape.type}`);
        }
      }
      return shape;
    });
  }

  // Delete shapes
  deleteShapes(ids: string[]): void {
    this.shapes = this.shapes.filter((shape) => !ids.includes(shape.id));
    this.selectedShapes = this.selectedShapes.filter(
      (shape) => !ids.includes(shape.id)
    );
  }

  // Delete all shapes
  clearAll(): void {
    this.shapes = [];
    this.selectedShapes = [];
  }

  // Select shapes
  selectShapes(ids: string[], addToSelection: boolean = false): void {
    if (!addToSelection) {
      // Deselect all shapes first
      this.shapes = this.shapes.map((shape) => ({
        ...shape,
        isSelected: false,
      }));
      this.selectedShapes = [];
    }

    // Select the specified shapes
    this.shapes = this.shapes.map((shape) =>
      ids.includes(shape.id) ? { ...shape, isSelected: true } : shape
    );

    // Update selectedShapes array
    this.selectedShapes = this.shapes.filter((shape) => shape.isSelected);
  }

  // Deselect all shapes
  deselectAll(): void {
    this.shapes = this.shapes.map((shape) => ({ ...shape, isSelected: false }));
    this.selectedShapes = [];
  }

  // Find shape at point
  findShapeAtPoint(point: Point, ctx: CanvasRenderingContext2D): Shape | null {
    // Sort shapes by z-index (highest first)
    const sortedShapes = [...this.shapes].sort((a, b) => b.zIndex - a.zIndex);

    for (const shape of sortedShapes) {
      if (this.isPointInShape(point, shape, ctx)) {
        return shape;
      }
    }

    return null;
  }

  // Check if point is inside shape
  isPointInShape(
    point: Point,
    shape: Shape,
    ctx: CanvasRenderingContext2D
  ): boolean {
    // Apply rotation if needed
    const rotatedPoint = this.rotatePoint(
      point,
      { x: shape.x, y: shape.y },
      -shape.rotation
    );

    switch (shape.type) {
      case "rectangle": {
        return (
          rotatedPoint.x >= shape.x - shape.width / 2 &&
          rotatedPoint.x <= shape.x + shape.width / 2 &&
          rotatedPoint.y >= shape.y - shape.height / 2 &&
          rotatedPoint.y <= shape.y + shape.height / 2
        );
      }

      case "circle": {
        const dx = point.x - shape.x;
        const dy = point.y - shape.y;
        return dx * dx + dy * dy <= shape.radius * shape.radius;
      }

      case "line": {
        const lineThickness = shape.style.strokeWidth + 5; // Added tolerance

        for (let i = 0; i < shape.points.length - 1; i++) {
          const p1 = shape.points[i];
          const p2 = shape.points[i + 1];

          // Get distance from point to line segment
          const distance = this.distanceToLineSegment(
            point,
            { x: p1.x + shape.x, y: p1.y + shape.y },
            { x: p2.x + shape.x, y: p2.y + shape.y }
          );

          if (distance <= lineThickness) {
            return true;
          }
        }
        return false;
      }

      case "freeDraw": {
        const strokeWidth = shape.style.strokeWidth + 5; // Added tolerance

        for (let i = 0; i < shape.points.length - 1; i++) {
          const p1 = shape.points[i];
          const p2 = shape.points[i + 1];

          // Get distance from point to line segment
          const distance = this.distanceToLineSegment(
            point,
            { x: p1.x + shape.x, y: p1.y + shape.y },
            { x: p2.x + shape.x, y: p2.y + shape.y }
          );

          if (distance <= strokeWidth) {
            return true;
          }
        }
        return false;
      }

      case "text": {
        ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
        const metrics = ctx.measureText(shape.text);
        const height = shape.fontSize;

        // Factor in the rotation
        return (
          rotatedPoint.x >= shape.x &&
          rotatedPoint.x <= shape.x + metrics.width &&
          rotatedPoint.y >= shape.y - height &&
          rotatedPoint.y <= shape.y
        );
      }

      default:
        return false;
    }
  }

  // Helper to calculate distance from point to line segment
  private distanceToLineSegment(
    point: Point,
    lineStart: Point,
    lineEnd: Point
  ): number {
    const lengthSquared =
      Math.pow(lineEnd.x - lineStart.x, 2) +
      Math.pow(lineEnd.y - lineStart.y, 2);
    if (lengthSquared === 0)
      return Math.sqrt(
        Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
      );

    // Project point onto line segment
    let t =
      ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) +
        (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) /
      lengthSquared;
    t = Math.max(0, Math.min(1, t));

    // Find closest point on line segment
    const projX = lineStart.x + t * (lineEnd.x - lineStart.x);
    const projY = lineStart.y + t * (lineEnd.y - lineStart.y);

    // Calculate distance to projection
    return Math.sqrt(
      Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2)
    );
  }

  // Helper function to rotate a point around another point
  private rotatePoint(point: Point, center: Point, angle: number): Point {
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    // Translate point to origin
    const x = point.x - center.x;
    const y = point.y - center.y;

    // Rotate point
    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;

    // Translate point back
    return {
      x: rotatedX + center.x,
      y: rotatedY + center.y,
    };
  }

  // Bring to front
  bringToFront(ids: string[]): void {
    if (ids.length === 0) return;

    // Get the highest z-index
    this.nextZIndex = Math.max(...this.shapes.map((s) => s.zIndex)) + 1;

    // Update z-indices
    this.shapes = this.shapes.map((shape) =>
      ids.includes(shape.id) ? { ...shape, zIndex: this.nextZIndex++ } : shape
    );
  }

  // Send to back
  sendToBack(ids: string[]): void {
    if (ids.length === 0) return;

    // Get the lowest z-index
    const lowestZ = Math.min(...this.shapes.map((s) => s.zIndex)) - 1;

    // Update z-indices
    this.shapes = this.shapes.map((shape) =>
      ids.includes(shape.id) ? { ...shape, zIndex: lowestZ } : shape
    );

    // Normalize z-indices
    this.normalizeZIndices();
  }

  // Normalize z-indices to ensure they are sequential
  private normalizeZIndices(): void {
    const sortedShapes = [...this.shapes].sort((a, b) => a.zIndex - b.zIndex);

    for (let i = 0; i < sortedShapes.length; i++) {
      sortedShapes[i].zIndex = i + 1;
    }

    this.shapes = sortedShapes;
    this.nextZIndex = sortedShapes.length + 1;
  }

  // Move shapes
  moveShapes(ids: string[], dx: number, dy: number): void {
    this.shapes = this.shapes.map((shape) => {
      if (ids.includes(shape.id)) {
        return { ...shape, x: shape.x + dx, y: shape.y + dy };
      }
      return shape;
    });

    // Update selected shapes as well
    this.selectedShapes = this.selectedShapes.map((shape) => {
      if (ids.includes(shape.id)) {
        return { ...shape, x: shape.x + dx, y: shape.y + dy };
      }
      return shape;
    });
  }

  // Resize shapes
  resizeShapes(ids: string[], factor: number, anchorPoint: Point): void {
    this.shapes = this.shapes.map((shape) => {
      if (!ids.includes(shape.id)) return shape;

      // Calculate vector from anchor to shape center
      const dx = shape.x - anchorPoint.x;
      const dy = shape.y - anchorPoint.y;

      // Apply scaling to position
      const newX = anchorPoint.x + dx * factor;
      const newY = anchorPoint.y + dy * factor;

      // Apply scaling to shape properties
      switch (shape.type) {
        case "rectangle":
          return {
            ...shape,
            x: newX,
            y: newY,
            width: shape.width * factor,
            height: shape.height * factor,
          };

        case "circle":
          return {
            ...shape,
            x: newX,
            y: newY,
            radius: shape.radius * factor,
          };

        case "line":
        case "freeDraw":
          return {
            ...shape,
            x: newX,
            y: newY,
            points: shape.points.map((point) => ({
              x: point.x * factor,
              y: point.y * factor,
            })),
          };

        case "text":
          return {
            ...shape,
            x: newX,
            y: newY,
            fontSize: shape.fontSize * factor,
          };

        default:
          return shape;
      }
    });

    // Update selected shapes
    this.selectedShapes = this.shapes.filter((shape) => shape.isSelected);
  }

  // Rotate shapes
  rotateShapes(ids: string[], angle: number, center: Point): void {
    this.shapes = this.shapes.map((shape) => {
      if (!ids.includes(shape.id)) return shape;

      // Apply rotation to shape's angle
      const newRotation = shape.rotation + angle;

      // For shapes that have a center point
      if (
        shape.type === "rectangle" ||
        shape.type === "circle" ||
        shape.type === "text"
      ) {
        // Rotate the center point around the provided center
        const rotated = this.rotatePoint(
          { x: shape.x, y: shape.y },
          center,
          angle
        );

        return {
          ...shape,
          x: rotated.x,
          y: rotated.y,
          rotation: newRotation,
        };
      }

      // For shapes with points arrays (line, freeDraw)
      if (shape.type === "line" || shape.type === "freeDraw") {
        // Rotate the shape's center around the provided center
        const rotatedCenter = this.rotatePoint(
          { x: shape.x, y: shape.y },
          center,
          angle
        );

        return {
          ...shape,
          x: rotatedCenter.x,
          y: rotatedCenter.y,
          rotation: newRotation,
        };
      }

      return shape;
    });

    // Update selected shapes
    this.selectedShapes = this.shapes.filter((shape) => shape.isSelected);
  }
}

export default ObjectManager;
