import * as generator from './generator';
import * as p5demo from './p5demo';
declare let require: any;
let model = require('../data/model');

window.onload = () => {
    generator.loadModel(model);
    p5demo.init();
}
