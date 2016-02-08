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
let termHistory: Term[][][] = [];
let currentTermIndex: number;
let undoButton: HTMLButtonElement;
let redoButton: HTMLButtonElement;
export function init() {
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
        let dataStr = LZString.compressToEncodedURIComponent(JSON.stringify(terms));
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
        resetTerms();
        drawCode();
        resetSketch();
    };
    resetTerms();
    setFromUrl(window.location.search.substring(1));
}

function resetTerms() {
    terms = [];
    let indices = generator.predict();
    cursor.y = 0;
    let line = [];
    _.forEach(indices, (i) => {
        line.push(i);
        if (generator.indexToTerm[i] === parser.carriageReturnStr) {
            appendLine(line);
            line = [];
        }
    });
    drawCode();
    termHistory = [];
    storeTermHistory();
}

function enableUndoRedoButtons() {
    undoButton.disabled = redoButton.disabled = true;
    let thl = termHistory.length;
    if (currentTermIndex > 0) {
        undoButton.disabled = false;
    }
    if (currentTermIndex < thl - 1) {
        redoButton.disabled = false;
    }
}

function undoRedo(offset) {
    currentTermIndex += offset;
    terms = _.cloneDeep(termHistory[currentTermIndex]);
    drawCode();
    resetSketch();
    enableUndoRedoButtons();
}

const maxTermHistoryLength = 100;
function storeTermHistory() {
    termHistory.splice(currentTermIndex + 1);
    termHistory.push(_.cloneDeep(terms));
    while (termHistory.length > maxTermHistoryLength) {
        termHistory.shift();
    }
    currentTermIndex = termHistory.length - 1;
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
        terms = JSON.parse(LZString.decompressFromEncodedURIComponent(dataStr));
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
            interpreter.interpret(getParsedSentences());
        };
    }
}

let editorP5: p5;
type Term = { index: number, parsed: any };
let terms: Term[][] = [];
function getParsedSentences() {
    return _.map(terms, (t) => <any[]>_.map(t, 'parsed'));
}

function getIndices(cy: number) {
    let indices: number[] = [];
    for (let y = 0; y < cy; y++) {
        indices = indices.concat(<number[]>_.map(terms[y], 'index'));
    }
    return indices;
}

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
                let lc = terms.length;
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
    } else if (cursor.y >= terms.length) {
        cursor.y = terms.length;
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
    appendLine(line);
    drawCode();
}

function appendLine(termIndices: number[]) {
    let line: Term[] = _.map(termIndices, (ti) => {
        let parsed;
        if (ti === 0) {
            parsed = { type: carriageReturnTypeStr };
        } else {
            let termStr = generator.indexToTerm[ti];
            parsed = parser.parseTerm(termStr);
        }
        return { index: ti, parsed: parsed };
    });
    terms.splice(cursor.y, 0, line);
    cursor.y++;
    if (terms.length >= maxLineCount) {
        terms.splice(maxLineCount);
    }
}

function onRightPressing() {
    if (cursor.y < 0 || cursor.y >= terms.length) {
        return;
    }
    terms.splice(cursor.y, 1);
    drawCode();
}

const codeStartX = 2;
function drawCode() {
    editorP5.textSize(10);
    editorP5.clear();
    let ly = linesStartY;
    _.forEach(terms, (line: Term[]) => {
        let isIndent = true;
        let lineStr = _.reduce(line, (p, t: Term) => {
            if (t.parsed.type == 'indent') {
                if (!isIndent) {
                    return p;
                }
            } else {
                isIndent = false;
            }
            let str = `${p} ${parser.toString(t.parsed)}`;
            return str;
        }, '');
        editorP5.text(lineStr, codeStartX, ly);
        ly += 10;
    });
}
