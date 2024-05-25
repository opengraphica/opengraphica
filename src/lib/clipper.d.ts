
export var biginteger_used: boolean;
export function Math_Abs_Int64(a: number): number;
export function Math_Abs_Int32(a: number): number;
export function Math_Abs_Double(a: number): number;
export function Math_Max_Int32_Int32(a: number, b: number): number;
export function Cast_Int32(a: number): number;
export function Cast_Int64(a: number): number;
export function Clear(a: ArrayLike<any>): void;

export var MaxSteps: number;
export var PI: number;
export var PI2: number;

export class IntPoint {
    X: number;
    Y: number;
    constructor();
    constructor(PointXY: IntPoint);
    constructor(x: number, y: number);
}

export class IntRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
    constructor();
    constructor(left: number, top: number, right: number, bottom: number);
}

export class Polygon {
    constructor();
    constructor(poly: ArrayLike<IntPoint>);
}

export class Polygons {
    constructor();
    constructor(polys: ArrayLike<ArrayLike<IntPoint>>);
}

export class ExPolygon {
    outer: ArrayLike<IntPoint>;
    holes: ArrayLike<ArrayLike<IntPoint>>;
}

export interface PathPoint {
    X: number;
    Y: number;
}
export type Path = PathPoint[];
export type Paths = Path[];

export enum ClipType {
    ctIntersection,
    ctUnion,
    ctDifference,
    ctXor,
}
export enum PolyType {
    ptSubject,
    ptClip,
}
export enum PolyFillType {
    pftEvenOdd,
    pftNonZero,
    pftPositive,
    pftNegative,
}
export enum JoinType {
    jtSquare,
    jtRound,
    jtMiter,
}
export enum EdgeSide {
    esLeft,
    esRight,
}
export enum Protects {
    ipNone,
    ipLeft,
    ipRight,
    ipBoth,
}
export enum Direction {
    dRightToLeft,
    dLeftToRight,
}

export class TEdge {
    xbot: number;
    ybot: number;
    xcurr: number;
    ycurr: number;
    xtop: number;
    ytop: number;
    dx: number;
    deltaX: number;
    deltaY: number;
    tmpX: number;
    polyType: PolyType;
    side: EdgeSide;
    windDelta: number;
    windCnt: number;
    windCnt2: number;
    outIdx: number;
    next: TEdge;
    prev: TEdge;
    nextInLML: TEdge;
    nextInAEL: TEdge;
    prevInAEL: TEdge;
    nextInSEL: TEdge;
    prevInSEL: TEdge;
}
export class IntersectNode {
    edge1: TEdge;
    edge2: TEdge;
    pt: TEdge;
    next: TEdge;
}
export class LocalMinima {
    Y: number;
    leftBound: TEdge;
    rightBound: TEdge;
    next: TEdge;
}
export class Scanbeam {
    Y: number;
    next: TEdge;
}
export class OutRec {
    idx: number;
    isHole: boolean;
    FirstLeft: TEdge;
    AppendLink: OutRec;
    pts: OutPt;
    bottomPt: OutPt;
}
export class OutPt {
    idx: number;
    pt: OutPt;
    next: OutPt;
    prev: OutPt;
}
export class JoinRec {
    pt1a: IntPoint;
    pt1b: IntPoint;
    poly1Idx: number;
    pt2a: IntPoint;
    pt2b: IntPoint;
    poly2Idx: number;
}
export class HorzJoinRec {
    edge: TEdge;
    savedIdx: number;
}
export class ClipperBase {
    AddPath(pg: Path, polyType: PolyType, closed: boolean): boolean;
    AddPaths(ppg: Paths, polyType: PolyType, closed: boolean): boolean;
}
export class Clipper extends ClipperBase {
    Execute(clipType: ClipType, solution: Paths, subjFillType: PolyFillType, clipFillType: PolyFillType): boolean;
}
export class DoublePoint {
    X: number;
    Y: number;
    constructor(x: number, y: number);
}

export class PolyOffsetBuilder {
    pts: Polygons;
    currentPoly: Polygon;
    normals: ArrayLike<IntPoint>;
    delta: number;
    m_R: number;
    m_i: number;
    m_j: number;
    m_k: number;
    botPt: PolyOffsetBuilder;

    constructor(
        pts: Polygons,
        solution: { value: Polygons },
        delta: number,
        jointype: JoinType,
        MiterLimit: number,
        AutoFix: boolean,
    );
    UpdateBotPt(pt: IntPoint): boolean;
    AddPoint(pt: IntPoint): void;
    DoSquare(mul: number): void;
    DoMiter(): void;
    DoRound(): void;
}
export function Error(message: string): void;
export function Clone(
    polygon: ArrayLike<IntPoint> | ArrayLike<ArrayLike<IntPoint>>,
): ArrayLike<IntPoint> | ArrayLike<ArrayLike<IntPoint>>;
export function Clean(
    polygon: ArrayLike<IntPoint> | ArrayLike<ArrayLike<IntPoint>>,
    delta: number,
): ArrayLike<IntPoint> | ArrayLike<ArrayLike<IntPoint>>;
export function Lighten(
    polygon: ArrayLike<IntPoint> | ArrayLike<ArrayLike<IntPoint>>,
    tolerance: number,
): ArrayLike<IntPoint> | ArrayLike<ArrayLike<IntPoint>>;
