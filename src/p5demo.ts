import * as _ from 'lodash';
import * as generator from './generator';
import * as parser from './parser';
import * as interpreter from './interpreter';
declare let require: any;
let p5 = require('p5');
let LZString = require('lz-string');

const version = 1;
let sketchP5;
let width = 480;
let height = 480;
let undoButton: HTMLButtonElement;
let redoButton: HTMLButtonElement;
const reservedIdentifiers = [
    'HALF_PI', 'PI', 'QUATER_PI', 'TAU', 'TWO_PI',
    'POINTS', 'LINES', 'TRIANGLES', 'TRIANGLE_FAN', 'TRIANGLE_STRIP', 'QUADS', 'QUAD_STRIP',
    'CLOSE',
    'LEFT', 'CENTER', 'RIGHT',
    'THRESHOLD', 'GRAY', 'OPAQUE', 'INVERT', 'POSTERIZE', 'BLUR', 'ERODE', 'DILATE',
    'mouseX', 'mouseY', 'pmouseX', 'pmouseY', 'mouseButton',
    'width', 'height'
];
export function init() {
    parser.init(reservedIdentifiers);
    sketchP5 = new p5(getSketch());
    setInterval(resetSketch, 10 * 1000);
    initEditor();
    undoButton = <HTMLButtonElement>document.getElementById('undo');
    redoButton = <HTMLButtonElement>document.getElementById('redo');
    enableUndoRedoButtons();
    undoButton.onclick = () => { undoRedo(-1); };
    redoButton.onclick = () => { undoRedo(1); };
    document.getElementById('save').onclick = () => {
        let baseUrl = window.location.href.split('?')[0];
        let dataStr = LZString.compressToEncodedURIComponent(JSON.stringify(getTerms()));
        let url = `${baseUrl}?v=${version}&d=${dataStr}`;
        (<HTMLInputElement>document.getElementById('saved_url')).value = url;
    };
    document.getElementById('load').onclick = () => {
        let url = (<HTMLInputElement>document.getElementById('saved_url')).value;
        if (url == null) {
            return;
        }
        let query = url.split('?')[1];
        setFromUrl(query);
    };
    document.getElementById('reset').onclick = () => {
        resetLines();
        drawCode();
        resetSketch();
    };
    resetLines();
    setFromUrl(window.location.search.substring(1));
}

type Term = interpreter.Term;
type Func = interpreter.Func;
type Line = interpreter.Line;
let lines: Line[] = [];

function getIndices(cy: number): number[] {
    let indices: number[] = [];
    for (let y = 0; y < cy; y++) {
        indices = indices.concat(<number[]>_.map(lines[y].terms, 'index'));
    }
    return indices;
}

function getTerms(): Term[][] {
    return <Term[][]>_.map(lines, 'terms');
}

let termHistory: Term[][][] = [];
let termHistoryIndex: number;
const maxTermHistoryLength = 100;

function resetLines() {
    lines = [];
    cursor.y = 0;
    addLinesFromTermIndicies(generator.predict());
    drawCode();
    termHistory = [];
    storeTermHistory();
}

function addLinesFromTermIndicies(indicies: number[]) {
    let lineTermIndicies = [];
    _.forEach(indicies, (i) => {
        lineTermIndicies.push(i);
        if (generator.indexToTerm[i] === parser.carriageReturnStr) {
            appendLineFromTermIndicies(lineTermIndicies);
            lineTermIndicies = [];
        }
    });
}

function enableUndoRedoButtons() {
    undoButton.disabled = redoButton.disabled = true;
    let thl = termHistory.length;
    if (termHistoryIndex > 0) {
        undoButton.disabled = false;
    }
    if (termHistoryIndex < thl - 1) {
        redoButton.disabled = false;
    }
}

function undoRedo(offset) {
    termHistoryIndex += offset;
    lines = [];
    addLinesFromTerms(_.cloneDeep(termHistory[termHistoryIndex]));
    drawCode();
    resetSketch();
    enableUndoRedoButtons();
}

function addLinesFromTerms(terms: Term[][]) {
    _.forEach(terms, (ts) => appendLineFromTerms(ts));
}

function storeTermHistory() {
    termHistory.splice(termHistoryIndex + 1);
    termHistory.push(_.cloneDeep(getTerms()));
    while (termHistory.length > maxTermHistoryLength) {
        termHistory.shift();
    }
    termHistoryIndex = termHistory.length - 1;
    enableUndoRedoButtons();
}

function resetSketch() {
    sketchP5.remove();
    sketchP5 = null;
    sketchP5 = new p5(getSketch());
}

export function setFromUrl(query: string) {
    if (query == null) {
        return;
    }
    let params = query.split('&');
    let version: string;
    let dataStr: string;
    _.forEach(params, (param) => {
        let pair = param.split('=');
        if (pair[0] === 'v') {
            version = pair[1];
        }
        if (pair[0] === 'd') {
            dataStr = pair[1];
        }
    });
    if (dataStr == null) {
        return;
    }
    try {
        let terms = JSON.parse(LZString.decompressFromEncodedURIComponent(dataStr));
        addLinesFromTerms(terms);
    } catch (e) {
        return;
    }
    termHistory = [];
    storeTermHistory();
    drawCode();
    resetSketch();
}

function getSketch() {
    return (p: p5) => {
        p.setup = () => {
            let canvas = p.createCanvas(width, height);
            canvas.parent('canvas');
            canvas.canvas.style.opacity = 0.5;
            p.background(248);
            interpreter.init(10, p);
        };
        p.draw = () => {
            interpreter.interpret(lines);
        };
    }
}

let editorP5: p5;
const lineHeight = 10;
const maxLineCount = height / lineHeight;
let linesStartY = height / 2;
let cursor: { y: number } = { y: 0 };

function initEditor() {
    let sketch = (p: p5) => {
        let isLeftPressing = false;
        let isRightPressing = false;
        let showingMessageCount = 0;
        p.setup = () => {
            let canvas = p.createCanvas(width, height);
            canvas.parent('editor');
            let canvasElement: HTMLCanvasElement = canvas.canvas;
            canvasElement.oncontextmenu = (e) => { e.preventDefault(); }
            canvasElement.onmousedown = (e) => {
                cursor.y = Math.floor((p.mouseY - linesStartY) / lineHeight) + 1;
                if (e.button === 2) {
                    isRightPressing = true;
                } else {
                    prevPredictionStatus = null;
                    isLeftPressing = true;
                }
            };
            canvasElement.onmouseup = (e) => {
                if (e.button === 2) {
                    isRightPressing = false;
                } else {
                    isLeftPressing = false;
                }
                storeTermHistory();
                resetSketch();
            };
            p.clear();
        };
        p.draw = () => {
            if (showingMessageCount < 300) {
                p.textSize(15);
                if (showingMessageCount > 30) {
                    p.text('hold down the left click to generate a code', 30, 60);
                }
                if (showingMessageCount > 60) {
                    p.text('hold down the right click to erase a code', 30, 90);
                }
                if (showingMessageCount > 90) {
                    p.text('press [Reset] to start from an another code', 30, 400);
                }
                showingMessageCount++;
                if (showingMessageCount >= 300) {
                    drawCode();
                }
            }
            if (isLeftPressing) {
                showingMessageCount = 9999;
                onLeftPressing();
            } else if (isRightPressing) {
                showingMessageCount = 9999;
                onRightPressing();
            } else {
                let lc = lines.length;
                let ofs = ((height - lc * lineHeight) / 2 - linesStartY) * 0.1;
                if (Math.abs(ofs) >= 1) {
                    linesStartY += ofs;
                    drawCode();
                }
            }
        };
    };
    editorP5 = new p5(sketch);
}

let prevPredictedIndex;
let prevPredictionStatus;
const maxTermCount = 20;
const carriageReturnTypeStr = 'carriageReturn';
function onLeftPressing() {
    if (cursor.y < 0) {
        cursor.y = 0;
    } else if (cursor.y >= lines.length) {
        cursor.y = lines.length;
    }
    let line: number[] = [];
    for (let i = 0; i < maxTermCount; i++) {
        let pt;
        if (prevPredictionStatus == null) {
            pt = generator.predictTerm(getIndices(cursor.y));
        } else {
            pt = generator.predictTerm
                (null, prevPredictionStatus, prevPredictedIndex);
        }
        prevPredictedIndex = pt.next;
        prevPredictionStatus = pt.prev;
        line.push(pt.next)
        if (pt.next === 0 || generator.indexToTerm[pt.next] === parser.carriageReturnStr) {
            break;
        }
    }
    appendLineFromTermIndicies(line);
    drawCode();
}

function appendLineFromTermIndicies(termIndices: number[]) {
    let lineTerms: Term[] = _.map(termIndices, (ti) => {
        let parsed;
        if (ti === 0) {
            parsed = { type: carriageReturnTypeStr };
        } else {
            let termStr = generator.indexToTerm[ti];
            parsed = parser.parseTerm(termStr);
        }
        return { index: ti, parsed: parsed };
    });
    appendLineFromTerms(lineTerms);
}

function appendLineFromTerms(lineTerms: Term[]) {
    let line = interpreter.analyzeLine(lineTerms);
    lines.splice(cursor.y, 0, line);
    cursor.y++;
    if (lines.length >= maxLineCount) {
        lines.splice(maxLineCount);
    }
}

function onRightPressing() {
    if (cursor.y < 0 || cursor.y >= lines.length) {
        return;
    }
    lines.splice(cursor.y, 1);
    drawCode();
}

const codeStartX = 2;
function drawCode() {
    editorP5.textSize(10);
    editorP5.clear();
    let ly = linesStartY;
    _.forEach(lines, (line: Line) => {
        let lineStr = interpreter.getLineString(line);
        editorP5.text(lineStr, codeStartX, ly);
        ly += 10;
    });
}
