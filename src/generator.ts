// based on: https://github.com/karpathy/recurrentjs
declare let require: any;
let R = require('recurrentjs/recurrent');

// model parameters
let generator = 'lstm'; // can be 'rnn' or 'lstm'
let hidden_sizes = [100, 100];
let letter_size = 5; // size of letter embeddings

// prediction params
let sample_softmax_temperature = 1.0; // how peaky model predictions should be
let max_terms_gen = 25; // max length of generated sentences
let max_sentences_gen = 36;
const carriageReturnStr = '<CR>';

// various global var inits
let epoch_size = -1;
let input_size = -1;
let output_size = -1;
let termToIndex = {};
export let indexToTerm = {};
let vocab = [];
let data_sents = [];
let solver = new R.Solver(); // should be class because it needs memory for step caches

let model = {};

export function loadModel(j) {
    hidden_sizes = j.hidden_sizes;
    generator = j.generator;
    letter_size = j.letter_size;
    model = {};
    for (let k in j.model) {
        if (j.model.hasOwnProperty(k)) {
            let matjson = j.model[k];
            model[k] = new R.Mat(1, 1);
            model[k].fromJSON(matjson);
        }
    }
    solver = new R.Solver(); // have to reinit the solver since model changed
    solver.decay_rate = j.solver.decay_rate;
    solver.smooth_eps = j.solver.smooth_eps;
    solver.step_cache = {};
    for (let k in j.solver.step_cache) {
        if (j.solver.step_cache.hasOwnProperty(k)) {
            let matjson = j.solver.step_cache[k];
            solver.step_cache[k] = new R.Mat(1, 1);
            solver.step_cache[k].fromJSON(matjson);
        }
    }
    termToIndex = j['letterToIndex'];
    indexToTerm = j['indexToLetter'];
    vocab = j['vocab'];
}

function forwardIndex(G, model, ix, prev) {
    let x = G.rowPluck(model['Wil'], ix);
    // forward prop the sequence learner
    let out_struct;
    if (generator === 'rnn') {
        out_struct = R.forwardRNN(G, model, hidden_sizes, x, prev);
    } else {
        out_struct = R.forwardLSTM(G, model, hidden_sizes, x, prev);
    }
    return out_struct;
}

const maxGeneratingIndiciesCount = 100;
function predictSentences(model, samplei = false, temperature = 1.0) {
    let G = new R.Graph(false);
    let prev = {};
    let ix = 0;
    let indices = [];
    for (let i = 0; i < maxGeneratingIndiciesCount; i++) {
        // RNN tick
        let lh = forwardIndex(G, model, ix, prev);
        prev = lh;
        // sample predicted letter
        let logprobs = lh.o;
        if (temperature !== 1.0 && samplei) {
            // scale log probabilities by temperature and renormalize
            // if temperature is high, logprobs will go towards zero
            // and the softmax outputs will be more diffuse. if temperature is
            // very low, the softmax outputs will be more peaky
            for (let q = 0, nq = logprobs.w.length; q < nq; q++) {
                logprobs.w[q] /= temperature;
            }
        }
        let probs = R.softmax(logprobs);
        if (samplei) {
            ix = R.samplei(probs.w);
        } else {
            ix = R.maxi(probs.w);
        }
        indices.push(ix);
        if (ix === 0) {// END token predicted, break out
            break;
        }
    }
    return indices;
}

export function predict() {
    return predictSentences(model, true, sample_softmax_temperature);
}

function predictNextTerm
    (model, temperature = 1.0,
    sentenceIndices: number[], _prev = null, prevIndex = null) {
    let ix = 0;
    let G = new R.Graph(false);
    let prev = _prev;
    if (prev == null) {
        prev = {};
        _.forEach(sentenceIndices, (termIndex) => {
            ix = termIndex;
            if (ix === 0) {
                G = new R.Graph(false);
                prev = {};
            } else {
                prev = forwardIndex(G, model, ix, prev);
            }
        });
    } else {
        ix = prevIndex;
    }
    let lh = forwardIndex(G, model, ix, prev);
    let logprobs = lh.o;
    if (temperature !== 1.0) {
        for (let q = 0, nq = logprobs.w.length; q < nq; q++) {
            logprobs.w[q] /= temperature;
        }
    }
    let probs = R.softmax(logprobs);
    return { next: R.samplei(probs.w), prev: lh };
}

export function predictTerm
    (sentenceIndices: number[], prev = null, prevIndex = null) {
    return predictNextTerm
        (model, sample_softmax_temperature, sentenceIndices, prev, prevIndex);
}
