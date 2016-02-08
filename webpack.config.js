var LiveReloadPlugin = require('webpack-livereload-plugin');
var glob = require('glob');

module.exports = {
    entry: glob.sync('./src/**/*.ts'),
    output: {
        path: './app',
        filename: 'bundle.js'
    },
    resolve: {
        extensions: ['.ts', "", ".webpack.js", ".web.js", ".js"]
    },
    devtool: 'source-map',
    module: {
        loaders: [
            {
                test: /\.ts$/,
                exclude: /(node_modules|web_modules|app)/,
                loader: 'ts-loader'
            }
        ]
    },
    plugins: [
        new LiveReloadPlugin()
    ]
};