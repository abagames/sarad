import * as _ from 'lodash';

let vars: number[];
let libObj: any;
export function init(varCount: number, _libObj: any) {
    vars = _.times(varCount, () => 0);
    libObj = _libObj;
}

const maxInterpretLineCount = 1000;
let sentences: any[];
let prevIndentLevel: number;
let flowStack: any[];
let pc: number;
export function interpret(_sentences: any[]) {
    if (_sentences.length <= 0) {
        return;
    }
    sentences = _sentences;
    prevIndentLevel = 0;
    flowStack = [];
    pc = 0;
    for (let i = 0; i < maxInterpretLineCount; i++) {
        interpretLine(sentences[pc]);
        if (pc >= sentences.length) {
            let indentLevel = 0;
            if (indentLevel < prevIndentLevel) {
                let indentOutStatus = controlIndentEndFlow(indentLevel);
                if (indentOutStatus === 'loop') {
                    prevIndentLevel = -1;
                    continue;
                }
            }
            break;
        }
    }
}

function interpretLine(sentence: any[]) {
    let stack: any[] = [];
    let indentLevel = countIndentLevel(sentence);
    let indentOutStatus: string = null;
    if (indentLevel >= 0 && indentLevel < prevIndentLevel) {
        indentOutStatus = controlIndentEndFlow(indentLevel);
        if (indentOutStatus === 'loop') {
            prevIndentLevel = -1;
            return;
        }
    }
    let flowStatus: string = null;
    _.forEachRight(sentence, (t) => {
        switch (t.type) {
            case 'number':
            case 'variable':
            case 'variableNegative':
            case 'variableInvert':
                stack.push(t);
                break;
            case 'reservedVariable':
                pushReservedVariable(t.name, stack);
                break;
            case 'function':
                var args = getFromStack(stack, t.argCount);
                exec(t.name, args, stack);
                break;
            case 'assignFunction':
                var args = getFromStack(stack, t.argCount);
                exec(t.name, args, stack, t.variableIndex);
                break;
            case 'flowFunction':
                var args = getFromStack(stack, t.argCount);
                flowStatus =
                    execFlow(t.name, args, stack, indentLevel, indentOutStatus);
                if (flowStatus === 'jump') {
                    return false;
                }
                break;
        }
    });
    if (flowStatus === 'jump') {
        prevIndentLevel = -1;
        return;
    }
    prevIndentLevel = indentLevel;
    pc++;
}

function countIndentLevel(sentences: any[]) {
    return _.findIndex(sentences, (t: any) => t.type !== 'indent');
}

function controlIndentEndFlow(indentLevel) {
    if (flowStack.length <= 0) {
        return;
    }
    if (flowStack[flowStack.length - 1].indentLevel < indentLevel) {
        return;
    }
    let fs = flowStack.pop();
    if (fs.type === 'while') {
        pc = fs.pc;
        return 'loop';
    }
    return 'out';
}

function execFlow(name: string, args: number[], stack: any[],
    indentLevel: number, indentOutStatus: string) {
    let isJump = false;
    switch (name) {
        case 'if':
        case 'while':
            isJump = args[0] === 0;
            break;
        case 'else':
            isJump = indentOutStatus === 'out';
            break;
        case 'elif':
            isJump = indentOutStatus === 'out' || args[0] === 0;
            break;
        case 'break':
            return breakBlock();
    }
    if (isJump) {
        goNextBlock(indentLevel);
        return 'jump';
    } else {
        flowStack.push({ type: name, indentLevel: indentLevel, pc: pc });
    }
}

function goNextBlock(indentLevel) {
    for (; ;) {
        pc++;
        if (pc >= sentences.length) {
            return;
        }
        let il = countIndentLevel(sentences[pc]);
        if (il <= indentLevel) {
            return;
        }
    }
}

function breakBlock() {
    while (flowStack.length > 0) {
        let fs: any = flowStack.pop();
        if (fs.type === 'while') {
            goNextBlock(fs.indentLevel);
            return 'jump';
        }
    }
}

function getFromStack(stack: any[], argCount: number): number[] {
    return _.times(argCount, () => {
        if (stack.length <= 0) {
            return 0;
        }
        let s = stack.pop();
        switch (s.type) {
            case 'number':
                return s.value;
            case 'variable':
                return vars[s.variableIndex];
            case 'variableNegative':
                return -vars[s.variableIndex];
            case 'variableInvert':
                return vars[s.variableIndex] === 0 ? 1 : 0;
            default:
                return 0;
        }
    });
}

function exec(funcName: string, args: number[], stack: any[], variableIndex: number = null) {
    switch (funcName) {
        case 'add':
            pushNumber(args[0] + args[1], stack);
            break;
        case 'sub':
            pushNumber(args[0] - args[1], stack);
            break;
        case 'mul':
            pushNumber(args[0] * args[1], stack);
            break;
        case 'div':
            pushNumber(args[0] / args[1], stack);
            break;
        case 'mod':
            pushNumber(args[0] + args[1], stack);
            break;
        case 'lessThan':
            pushNumber(args[0] < args[1] ? 1 : 0, stack);
            break;
        case 'greaterThan':
            pushNumber(args[0] > args[1] ? 1 : 0, stack);
            break;
        case 'and':
            pushNumber(((args[0] !== 0) && (args[1] !== 0)) ? 1 : 0, stack);
            break;
        case 'or':
            pushNumber(((args[0] !== 0) || (args[1] !== 0)) ? 1 : 0, stack);
            break;
        case 'equal':
            pushNumber(args[0] === args[1] ? 1 : 0, stack);
            break;
        case 'notEqual':
            pushNumber(args[0] !== args[1] ? 1 : 0, stack);
            break;
        case 'lessThanOrEqual':
            pushNumber(args[0] <= args[1] ? 1 : 0, stack);
            break;
        case 'greaterThanOrEqual':
            pushNumber(args[0] >= args[1] ? 1 : 0, stack);
            break;
        case 'not':
            pushNumber(args[0] === 0 ? 1 : 0, stack);
            break;
        case 'assign':
            vars[variableIndex] = args[0];
            pushNumber(vars[variableIndex], stack);
            break;
        case 'assignAdd':
            vars[variableIndex] += args[0];
            pushNumber(vars[variableIndex], stack);
            break;
        case 'assignSub':
            vars[variableIndex] -= args[0];
            pushNumber(vars[variableIndex], stack);
            break;
        case 'assignMul':
            vars[variableIndex] *= args[0];
            pushNumber(vars[variableIndex], stack);
            break;
        case 'assignDiv':
            vars[variableIndex] /= args[0];
            pushNumber(vars[variableIndex], stack);
            break;
        case 'assignMod':
            vars[variableIndex] %= args[0];
            pushNumber(vars[variableIndex], stack);
            break;
        case 'assignInc':
            vars[variableIndex]++;
            pushNumber(vars[variableIndex], stack);
            break;
        case 'assignDec':
            vars[variableIndex]--;
            pushNumber(vars[variableIndex], stack);
            break;
        default:
            try {
                let result = libObj[funcName].apply(libObj, args);
                if (_.isNumber(result)) {
                    pushNumber(result, stack);
                }
            } catch (e) {
                //console.error(`exec failed: ${funcName} ${e}`);
            }
            break;
    }
}

function pushReservedVariable(name: string, stack: any[]) {
    pushNumber(libObj[name], stack);
}

function pushNumber(v: number, stack: any[]) {
    if (_.isNaN(v) || v === Number.POSITIVE_INFINITY || v === Number.NEGATIVE_INFINITY) {
        v = 0;
    }
    stack.push({ type: 'number', value: v });
}
