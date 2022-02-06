const path = require('path');
const { ProgressPlugin } = require('webpack');
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { VueLoaderPlugin } = require('vue-loader');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = function setupConfig(config) {
    const plugins = config.plugins;
    delete config.plugins;

    return {
        context: path.join(__dirname, './'),
        module: {
            rules: [
                {
                    test: /\.vue$/,
                    loader: 'vue-loader'
                },
                {
                    test: /\.worker\.(js|ts)$/,
                    use: {
                        loader: 'worker-loader'
                    }
                },
                {
                    test: /\.ts$/,
                    loader: 'ts-loader',
                    options: {
                        appendTsSuffixTo: [/\.vue$/]
                    }
                },
                {
                    test: /\.mjs$/,
                    resolve: {
                        fullySpecified: false
                    },
                    include: /node_modules/,
                    type: "javascript/auto"
                },
                {
                    test: /\.css$/i,
                    loader: 'css-loader'
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: [
                        'style-loader',
                        'css-loader',
                        {
                            loader: 'sass-loader',
                            options: {
                                // Prefer `dart-sass`
                                implementation: require('sass')
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
        resolveLoader: {
            modules: [
                path.join(__dirname, './node_modules')
            ]
        },
        resolve: {
            roots: [
                path.resolve(__dirname, './')
            ],
            modules: [
                path.join(__dirname, './node_modules')
            ],
            alias: {
                '@': path.resolve(__dirname, 'src/')
            },
            extensions: ['.js', '.mjs', '.ts', '.vue', '.json']
        },
        plugins: [
            new ProgressPlugin({
                activeModules: true
            }),
            new CleanWebpackPlugin(),
            new CopyWebpackPlugin({
                patterns: [
                    { from: path.resolve(__dirname, 'src/assets/favicon'), to: '[name][ext]' },
                    { from: path.resolve(__dirname, 'src/css/main-*.css'), to: 'css/[name][ext]' },
                    { from: path.resolve(__dirname, 'src/assets/fonts'), to: 'css/fonts' },
                    { from: path.resolve(__dirname, 'src/assets/icons'), to: 'icons' },
                    { from: path.resolve(__dirname, 'src/assets/images'), to: 'images' },
                    { from: path.resolve(__dirname, 'src/workers'), to: 'js/workers' },
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
                    elementPlusAlert: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](alert)[\\/]/,
                        name: 'element-plus-button'
                    },
                    elementPlusButton: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](button|button-group)[\\/]/,
                        name: 'element-plus-button'
                    },
                    elementPlusCard: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](card)[\\/]/,
                        name: 'element-plus-card'
                    },
                    elementPlusCheckbox: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](checkbox|element-plus-checkbox-button|element-plus-checkbox-group)[\\/]/,
                        name: 'element-plus-checkbox'
                    },
                    elementPlusCollapse: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](collapse|collapse-item)[\\/]/,
                        name: 'element-plus-collapse'
                    },
                    elementPlusDialog: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](dialog|backdrop)[\\/]/,
                        name: 'element-plus-dialog'
                    },
                    elementPlusDivider: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](divider)[\\/]/,
                        name: 'element-plus-divider'
                    },
                    elementPlusDrawer: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](drawer|overlay)[\\/]/,
                        name: 'element-plus-drawer'
                    },
                    elementPlusDropdown: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](dropdown)[\\/]/,
                        name: 'element-plus-dropdown'
                    },
                    elementPlusForm: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](form|form-item)[\\/]/,
                        name: 'element-plus-form'
                    },
                    elementPlusGrid: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](col|row)[\\/]/,
                        name: 'element-plus-grid'
                    },
                    elementPlusIcon: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](icon)[\\/]/,
                        name: 'element-plus-icon'
                    },
                    elementPlusInput: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](input|input-number)[\\/]/,
                        name: 'element-plus-input'
                    },
                    elementPlusLoading: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](loading)[\\/]/,
                        name: 'element-plus-loading'
                    },
                    elementPlusLink: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](link)[\\/]/,
                        name: 'element-plus-link'
                    },
                    elementPlusMenu: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](menu|menu-item)[\\/]/,
                        name: 'element-plus-menu'
                    },
                    elementPlusNotification: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](notification)[\\/]/,
                        name: 'element-plus-notification'
                    },
                    elementPlusPopup: {
                        test: /[\\/]node_modules[\\/]((element-plus)[\\/](lib)[\\/](components)[\\/](popper|popover|tooltip)|\@popperjs)[\\/]/,
                        name: 'element-plus-popup'
                    },
                    elementPlusRadio: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](radio|radio-button|radio-group)[\\/]/,
                        name: 'element-plus-radio'
                    },
                    elementPlusScrollbar: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](scrollbar)[\\/]/,
                        name: 'element-plus-scrollbar'
                    },
                    elementPlusSelect: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](select|option)[\\/]/,
                        name: 'element-plus-select'
                    },
                    elementPlusSlider: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](slider)[\\/]/,
                        name: 'element-plus-slider'
                    },
                    elementPlusSwitch: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](switch)[\\/]/,
                        name: 'element-plus-switch'
                    },
                    elementPlusTabs: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](tabs|tab-pane)[\\/]/,
                        name: 'element-plus-tabs'
                    },
                    elementPlusTag: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](tag)[\\/]/,
                        name: 'element-plus-tag'
                    },
                    elementPlusTimeline: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](timeline|timeline-item)[\\/]/,
                        name: 'element-plus-timeline'
                    },
                    elementPlusTransition: {
                        test: /[\\/]node_modules[\\/](element-plus)[\\/](lib)[\\/](components)[\\/](transition)[\\/]/,
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
                    gifken: {
                        test: /[\\/]node_modules[\\/]gifken[\\/]/,
                        name: 'gifken'
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
                    pica: {
                        test: /[\\/]node_modules[\\/]pica[\\/]/,
                        name: 'pica',
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
