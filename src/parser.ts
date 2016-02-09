import * as _ from 'lodash';

export interface ParsedTerm {
    type: string;
    name?: string;
    argCount?: number;
    variableIndex?: number;
    value?: number;
};
const flowFunctionArgs = [
    'if/1', 'elif/1', 'else/0', 'while/1', 'break/0'
];
const operationFunctions = {
    '+': 'add',
    '-': 'sub',
    '*': 'mul',
    '/': 'div',
    '%': 'mod',
    '<': 'lessThan',
    '>': 'greaterThan',
    '&&': 'and',
    '||': 'or',
    '==': 'equal',
    '!=': 'notEqual',
    '<=': 'lessThanOrEqual',
    '>=': 'greaterThanOrEqual'
};
const singleArgOperationFunctions = {
    '!': 'not'
};
const assignFunctionArgs = {
    '=V': 'assign/1',
    '+=V': 'assignAdd/1',
    '-=V': 'assignSub/1',
    '*=V': 'assignMul/1',
    '/=V': 'assignDiv/1',
    '%=V': 'assignMod/1',
    '++V': 'assignInc/0',
    '--V': 'assignDec/0'
};
const reservedNumbers = {
    'true': 1,
    'false': 0
};
const reservedIdentifiers = [
    'HALF_PI', 'PI', 'QUATER_PI', 'TAU', 'TWO_PI',
    'POINTS', 'LINES', 'TRIANGLES', 'TRIANGLE_FAN', 'TRIANGLE_STRIP', 'QUADS', 'QUAD_STRIP',
    'CLOSE',
    'LEFT', 'CENTER', 'RIGHT',
    'mouseX', 'mouseY', 'pmouseX', 'pmouseY', 'mouseButton', 'mouseIsPressed',
    'width', 'height'
];

let flowFunctions: any[];
let assignFunctions: any;
export function init() {
    flowFunctions = _.map(flowFunctionArgs, (fa) => {
        var s = fa.split('/');
        return {
            name: s[0],
            argCount: Number(s[1])
        };
    });
    assignFunctions = {};
    _.forOwn(assignFunctionArgs, (value, key) => {
        var s = value.split('/');
        assignFunctions[key] = {
            name: s[0],
            argCount: Number(s[1])
        };
    });
}

export function parse(sentences: string[][]): ParsedTerm[][] {
    return _.map(sentences, (sentence) =>
        _.map(sentence, (t) => parseTerm(t))
    );
}

export const carriageReturnStr = '<CR>';
const indentStr = '<IDT>';
export function parseTerm(t: string): ParsedTerm {
    if (t == null || t.length <= 0) {
        return {
            type: 'nop'
        };
    }
    if (t === indentStr) {
        return {
            type: 'indent'
        };
    }
    if (t === carriageReturnStr) {
        return {
            type: 'carriageReturn'
        };
    }
    if (t[0] === 'V' || _.startsWith(t, '-V') || _.startsWith(t, '!V')) {
        let type;
        let vi;
        if (t[0] === 'V') {
            type = 'variable';
            vi = Number(t.substr(1));
        } else if (t[0] === '-') {
            type = 'variableNegative';
            vi = Number(t.substr(2));
        } else if (t[0] === '!') {
            type = 'variableInvert';
            vi = Number(t.substr(2));
        }
        return {
            type: type,
            variableIndex: vi
        };
    }
    if (_.find(reservedIdentifiers, (ri) => ri === t)) {
        return {
            type: 'reservedVariable',
            name: t
        };
    }
    let of = operationFunctions[t];
    if (of != null) {
        return {
            type: 'function',
            name: of,
            argCount: 2
        };
    }
    let sof = singleArgOperationFunctions[t];
    if (sof != null) {
        return {
            type: 'function',
            name: sof,
            argCount: 1
        };
    }
    let af = null;
    let afKey = null;
    _.forOwn(assignFunctions, (value, key) => {
        if (_.startsWith(t, key)) {
            af = value;
            afKey = key;
            return false;
        }
    });
    if (af != null) {
        let vi = Number(t.substr(afKey.length));
        return {
            type: 'assignFunction',
            name: af.name,
            argCount: af.argCount,
            variableIndex: vi
        };
    }
    let ff = _.find(flowFunctions, (ff) => ff.name === t);
    if (ff != null) {
        return {
            type: 'flowFunction',
            name: ff.name,
            argCount: ff.argCount
        };
    }
    let ss = t.split('/');
    if (ss.length == 2) {
        return {
            type: 'function',
            name: ss[0],
            argCount: Number(ss[1])
        };
    }
    let an = assignNumber(t);
    if (an != null) {
        return {
            type: 'number',
            value: an
        }
    }
    //console.error(`treated as nop: ${t}`);
    return {
        type: 'nop'
    };
}

function assignNumber(term: string) {
    let rn = reservedNumbers[term];
    if (rn != null) {
        return rn;
    }
    if (term.indexOf('D') < 0) {
        let n = Number(term);
        if (_.isNaN(n)) {
            return null;
        } else {
            return n;
        }
    }
    return Number(_.reduce(term, (p, c) => {
        if (c === 'D') {
            return p + String.fromCharCode
                ('0'.charCodeAt(0) + Math.floor(Math.random() * 9));
        } else {
            return p + c;
        }
    }, ''));
}

export function toString(term: ParsedTerm): string {
    switch (term.type) {
        case 'number':
            return term.value.toString();
        case 'variable':
            return `V${term.variableIndex}`;
        case 'variableNegative':
            return `-V${term.variableIndex}`;
        case 'variableInvert':
            return `!V${term.variableIndex}`;
        case 'reservedVariable':
            return term.name;
        case 'function':
            var str: string = null;
            _.forOwn(operationFunctions, (value, key) => {
                if (value === term.name) {
                    str = key;
                    return false;
                }
            });
            _.forOwn(singleArgOperationFunctions, (value, key) => {
                if (value === term.name) {
                    str = key;
                    return false;
                }
            });
            if (str != null) {
                return str;
            }
            return term.name;
        case 'assignFunction':
            var str = '';
            _.forOwn(assignFunctions, (value, key) => {
                if (value.name === term.name) {
                    str = `${key}${term.variableIndex}`;
                    return false;
                }
            });
            return str;
        case 'flowFunction':
            return term.name;
        case 'indent':
            return '  ';
        case 'carriageReturn':
        case 'nop':
            return '';
    }
}