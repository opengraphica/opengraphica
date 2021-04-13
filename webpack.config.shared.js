const path = require('path');
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { VueLoaderPlugin } = require('vue-loader');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = function setupConfig(config) {
    const plugins = config.plugins;
    delete config.plugins;

    return {
        module: {
            rules: [
                {
                    test: /\.vue$/,
                    loader: 'vue-loader'
                },
                {
                    test: /\.ts$/,
                    loader: 'ts-loader',
                    options: {
                        appendTsSuffixTo: [/\.vue$/]
                    }
                },
                {
                    test: /\.css$/i,
                    loader: 'css-loader'
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: [
                        "style-loader",
                        "css-loader",
                        {
                            loader: "sass-loader",
                            options: {
                                // Prefer `dart-sass`
                                implementation: require("sass")
                            }
                        }
                    ]
                },
                {
                    test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: '[name].[ext]',
                                outputPath: 'fonts/'
                            }
                        }
                    ]
                }
            ]
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src/')
            },
            extensions: ['.js', '.ts', '.vue', '.json']
        },
        plugins: [
            new CleanWebpackPlugin(),
            new CopyWebpackPlugin({
                patterns: [
                    { from: path.resolve(__dirname, 'src/css/main-*.css'), to: 'css/[name][ext]' },
                    { from: path.resolve(__dirname, 'src/assets/fonts'), to: 'css/fonts' },
                    { from: path.resolve(__dirname, 'node_modules/bootstrap-icons/font/fonts'), to: 'css/fonts' }
                ]
            }),
            new VueLoaderPlugin(),
            ...plugins
        ],
        optimization: {
            runtimeChunk: 'single',
            splitChunks: {
                chunks: 'all',
                maxInitialRequests: Infinity,
                minSize: 0,
                cacheGroups: {
                    asyncValidator: {
                        test: /[\\/]node_modules[\\/](async-validator)[\\/]/,
                        name: 'async-validator'
                    },
                    elementPlusButton: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-button|el-button-group)[\\/]/,
                        name: 'element-plus-button'
                    },
                    elementPlusCard: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-card)[\\/]/,
                        name: 'element-plus-card'
                    },
                    elementPlusCheckbox: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-checkbox|element-plus-checkbox-button|element-plus-checkbox-group)[\\/]/,
                        name: 'element-plus-checkbox'
                    },
                    elementPlusCollapse: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-collapse)[\\/]/,
                        name: 'element-plus-collapse'
                    },
                    elementPlusDialog: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-dialog|el-backdrop)[\\/]/,
                        name: 'element-plus-dialog'
                    },
                    elementPlusDivider: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-divider)[\\/]/,
                        name: 'element-plus-divider'
                    },
                    elementPlusDrawer: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-drawer|el-overlay)[\\/]/,
                        name: 'element-plus-drawer'
                    },
                    elementPlusDropdown: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-dropdown)[\\/]/,
                        name: 'element-plus-dropdown'
                    },
                    elementPlusForm: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-form|el-form-item)[\\/]/,
                        name: 'element-plus-form'
                    },
                    elementPlusGrid: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-col|el-row)[\\/]/,
                        name: 'element-plus-grid'
                    },
                    elementPlusIcon: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-icon)[\\/]/,
                        name: 'element-plus-icon'
                    },
                    elementPlusInput: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-input|el-input-number)[\\/]/,
                        name: 'element-plus-input'
                    },
                    elementPlusLoading: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-loading)[\\/]/,
                        name: 'element-plus-loading'
                    },
                    elementPlusMenu: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-menu|el-menu-item)[\\/]/,
                        name: 'element-plus-menu'
                    },
                    elementPlusNotification: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-notification)[\\/]/,
                        name: 'element-plus-notification'
                    },
                    elementPlusPopup: {
                        test: /[\\/]node_modules[\\/]((element-plus)[\\/](lib)[\\/](el-popper|el-popover|el-tooltip)|\@popperjs)[\\/]/,
                        name: 'element-plus-popup'
                    },
                    elementPlusRadio: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-radio|el-radio-button|el-radio-group)[\\/]/,
                        name: 'element-plus-radio'
                    },
                    elementPlusScrollbar: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-scrollbar)[\\/]/,
                        name: 'element-plus-scrollbar'
                    },
                    elementPlusSelect: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-select|el-option)[\\/]/,
                        name: 'element-plus-select'
                    },
                    elementPlusSlider: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-slider)[\\/]/,
                        name: 'element-plus-slider'
                    },
                    elementPlusSwitch: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-switch)[\\/]/,
                        name: 'element-plus-switch'
                    },
                    elementPlusTabs: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-tabs|el-tab-pane)[\\/]/,
                        name: 'element-plus-tabs'
                    },
                    elementPlusTag: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-tag)[\\/]/,
                        name: 'element-plus-tag'
                    },
                    elementPlusTransition: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](el-transition)[\\/]/,
                        name: 'element-plus-transition'
                    },
                    elementPlusShared: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](hooks|locale|utils|directives)[\\/]/,
                        name: 'element-plus-shared'
                    },
                    exprEval: {
                        test: /[\\/]node_modules[\\/](expr-eval)[\\/]/,
                        name: 'expr-eval'
                    },
                    opengraphicaActions: {
                        test: /[\\/]src[\\/]actions[\\/]/,
                        name: 'actions'
                    },
                    opengraphicaElementInput: {
                        test: /[\\/]src[\\/]ui[\\/]el-input-number/,
                        name: 'ogr-element-input'
                    },
                    opengraphicaElementForm: {
                        test: /[\\/]src[\\/]ui[\\/](el-form-item-group|el-form-item-aligned-groups)/,
                        name: 'ogr-element-form'
                    },
                    polyfill: {
                        test: /[\\/]node_modules[\\/](resize-observer-polyfill)[\\/]/,
                        name: 'polyfill'
                    },
                    vendor: {
                        test: /[\\/]node_modules[\\/](lodash|dayjs|file-saver|mitt|normalize-wheel)/,
                        name: 'vendor'
                    },
                    vue: {
                        test: /[\\/]node_modules[\\/](\@vue|vue)[\\/]/,
                        name: 'vue'
                    },
                }
            }
        },
        ...config
    };
};
