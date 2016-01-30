declare class p5 {
    WEBGL: number;
    mouseX: number;
    mouseY: number;

    setup();
    draw();
    createVector(x?: number, y?: number): p5.Vector;
    createCanvas(width: number, height: number, option?:any);
    background(r: number | string, g?: number, b?: number);
    stroke(r: number, g?: number, b?: number);
    fill(r: number, g?: number, b?: number);
    noFill();
    ellipse(x: number, y: number, width: number, height: number);
    rect(x: number, y: number, width: number, height: number);
    line(x1: number, y1: number, x2: number, y2: number);
    bezier(x1: number, y1: number, x2: number, y2: number,
        x3: number, y3: number, x4: number, y4: number);
    textSize(size: number);
    text(str: string, x: number, y: number, x2?: number, y2?: number);
    textWidth(str: string): number;
    frameRate(fps: number);
    clear();
}

declare module p5 {
    class Vector {
        x: number;
        y: number;
        z: number;

        constructor(x?: number, y?: number, z?: number);
        toString(): string;
        set(x?: number | Vector | number[], y?: number, z?: number);
        copy(): Vector;
        add(x?: number | Vector | number[], y?: number, z?: number);
        sub(x?: number | Vector | number[], y?: number, z?: number);
        mult(v: number);
        div(v: number);
        mag(): number;
        magSq(): number;
        dot(x?: number | Vector | number[], y?: number, z?: number): number;
        cross(v: Vector): Vector;
        dist(v: Vector): number;
        normalize();
        limit(v: number);
        setMag(v: number);
        heading(): number;
        rotate(angle: number);
        lerp(x: number, y?: number, z?: number, amt?: number);
        array(): number[];
        equals(x?: number | Vector | number[], y?: number, z?: number): boolean;
        static fromAngle(angle: number): Vector;
        static random2D(): Vector;
        static random3D(): Vector;
        static angleBetween(v1: Vector, v2: Vector): number;
    }
}
