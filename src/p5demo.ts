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
    cursor.x = cursor.y = 0;
    appendLine(0);
    _.forEach(indices, (i) => addTermToCode(i));
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
type Term = { index: number, parsed: any, x: number };
let terms: Term[][] = [];
function getParsedSentences() {
    return _.map(terms, (t) => <any[]>_.map(t, 'parsed'));
}

function getIndices(cx: number, cy: number) {
    let indices: number[] = [];
    for (let y = 0; y < cy; y++) {
        indices = indices.concat(<number[]>_.map(terms[y], 'index'));
    }
    for (let x = 0; x < cx; x++) {
        indices.push(terms[cy][x].index);
    }
    return indices;
}

const lineHeight = 10;
const maxLineCount = height / lineHeight;
let linesStartY = height / 2;
let cursor: { x: number, y: number } = { x: 0, y: 0 };

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
                if (e.button === 2) {
                    setCursorPos(p.mouseX, p.mouseY);
                    isRightPressing = true;
                } else {
                    setCursorPos(p.mouseX, p.mouseY, true);
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

function setCursorPos(mx: number, my: number, isAppending = false) {
    let cx = 0;
    let cy = Math.floor((my - linesStartY) / lineHeight) + 1;
    if (cy >= terms.length) {
        if (isAppending) {
            cy = terms.length;
            appendLine(cy);
        } else {
            cy = terms.length - 1;
        }
    } else if (cy >= 0) {
        let ll = terms[cy].length;
        cx = ll;
        _.forEach(terms[cy], (t, x) => {
            if (mx < t.x) {
                cx = x;
                return false;
            }
        });
        if (isAppending &&
            (ll == 0 ||
                (cx >= ll - 1 && terms[cy][ll - 1].parsed.type === 'carriageReturn'))) {
            cx = 0;
            cy++;
            appendLine(cy);
        }
    } else {
        cy = 0;
        if (isAppending) {
            appendLine(cy);
        }
    }
    cursor.x = cx;
    cursor.y = cy;
}

function appendLine(y: number, line: Term[] = []) {
    terms.splice(y, 0, line);
}

let prevPredictedIndex;
let prevPredictionStatus;
function onLeftPressing() {
    let pt;
    if (prevPredictionStatus == null) {
        pt = generator.predictTerm(getIndices(cursor.x, cursor.y));
    } else {
        pt = generator.predictTerm
            (null, prevPredictionStatus, prevPredictedIndex);
    }
    addTermToCode(pt.next);
    prevPredictedIndex = pt.next;
    prevPredictionStatus = pt.prev;
    drawCode();
}

function addTermToCode(termIndex: number) {
    let parsed;
    if (termIndex === 0) {
        parsed = { type: 'carriageReturn' };
    } else {
        let termStr = generator.indexToTerm[termIndex];
        parsed = parser.parseTerm(termStr);
    }
    terms[cursor.y].splice(cursor.x, 0, { index: termIndex, parsed: parsed, x: 0 });
    cursor.x++;
    if (parsed.type === 'carriageReturn') {
        let restLine = terms[cursor.y].splice(cursor.x);
        cursor.y++;
        appendLine(cursor.y, restLine);
        cursor.x = 0;
    }
    if (terms.length >= maxLineCount) {
        terms.splice(maxLineCount);
    }
}

function onRightPressing() {
    if (cursor.y < 0 || cursor.y >= terms.length) {
        return;
    }
    if (terms[cursor.y].length <= 0) {
        terms.splice(cursor.y, 1);
        return;
    }
    if (cursor.x >= terms[cursor.y].length) {
        cursor.x = terms[cursor.y].length - 1;
    }
    let term = terms[cursor.y][cursor.x];
    terms[cursor.y].splice(cursor.x, 1);
    if (term.parsed.type == 'carriageReturn') {
        let line = terms.splice(cursor.y + 1, 1)[0];
        if (line != null) {
            terms[cursor.y] = terms[cursor.y].concat(line);
        }
    }
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
                    t.x = 9999;
                    return p;
                }
            } else {
                isIndent = false;
            }
            let str = `${p} ${parser.toString(t.parsed)}`;
            t.x = codeStartX + editorP5.textWidth(str);
            return str;
        }, '');
        editorP5.text(lineStr, codeStartX, ly);
        ly += 10;
    });
}
