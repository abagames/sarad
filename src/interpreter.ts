import * as _ from 'lodash';
import * as parser from './parser';

let vars: number[];
let libObj: any;
export function init(varCount: number, _libObj: any) {
    vars = _.times(varCount, () => 0);
    libObj = _libObj;
}

export interface Term {
    index: number;
    parsed: parser.ParsedTerm;
};
export interface Func {
    parsed: parser.ParsedTerm;
    args: any[]
};
export interface Line {
    funcs: Func[];
    indentLevel: number;
    terms: Term[];
};

const maxInterpretLineCount = 100;
let lines: Line[];
let prevIndentLevel: number;
let flowStack: any[];
let pc: number;
export function interpret(_lines: Line[]) {
    if (_lines.length <= 0) {
        return;
    }
    lines = _lines;
    prevIndentLevel = 0;
    flowStack = [];
    pc = 0;
    for (let i = 0; i < maxInterpretLineCount; i++) {
        interpretLine(lines[pc]);
        if (pc >= lines.length) {
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

function interpretLine(line: Line) {
    let indentLevel = line.indentLevel;
    let indentOutStatus: string = null;
    if (indentLevel >= 0 && indentLevel < prevIndentLevel) {
        indentOutStatus = controlIndentEndFlow(indentLevel);
        if (indentOutStatus === 'loop') {
            prevIndentLevel = -1;
            return;
        }
    }
    let flowStatus: string = null;
    _.forEach(line.funcs, (f) => {
        let fp = f.parsed;
        let args: number[] = getArgNumbers(f.args);
        switch (fp.type) {
            case 'function':
                exec(fp.name, args);
                break;
            case 'assignFunction':
                exec(fp.name, args, fp.variableIndex);
                break;
            case 'flowFunction':
                flowStatus =
                    execFlow(fp.name, args, indentLevel, indentOutStatus);
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

function getArgNumbers(args: any[]): number[] {
    return _.map(args, (a) => {
        if (_.has(a, 'args')) {
            let ap: parser.ParsedTerm = a.parsed;
            let args: number[] = getArgNumbers(a.args);
            switch (ap.type) {
                case 'function':
                    return exec(ap.name, args);
                case 'assignFunction':
                    return exec(ap.name, args, ap.variableIndex);
            }
        } else {
            let ap: parser.ParsedTerm = a;
            switch (ap.type) {
                case 'number':
                    return ap.value;
                case 'variable':
                    return vars[ap.variableIndex];
                case 'variableNegative':
                    return -vars[ap.variableIndex];
                case 'variableInvert':
                    return vars[ap.variableIndex] === 0 ? 1 : 0;
                case 'reservedVariable':
                    return libObj[ap.name];
                default:
                    return 0;
            }
        }
    });
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

function execFlow(name: string, args: number[],
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
        if (pc >= lines.length) {
            return;
        }
        if (lines[pc].indentLevel <= indentLevel) {
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

function exec(funcName: string, args: number[], variableIndex: number = null): number {
    switch (funcName) {
        case 'add':
            return args[0] + args[1];
        case 'sub':
            return args[0] - args[1];
        case 'mul':
            return args[0] * args[1]
        case 'div':
            return args[0] / args[1];
            break;
        case 'mod':
            return args[0] % args[1];
            break;
        case 'lessThan':
            return args[0] < args[1] ? 1 : 0;
        case 'greaterThan':
            return args[0] > args[1] ? 1 : 0;
        case 'and':
            return ((args[0] !== 0) && (args[1] !== 0)) ? 1 : 0;
        case 'or':
            return ((args[0] !== 0) || (args[1] !== 0)) ? 1 : 0;
            break;
        case 'equal':
            return args[0] === args[1] ? 1 : 0;
        case 'notEqual':
            return args[0] !== args[1] ? 1 : 0;
        case 'lessThanOrEqual':
            return args[0] <= args[1] ? 1 : 0;
        case 'greaterThanOrEqual':
            return args[0] >= args[1] ? 1 : 0;
        case 'not':
            return args[0] === 0 ? 1 : 0;
        case 'assign':
            vars[variableIndex] = args[0];
            return vars[variableIndex];
        case 'assignAdd':
            vars[variableIndex] += args[0];
            return vars[variableIndex];
        case 'assignSub':
            vars[variableIndex] -= args[0];
            return vars[variableIndex];
        case 'assignMul':
            vars[variableIndex] *= args[0];
            return vars[variableIndex];
        case 'assignDiv':
            vars[variableIndex] /= args[0];
            return vars[variableIndex];
        case 'assignMod':
            vars[variableIndex] %= args[0];
            return vars[variableIndex];
        case 'assignInc':
            vars[variableIndex]++;
            return vars[variableIndex];
        case 'assignDec':
            vars[variableIndex]--;
            return vars[variableIndex];
        default:
            try {
                let result = libObj[funcName].apply(libObj, args);
                if (_.isNumber(result)) {
                    return result;
                }
            } catch (e) {
                //console.error(`exec failed: ${funcName} ${e}`);
            }
    }
    return 0;
}

export function analyzeLine(terms: Term[]): Line {
    let analyzeStack = [];
    let indentLevel = countIndentLevel(terms);
    _.forEachRight(terms, (t) => {
        let pt = t.parsed;
        switch (pt.type) {
            case 'number':
            case 'variable':
            case 'variableNegative':
            case 'variableInvert':
            case 'reservedVariable':
                analyzeStack.push(pt);
                break;
            case 'function':
            case 'assignFunction':
            case 'flowFunction':
                let args = getFromAnalyzeStack(analyzeStack, pt.argCount);
                analyzeStack.push({ parsed: pt, args: args });
                break;
        }
    });
    let funcs = _.filter(analyzeStack, (as) => {
        return (_.has(as, 'args'));
    });
    return { funcs: funcs, indentLevel: indentLevel, terms: terms };
}

function countIndentLevel(terms: Term[]) {
    return _.findIndex(terms, (t: Term) => t.parsed.type !== 'indent');
}

function getFromAnalyzeStack(stack: any[], argCount: number) {
    return _.times(argCount, () => {
        if (stack.length <= 0) {
            return { type: 'number', value: 0 };
        }
        return stack.pop();
    });
}

export function getLineString(line: Line) {
    return _.times(line.indentLevel, () => '  ').join('') +
        _.map(line.funcs, (f: Func) => getFuncString(f)).join(':');
}

function getFuncString(func: Func) {
    if (func.parsed.type === 'flowFunction' && func.parsed.argCount === 0) {
        return parser.getTermString(func.parsed);
    }
    let opFuncName = parser.getOperatonFunctionName(func.parsed);
    if (opFuncName != null) {
        if (func.parsed.argCount === 1) {
            return `${opFuncName}${getArgString(func.args[0])}`;
        } else if (func.parsed.argCount === 2) {
            return `(${getArgString(func.args[0])} ${opFuncName} ${getArgString(func.args[1])})`;
        }
    }
    let assignFuncName = parser.getAssignFunctionName(func.parsed);
    if (assignFuncName != null) {
        let vi = assignFuncName.indexOf('V');
        if (func.args.length === 0) {
            return `${assignFuncName.substr(vi)}${assignFuncName.substr(0, vi)}`;
        } else {
            return `${assignFuncName.substr(vi)} ${assignFuncName.substr(0, vi)} ${getArgString(func.args[0])}`;
        }
    }
    return `${parser.getTermString(func.parsed)}(${_.map(func.args, (a) => getArgString(a)).join(', ')})`;
}

function getArgString(arg: any) {
    if (_.has(arg, 'args')) {
        return getFuncString(arg);
    } else {
        return parser.getTermString(arg);
    }
}

export function removeOnlyOperationsFunction(line: Line) {
    line.funcs = _.filter(line.funcs, (f) => hasSomeNoOperationFunctionsInFunc(f));
}

function hasSomeNoOperationFunctionsInFunc(func: Func) {
    if (parser.getOperatonFunctionName(func.parsed) == null) {
        return true;
    }
    return _.some(func.args, (a) => _.has(a, 'args') && hasSomeNoOperationFunctionsInFunc(a));
}
