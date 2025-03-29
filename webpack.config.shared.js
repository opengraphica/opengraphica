const path = require('path');
const { DefinePlugin, ProgressPlugin } = require('webpack');
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { VueLoaderPlugin } = require('vue-loader');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = function setupConfig(config) {
    const plugins = config.plugins;
    delete config.plugins;

    return {
        context: path.join(__dirname, './'),
        module: {
            rules: [
                {
                    test: /\.(vert|frag)$/i,
                    // include: path.resolve(__dirname, 'src'),
                    type: 'asset/source',
                },
                {
                    test: /\.vue$/,
                    // include: path.resolve(__dirname, 'src'),
                    loader: 'vue-loader'
                },
                {
                    test: /\.ts$/,
                    // include: path.resolve(__dirname, 'src'),
                    loader: 'ts-loader',
                    options: {
                        appendTsSuffixTo: [/\.vue$/],
                        ignoreDiagnostics: [2322]
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
                    // include: path.resolve(__dirname, 'src'),
                    loader: 'css-loader'
                },
                {
                    test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                    // include: path.resolve(__dirname, 'src'),
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
            exportsFields: [],
            roots: [
                path.resolve(__dirname, './')
            ],
            modules: [
                'node_modules'
            ],
            alias: {
                '@': path.resolve(__dirname, 'src/'),
                'vue-i18n': 'vue-i18n/dist/vue-i18n.esm-bundler.js'
            },
            extensions: ['.js', '.mjs', '.ts', '.vue', '.json']
        },
        plugins: [
            new DefinePlugin({
                __VUE_OPTIONS_API__: true,
                __VUE_PROD_DEVTOOLS__: false,
                __VUE_I18N_FULL_INSTALL__: true,
                __VUE_I18N_LEGACY_API__: true,
                __INTLIFY_PROD_DEVTOOLS__: false
            }),
            new ForkTsCheckerWebpackPlugin(),
            new ProgressPlugin({
                activeModules: true
            }),
            new CleanWebpackPlugin(),
            new CopyWebpackPlugin({
                patterns: [
                    { from: path.resolve(__dirname, 'src/assets/favicon'), to: '[name][ext]' },
                    { from: path.resolve(__dirname, 'src/css'), to: 'css/[name][ext]' },
                    { from: path.resolve(__dirname, 'src/css/fonts'), to: 'css/fonts' },
                    { from: path.resolve(__dirname, 'src/assets/fonts'), to: 'fonts' },
                    { from: path.resolve(__dirname, 'src/assets/icons'), to: 'icons' },
                    { from: path.resolve(__dirname, 'src/assets/images'), to: 'images' },
                    { from: path.resolve(__dirname, 'src/workers'), to: 'js/workers' },
                    { from: path.resolve(__dirname, 'src/lib/feature-detection/workers'), to: 'js/lib/feature-detection/workers' },
                    { from: path.resolve(__dirname, 'node_modules/bootstrap-icons/font/fonts'), to: 'css/fonts' }
                ]
            }),
            new VueLoaderPlugin(),
            ...plugins
        ],
        watchOptions: {
            ignored: /node_modules/
        },
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
                    bezierJs: {
                        test: /[\\/]node_modules[\\/](bezier-js)[\\/]/,
                        name: 'bezier-js'
                    },
                    colorNamer: {
                        test: /[\\/]node_modules[\\/](color-namer)[\\/]/,
                        name: 'color-namer'
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
                    eruda: {
                        test: /[\\/]node_modules[\\/](eruda)[\\/]/,
                        name: 'eruda'
                    },
                    exprEval: {
                        test: /[\\/]node_modules[\\/](expr-eval)[\\/]/,
                        name: 'expr-eval'
                    },
                    floatingUi: {
                        test: /[\\/]node_modules[\\/](@floating-ui)[\\/]/,
                        name: 'floating-ui'
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
                        test: /[\\/]src[\\/]ui[\\/](el-input-number|el-input-group)/,
                        name: 'og-element-input'
                    },
                    opengraphicaElementForm: {
                        test: /[\\/]src[\\/]ui[\\/](el-form-item-group|el-form-item-aligned-groups)/,
                        name: 'og-element-form'
                    },
                    opentype: {
                        test: /[\\/]node_modules[\\/](opentype)[\\/]/,
                        name: 'opentype'
                    },
                    pica: {
                        test: /[\\/]node_modules[\\/]pica[\\/]/,
                        name: 'pica',
                    },
                    polyfill: {
                        test: /[\\/]node_modules[\\/](resize-observer-polyfill)[\\/]/,
                        name: 'polyfill'
                    },
                    threeCameras: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](cameras)[\\/]/,
                        name: 'three-cameras'
                    },
                    threeCore: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](core)[\\/]/,
                        name: 'three-core'
                    },
                    threeExtras: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](extras)[\\/]/,
                        name: 'three-extras'
                    },
                    threeGeometries: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](geometries)[\\/]/,
                        name: 'three-geometries'
                    },
                    threeHelpers: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](helpers)[\\/]/,
                        name: 'three-helpers'
                    },
                    threeLights: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](lights)[\\/]/,
                        name: 'three-lights'
                    },
                    threeLoaders: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](loaders)[\\/]/,
                        name: 'three-loaders'
                    },
                    threeMaterials: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](materials)[\\/]/,
                        name: 'three-materials'
                    },
                    threeMath: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](math)[\\/]/,
                        name: 'three-math'
                    },
                    threeObjects: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](objects)[\\/]/,
                        name: 'three-objects'
                    },
                    threeRenderers: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](renderers)[\\/]/,
                        name: 'three-renderers'
                    },
                    threeScenes: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](scenes)[\\/]/,
                        name: 'three-scenes'
                    },
                    threeTextures: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](textures)[\\/]/,
                        name: 'three-textures'
                    },
                    threeConstants: {
                        test: /[\\/]node_modules[\\/](three)[\\/](src)[\\/](constants)/,
                        name: 'three-constants'
                    },
                    vendor: {
                        test: /[\\/]node_modules[\\/](lodash|dayjs|file-saver|mitt|normalize-wheel)/,
                        name: 'vendor'
                    },
                    vue: {
                        test: /[\\/]node_modules[\\/](\@vue|vue)[\\/]/,
                        name: 'vue'
                    },
                    vueI18n: {
                        test: /[\\/]node_modules[\\/]vue-i18n[\\/]/,
                        name: 'vue-i18n'
                    }
                }
            }
        },
        ...config
    };
};
