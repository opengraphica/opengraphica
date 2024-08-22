<template>
    <component v-if="isAllPluginsLoaded && isThemeLoaded && AppMainComponent" :is="AppMainComponent" />
    <div
        v-if="isShowingPreloadAnimation"
        class="ogr-preload"
        :class="{
            'ogr-preload--fade-out': isHidingPreloadAnimation,    
        }"
        @transitionend="onPreloadTransitionEnd()"
        @click="onClickPreload"
    >
        <div class="ogr-preload__logo">
            <svg
                viewBox="-30 0 840 168.59"
                width="791.31"
                height="168.59"
            >
                <g class="ogr-preload__logo__icon">
                    <g transform="translate(-559.34,-404.7)">
                        <path class="ogr-preload__logo__icon-background" d="M 718.49,573.29 H 578.26 c -10.45,0 -18.92,-8.47 -18.92,-18.92 V 423.62 c 0,-10.45 8.47,-18.92 18.92,-18.92 h 140.23 c 10.45,0 18.92,8.47 18.92,18.92 v 130.75 c 0,10.45 -8.47,18.92 -18.92,18.92 z" />
                        <g class="ogr-preload__logo__icon-fill" transform="matrix(1.2238877,0,0,1.2661526,-156.90615,-149.146)">
                            <path d="m 687.93,498.3 c -7,3.41 -13.48,7.74 -19.41,13.01 0.75,-1.66 1.44,-3.33 2.04,-5.04 2.52,-7.25 3.28,-15.11 4.9,-23.13 5.36,4.29 9.25,9.48 12.47,15.16 z" />
                            <path d="m 657.99,449.36 c -11.14,12.75 -14.21,27.85 -15.65,44.4 -8.57,-7.09 -13.44,-15.43 -17.32,-24.38 6.27,-11.97 19.89,-20.45 32.97,-20.02 z" />
                            <path d="m 697.61,494.31 c -2.77,0.95 -5.47,2.04 -8.09,3.25 -2.63,-4.03 -5.31,-8 -8.51,-11.48 -5.03,-5.48 -11.43,-9.71 -17.38,-14.61 9.62,-4.06 19.45,-3.87 29.79,-1.97 4.18,8.2 5.6,16.51 4.19,24.81 z" />
                            <path d="m 691.51,466.99 c -16.43,-2.83 -30.46,2.43 -44.09,9.78 -0.7,-6.36 5.57,-19.27 12.94,-27.32 10.56,-1.09 24.64,6.55 31.15,17.54 z" />
                            <path d="m 670.57,499.49 c -0.93,5.37 -2.64,10.12 -4.93,14.49 -2.55,2.46 -5,5.1 -7.33,7.93 -4.38,-4.62 -8.99,-8.77 -13.92,-12.52 8.99,-1.56 17.56,-5.35 26.18,-9.9 z" />
                            <path d="m 653.99,504.67 c -3.41,1.54 -7.55,2.56 -11.86,3.04 -2.11,-1.53 -4.28,-2.99 -6.51,-4.39 -4.92,-3.08 -9.84,-5.66 -14.82,-7.75 -1.45,-7.7 -0.34,-15.77 3,-24.51 6.41,15.05 16.66,25.49 30.19,33.61 z" />
                            <path d="m 712.56,493.52 c -10.15,12.57 -20.31,25.13 -30.43,37.65 h -47.44 c -9.95,-12.29 -20.02,-24.74 -30.56,-37.77 6.28,1.35 12.07,3.31 17.53,5.77 4.29,1.93 8.4,4.17 12.38,6.67 1.13,0.71 2.25,1.44 3.35,2.18 0.93,0.64 1.86,1.28 2.78,1.95 6.33,4.57 12.16,9.78 17.56,15.69 0.25,0.27 0.49,0.53 0.74,0.81 1.88,-2.45 3.84,-4.76 5.88,-6.95 7.31,-7.87 15.62,-14.09 24.99,-18.62 0.6,-0.29 1.2,-0.57 1.8,-0.85 1.87,-0.85 3.78,-1.64 5.73,-2.35 4.97,-1.83 10.19,-3.22 15.69,-4.18 z" />
                            <path d="m 712.56,493.52 c -10.15,12.57 -20.31,25.13 -30.43,37.65 h -47.44 c -9.95,-12.29 -20.02,-24.74 -30.56,-37.77 6.28,1.35 12.07,3.31 17.53,5.77 4.29,1.93 8.4,4.17 12.38,6.67 1.13,0.71 2.25,1.44 3.35,2.18 0.93,0.64 1.86,1.28 2.78,1.95 6.33,4.57 12.16,9.78 17.56,15.69 0.25,0.27 0.49,0.53 0.74,0.81 1.88,-2.45 3.84,-4.76 5.88,-6.95 7.31,-7.87 15.62,-14.09 24.99,-18.62 0.6,-0.29 1.2,-0.57 1.8,-0.85 1.87,-0.85 3.78,-1.64 5.73,-2.35 4.97,-1.83 10.19,-3.22 15.69,-4.18 z" />
                            <path d="m 638.97,536.56 c 13.22,0 25.73,0 38.86,0 -6.63,8.18 -12.94,15.95 -19.45,23.98 -6.54,-8.09 -12.76,-15.78 -19.41,-23.98 z" />
                        </g>
                    </g>
                </g>
                <g transform="translate(-559.34,-404.7)">
                    <g class="ogr-preload__logo__sub-text">
                        <path d="m 1169.83,558.32 h -2.88 v -21.86 h 2.88 z" />
                        <path d="m 1177.27,542.08 0.08,1.8 c 1.19,-1.4 2.8,-2.1 4.82,-2.1 2.27,0 3.82,0.87 4.64,2.61 0.54,-0.78 1.24,-1.41 2.11,-1.89 0.87,-0.48 1.89,-0.72 3.07,-0.72 3.56,0 5.37,1.89 5.43,5.66 v 10.88 h -2.78 V 547.6 c 0,-1.16 -0.27,-2.03 -0.8,-2.6 -0.53,-0.58 -1.42,-0.86 -2.67,-0.86 -1.03,0 -1.89,0.31 -2.57,0.92 -0.68,0.62 -1.08,1.44 -1.19,2.48 v 10.78 h -2.79 v -10.64 c 0,-2.36 -1.16,-3.54 -3.47,-3.54 -1.82,0 -3.07,0.78 -3.74,2.33 v 11.86 h -2.78 v -16.24 h 2.64 z" />
                        <path d="m 1211.63,558.32 c -0.16,-0.32 -0.29,-0.89 -0.39,-1.71 -1.29,1.34 -2.83,2.01 -4.62,2.01 -1.6,0 -2.92,-0.45 -3.94,-1.36 -1.03,-0.91 -1.54,-2.05 -1.54,-3.44 0,-1.69 0.64,-3 1.93,-3.94 1.29,-0.94 3.09,-1.4 5.43,-1.4 h 2.7 v -1.28 c 0,-0.97 -0.29,-1.74 -0.87,-2.32 -0.58,-0.58 -1.44,-0.86 -2.57,-0.86 -0.99,0 -1.82,0.25 -2.49,0.75 -0.67,0.5 -1.01,1.11 -1.01,1.82 h -2.79 c 0,-0.81 0.29,-1.59 0.86,-2.35 0.58,-0.76 1.36,-1.35 2.34,-1.79 0.99,-0.44 2.07,-0.66 3.25,-0.66 1.87,0 3.34,0.47 4.4,1.4 1.06,0.94 1.61,2.22 1.65,3.87 v 7.48 c 0,1.49 0.19,2.68 0.57,3.56 v 0.24 h -2.91 z m -4.6,-2.11 c 0.87,0 1.7,-0.23 2.48,-0.68 0.78,-0.45 1.35,-1.04 1.7,-1.76 v -3.33 h -2.18 c -3.4,0 -5.1,1 -5.1,2.99 0,0.87 0.29,1.55 0.87,2.04 0.57,0.49 1.31,0.74 2.23,0.74 z" />
                        <path d="m 1217.67,550.07 c 0,-2.53 0.58,-4.55 1.76,-6.04 1.18,-1.49 2.72,-2.24 4.65,-2.24 1.98,0 3.53,0.7 4.64,2.1 l 0.13,-1.8 h 2.54 v 15.85 c 0,2.1 -0.62,3.76 -1.87,4.97 -1.25,1.21 -2.92,1.82 -5.02,1.82 -1.17,0 -2.32,-0.25 -3.44,-0.75 -1.12,-0.5 -1.98,-1.19 -2.57,-2.06 l 1.44,-1.67 c 1.19,1.47 2.65,2.21 4.37,2.21 1.35,0 2.4,-0.38 3.16,-1.14 0.76,-0.76 1.13,-1.83 1.13,-3.21 v -1.4 c -1.11,1.28 -2.63,1.92 -4.55,1.92 -1.9,0 -3.44,-0.77 -4.62,-2.3 -1.18,-1.53 -1.75,-3.62 -1.75,-6.26 z m 2.79,0.31 c 0,1.83 0.38,3.27 1.13,4.32 0.75,1.05 1.8,1.57 3.15,1.57 1.75,0 3.04,-0.8 3.86,-2.39 v -7.42 c -0.85,-1.55 -2.13,-2.33 -3.83,-2.33 -1.35,0 -2.41,0.53 -3.17,1.58 -0.76,1.05 -1.14,2.61 -1.14,4.67 z" />
                        <path d="m 1242.32,558.62 c -2.2,0 -3.99,-0.72 -5.37,-2.17 -1.38,-1.45 -2.07,-3.38 -2.07,-5.8 v -0.51 c 0,-1.61 0.31,-3.05 0.92,-4.32 0.61,-1.27 1.48,-2.26 2.58,-2.97 1.11,-0.72 2.3,-1.07 3.6,-1.07 2.11,0 3.75,0.7 4.92,2.09 1.17,1.39 1.76,3.38 1.76,5.97 V 551 h -11 c 0.04,1.6 0.51,2.89 1.4,3.88 0.89,0.99 2.03,1.48 3.42,1.48 0.98,0 1.81,-0.2 2.49,-0.6 0.68,-0.4 1.28,-0.93 1.79,-1.59 l 1.7,1.32 c -1.38,2.09 -3.42,3.13 -6.14,3.13 z m -0.35,-14.56 c -1.12,0 -2.06,0.41 -2.82,1.22 -0.76,0.82 -1.23,1.96 -1.41,3.43 h 8.14 v -0.21 c -0.08,-1.41 -0.46,-2.5 -1.14,-3.28 -0.69,-0.77 -1.61,-1.16 -2.77,-1.16 z" />
                        <path d="m 1272.27,548.22 h -9.47 v 7.75 h 11 v 2.36 h -13.89 v -21.86 h 13.74 v 2.36 h -10.85 v 7.04 h 9.47 z" />
                        <path d="m 1276.28,550.07 c 0,-2.49 0.59,-4.5 1.77,-6.01 1.18,-1.51 2.73,-2.27 4.64,-2.27 1.9,0 3.41,0.65 4.52,1.95 v -8.47 h 2.78 v 23.06 h -2.55 l -0.13,-1.74 c -1.11,1.36 -2.66,2.04 -4.64,2.04 -1.88,0 -3.42,-0.77 -4.6,-2.31 -1.19,-1.54 -1.78,-3.55 -1.78,-6.03 v -0.22 z m 2.77,0.31 c 0,1.84 0.38,3.28 1.14,4.32 0.76,1.04 1.81,1.56 3.15,1.56 1.76,0 3.05,-0.79 3.86,-2.37 v -7.46 c -0.83,-1.53 -2.11,-2.3 -3.83,-2.3 -1.36,0 -2.42,0.53 -3.18,1.58 -0.76,1.05 -1.14,2.61 -1.14,4.67 z" />
                        <path d="m 1294.31,537.77 c 0,-0.45 0.14,-0.83 0.41,-1.14 0.27,-0.31 0.68,-0.47 1.22,-0.47 0.54,0 0.95,0.16 1.23,0.47 0.28,0.31 0.42,0.69 0.42,1.14 0,0.45 -0.14,0.83 -0.42,1.13 -0.28,0.3 -0.69,0.45 -1.23,0.45 -0.54,0 -0.95,-0.15 -1.22,-0.45 -0.27,-0.3 -0.41,-0.68 -0.41,-1.13 z m 3,20.55 h -2.78 v -16.24 h 2.78 z" />
                        <path d="m 1305.52,538.15 v 3.93 h 3.03 v 2.15 h -3.03 v 10.09 c 0,0.65 0.13,1.14 0.41,1.47 0.27,0.33 0.73,0.49 1.38,0.49 0.32,0 0.76,-0.06 1.32,-0.18 v 2.24 c -0.73,0.2 -1.44,0.3 -2.13,0.3 -1.24,0 -2.18,-0.38 -2.81,-1.13 -0.63,-0.75 -0.95,-1.82 -0.95,-3.2 v -10.07 h -2.96 v -2.15 h 2.96 v -3.93 h 2.78 z" />
                        <path d="m 1310.76,550.05 c 0,-1.59 0.31,-3.02 0.94,-4.29 0.62,-1.27 1.5,-2.25 2.61,-2.94 1.12,-0.69 2.39,-1.04 3.82,-1.04 2.21,0 4,0.77 5.37,2.3 1.37,1.53 2.05,3.57 2.05,6.11 v 0.2 c 0,1.58 -0.3,3 -0.91,4.26 -0.61,1.26 -1.47,2.23 -2.6,2.94 -1.13,0.71 -2.42,1.05 -3.88,1.05 -2.2,0 -3.99,-0.77 -5.35,-2.3 -1.36,-1.53 -2.05,-3.56 -2.05,-6.08 z m 2.79,0.33 c 0,1.8 0.42,3.25 1.25,4.34 0.83,1.09 1.95,1.64 3.35,1.64 1.41,0 2.53,-0.55 3.36,-1.66 0.83,-1.11 1.25,-2.65 1.25,-4.65 0,-1.78 -0.42,-3.23 -1.27,-4.33 -0.85,-1.1 -1.97,-1.66 -3.37,-1.66 -1.37,0 -2.48,0.55 -3.32,1.64 -0.83,1.09 -1.25,2.65 -1.25,4.68 z" />
                        <path d="m 1336.88,544.57 c -0.42,-0.07 -0.88,-0.1 -1.37,-0.1 -1.82,0 -3.06,0.78 -3.71,2.33 v 11.53 h -2.78 v -16.24 h 2.7 l 0.04,1.88 c 0.91,-1.45 2.2,-2.18 3.87,-2.18 0.54,0 0.95,0.07 1.23,0.21 v 2.57 z" />
                    </g>
                    <g class="ogr-preload__logo__main-text">
                        <path d="m 823.18,492.52 c 0,6.55 -1.1,12.26 -3.3,17.14 -2.2,4.88 -5.32,8.61 -9.36,11.18 -4.04,2.57 -8.75,3.86 -14.14,3.86 -5.26,0 -9.93,-1.29 -14,-3.88 -4.07,-2.58 -7.23,-6.27 -9.48,-11.06 -2.25,-4.79 -3.4,-10.33 -3.46,-16.64 v -4.82 c 0,-6.43 1.12,-12.1 3.35,-17.03 2.23,-4.93 5.39,-8.7 9.48,-11.31 4.08,-2.62 8.76,-3.92 14.02,-3.92 5.35,0 10.07,1.29 14.16,3.88 4.08,2.59 7.23,6.33 9.43,11.24 2.2,4.91 3.3,10.62 3.3,17.14 z m -8.77,-4.31 c 0,-7.92 -1.59,-14.01 -4.77,-18.24 -3.18,-4.24 -7.63,-6.36 -13.36,-6.36 -5.57,0 -9.95,2.12 -13.15,6.36 -3.2,4.24 -4.84,10.12 -4.93,17.65 v 4.91 c 0,7.68 1.61,13.72 4.84,18.11 3.23,4.39 7.67,6.59 13.33,6.59 5.69,0 10.1,-2.07 13.22,-6.22 3.12,-4.15 4.73,-10.09 4.82,-17.83 z" />
                        <path d="m 877.01,499.5 c 0,7.56 -1.73,13.65 -5.19,18.27 -3.46,4.62 -8.14,6.93 -14.04,6.93 -6.03,0 -10.77,-1.91 -14.23,-5.74 v 23.91 h -8.49 v -68.75 h 7.76 l 0.41,5.51 c 3.46,-4.28 8.26,-6.43 14.41,-6.43 5.97,0 10.69,2.25 14.16,6.75 3.47,4.5 5.21,10.76 5.21,18.77 z m -8.49,-0.97 c 0,-5.6 -1.19,-10.02 -3.58,-13.26 -2.39,-3.24 -5.66,-4.86 -9.82,-4.86 -5.14,0 -9,2.28 -11.57,6.84 v 23.73 c 2.54,4.53 6.43,6.79 11.66,6.79 4.07,0 7.3,-1.61 9.71,-4.84 2.4,-3.23 3.6,-8.03 3.6,-14.4 z" />
                        <path d="m 908.41,524.7 c -6.73,0 -12.21,-2.21 -16.43,-6.63 -4.22,-4.42 -6.33,-10.33 -6.33,-17.74 v -1.56 c 0,-4.93 0.94,-9.32 2.82,-13.19 1.88,-3.87 4.51,-6.9 7.89,-9.09 3.38,-2.19 7.04,-3.28 10.99,-3.28 6.46,0 11.47,2.13 15.05,6.38 3.58,4.25 5.37,10.34 5.37,18.27 v 3.53 h -33.64 c 0.12,4.9 1.55,8.85 4.29,11.86 2.74,3.01 6.22,4.52 10.44,4.52 3,0 5.54,-0.61 7.62,-1.84 2.08,-1.22 3.9,-2.85 5.46,-4.86 l 5.19,4.04 c -4.16,6.39 -10.4,9.59 -18.72,9.59 z m -1.06,-44.52 c -3.43,0 -6.3,1.25 -8.63,3.74 -2.33,2.49 -3.76,5.99 -4.31,10.49 h 24.88 v -0.64 c -0.25,-4.31 -1.41,-7.66 -3.49,-10.03 -2.09,-2.38 -4.9,-3.56 -8.45,-3.56 z" />
                        <path d="m 945.63,474.12 0.28,6.24 c 3.79,-4.77 8.75,-7.16 14.87,-7.16 10.49,0 15.79,5.92 15.88,17.76 v 32.82 h -8.49 v -32.86 c -0.03,-3.58 -0.85,-6.23 -2.46,-7.94 -1.61,-1.71 -4.11,-2.57 -7.5,-2.57 -2.75,0 -5.17,0.73 -7.25,2.2 -2.08,1.47 -3.7,3.4 -4.87,5.78 v 35.39 h -8.49 v -49.66 z" />
                        <path d="m 1040.12,515.01 c -2.26,3.24 -5.42,5.67 -9.48,7.27 -4.05,1.61 -8.77,2.41 -14.16,2.41 -5.45,0 -10.28,-1.28 -14.5,-3.83 -4.22,-2.55 -7.49,-6.19 -9.8,-10.9 -2.31,-4.71 -3.5,-10.17 -3.56,-16.38 v -5.83 c 0,-10.07 2.35,-17.87 7.04,-23.41 4.7,-5.54 11.3,-8.31 19.8,-8.31 6.98,0 12.59,1.78 16.84,5.35 4.25,3.56 6.85,8.62 7.8,15.17 h -8.81 c -1.65,-8.87 -6.92,-13.31 -15.79,-13.31 -5.91,0 -10.38,2.08 -13.42,6.22 -3.04,4.15 -4.58,10.16 -4.61,18.03 v 5.47 c 0,7.5 1.71,13.47 5.14,17.89 3.43,4.43 8.06,6.64 13.91,6.64 3.3,0 6.2,-0.37 8.67,-1.1 2.47,-0.73 4.53,-1.97 6.15,-3.71 v -14.97 h -15.47 v -7.21 h 24.23 v 24.51 z" />
                        <path d="m 1077.48,481.74 c -1.29,-0.21 -2.68,-0.32 -4.18,-0.32 -5.57,0 -9.35,2.37 -11.34,7.11 v 35.25 h -8.49 v -49.66 h 8.26 l 0.14,5.74 c 2.78,-4.44 6.73,-6.66 11.84,-6.66 1.65,0 2.91,0.21 3.76,0.64 v 7.9 z" />
                        <path d="m 1114.11,523.78 c -0.49,-0.98 -0.89,-2.72 -1.19,-5.23 -3.95,4.1 -8.66,6.15 -14.14,6.15 -4.9,0 -8.91,-1.38 -12.05,-4.15 -3.14,-2.77 -4.7,-6.28 -4.7,-10.53 0,-5.17 1.96,-9.19 5.9,-12.05 3.93,-2.86 9.46,-4.29 16.59,-4.29 h 8.26 v -3.9 c 0,-2.97 -0.89,-5.33 -2.66,-7.09 -1.78,-1.76 -4.39,-2.64 -7.85,-2.64 -3.03,0 -5.57,0.77 -7.62,2.29 -2.05,1.53 -3.08,3.38 -3.08,5.55 h -8.54 c 0,-2.48 0.88,-4.87 2.64,-7.18 1.76,-2.31 4.15,-4.14 7.16,-5.48 3.01,-1.35 6.33,-2.02 9.94,-2.02 5.72,0 10.2,1.43 13.45,4.29 3.24,2.86 4.93,6.8 5.05,11.82 v 22.86 c 0,4.56 0.58,8.19 1.74,10.88 v 0.73 h -8.9 z m -14.09,-6.47 c 2.66,0 5.19,-0.69 7.57,-2.07 2.38,-1.38 4.12,-3.17 5.19,-5.37 v -10.19 h -6.66 c -10.4,0 -15.6,3.04 -15.6,9.13 0,2.66 0.89,4.74 2.66,6.24 1.78,1.51 4.05,2.26 6.84,2.26 z" />
                        <path d="m 1176.53,499.5 c 0,7.56 -1.73,13.65 -5.19,18.27 -3.46,4.62 -8.14,6.93 -14.04,6.93 -6.03,0 -10.77,-1.91 -14.23,-5.74 v 23.91 h -8.49 v -68.75 h 7.76 l 0.41,5.51 c 3.46,-4.28 8.26,-6.43 14.41,-6.43 5.97,0 10.69,2.25 14.16,6.75 3.47,4.5 5.21,10.76 5.21,18.77 z m -8.49,-0.97 c 0,-5.6 -1.19,-10.02 -3.58,-13.26 -2.39,-3.24 -5.66,-4.86 -9.82,-4.86 -5.14,0 -9,2.28 -11.57,6.84 v 23.73 c 2.54,4.53 6.43,6.79 11.66,6.79 4.07,0 7.3,-1.61 9.71,-4.84 2.39,-3.23 3.6,-8.03 3.6,-14.4 z" />
                        <path d="m 1195.8,480.13 c 3.76,-4.62 8.66,-6.93 14.69,-6.93 10.49,0 15.79,5.92 15.88,17.76 v 32.82 h -8.49 v -32.86 c -0.03,-3.58 -0.85,-6.23 -2.46,-7.94 -1.61,-1.71 -4.11,-2.57 -7.5,-2.57 -2.75,0 -5.17,0.73 -7.25,2.2 -2.08,1.47 -3.7,3.4 -4.87,5.78 v 35.39 h -8.49 v -70.5 h 8.49 z" />
                        <path d="m 1239.13,460.95 c 0,-1.38 0.42,-2.54 1.26,-3.49 0.84,-0.95 2.09,-1.42 3.74,-1.42 1.65,0 2.91,0.47 3.76,1.42 0.86,0.95 1.29,2.11 1.29,3.49 0,1.38 -0.43,2.52 -1.29,3.44 -0.86,0.92 -2.11,1.38 -3.76,1.38 -1.65,0 -2.9,-0.46 -3.74,-1.38 -0.84,-0.92 -1.26,-2.07 -1.26,-3.44 z m 9.18,62.83 h -8.49 v -49.66 h 8.49 z" />
                        <path d="m 1281.81,517.76 c 3.03,0 5.68,-0.92 7.94,-2.75 2.26,-1.84 3.52,-4.13 3.76,-6.88 h 8.03 c -0.15,2.85 -1.13,5.55 -2.94,8.12 -1.81,2.57 -4.21,4.62 -7.23,6.15 -3.01,1.53 -6.2,2.29 -9.57,2.29 -6.76,0 -12.14,-2.26 -16.13,-6.77 -3.99,-4.51 -5.99,-10.69 -5.99,-18.52 v -1.42 c 0,-4.83 0.89,-9.13 2.66,-12.9 1.77,-3.76 4.32,-6.69 7.64,-8.77 3.32,-2.08 7.24,-3.12 11.77,-3.12 5.57,0 10.2,1.67 13.88,5 3.69,3.34 5.65,7.66 5.9,12.99 h -8.03 c -0.25,-3.21 -1.46,-5.85 -3.65,-7.92 -2.19,-2.07 -4.89,-3.1 -8.1,-3.1 -4.31,0 -7.66,1.55 -10.03,4.66 -2.37,3.11 -3.56,7.6 -3.56,13.47 v 1.61 c 0,5.72 1.18,10.13 3.53,13.22 2.38,3.1 5.75,4.64 10.12,4.64 z" />
                        <path d="m 1341.75,523.78 c -0.49,-0.98 -0.89,-2.72 -1.19,-5.23 -3.95,4.1 -8.66,6.15 -14.14,6.15 -4.9,0 -8.91,-1.38 -12.05,-4.15 -3.14,-2.77 -4.7,-6.28 -4.7,-10.53 0,-5.17 1.96,-9.19 5.9,-12.05 3.93,-2.86 9.46,-4.29 16.59,-4.29 h 8.26 v -3.9 c 0,-2.97 -0.89,-5.33 -2.66,-7.09 -1.78,-1.76 -4.39,-2.64 -7.85,-2.64 -3.03,0 -5.57,0.77 -7.62,2.29 -2.05,1.53 -3.08,3.38 -3.08,5.55 h -8.54 c 0,-2.48 0.88,-4.87 2.64,-7.18 1.76,-2.31 4.15,-4.14 7.16,-5.48 3.01,-1.35 6.33,-2.02 9.94,-2.02 5.72,0 10.2,1.43 13.45,4.29 3.24,2.86 4.93,6.8 5.05,11.82 v 22.86 c 0,4.56 0.58,8.19 1.74,10.88 v 0.73 h -8.9 z m -14.09,-6.47 c 2.66,0 5.19,-0.69 7.57,-2.07 2.38,-1.38 4.12,-3.17 5.19,-5.37 v -10.19 h -6.66 c -10.4,0 -15.6,3.04 -15.6,9.13 0,2.66 0.89,4.74 2.66,6.24 1.78,1.51 4.06,2.26 6.84,2.26 z" />
                    </g>
                </g>
            </svg>
            <img class="ogr-preload__hidden-image" src="images/logo-full-dark.svg" aria-hidden="true" >
            <img class="ogr-preload__hidden-image" src="images/logo-full-light.svg" aria-hidden="true" >
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, markRaw, nextTick, provide, ref, watch, type Component } from 'vue';
import { useAppPreloadBlocker, isAppPreloading } from '@/composables/app-preload-blocker';
import { usePlugin, getAppConfig } from '@/composables/app-plugin';
import appEmitter from '@/lib/emitter';

import type { Notify } from 'element-plus/lib/components/notification/src/notification.d';

export default defineComponent({
    name: 'App',
    setup() {
        const { loading: isPreloadBlocked } = useAppPreloadBlocker(); 

        /*------------------*\
        | Import Vue Plugins |
        \*------------------*/

        const isI18nPluginLoaded = ref(false);
        import('@/i18n').then(({ default: i18n }) => {
            usePlugin(i18n);
            isI18nPluginLoaded.value = true;
        });

        const isNotificationPluginLoaded = ref(false);
        const $notify = ref<Notify>();
        provide('$notify', $notify);
        Promise.all([
            import('element-plus/lib/components/notification/index'),
            import('@/lib/notify'),
        ]).then((results) => {
            const [{ default: ElNotification }, { notifyPolyfill }] = results;
            // Notification toasts
            usePlugin(ElNotification);
            $notify.value = markRaw(notifyPolyfill(getAppConfig().globalProperties.$notify));
            appEmitter.on('app.notify', (options) => {
                const instance = notifyPolyfill(getAppConfig().globalProperties.$notify)(options);
                if (options?.onCreated) {
                    options.onCreated(instance);
                }
            });
            isNotificationPluginLoaded.value = true;
        });

        const isAllPluginsLoaded = computed(() => {
            return (
                isI18nPluginLoaded.value &&
                isNotificationPluginLoaded.value
            );
        });

        /*-----------------------------*\
        | Asynchronously Import Main UI |
        \*-----------------------------*/

        const AppMainComponent = ref<Component | null>(null);

        import('@/ui/app/app-main.vue').then(({ default: component }) => {
            AppMainComponent.value = markRaw(component);
            nextTick(() => {
                isPreloadBlocked.value = false;
            });
        });

        /*-------------------*\
        | Check Themes Loaded |
        \*-------------------*/

        const isThemeLoaded = ref(false);

        import('@/store/editor').then(({ default: editorStore }) => {
            const themeLoadUnwatch = watch(() => editorStore.state.activeTheme, (activeTheme) => {
                if (activeTheme != null) {
                    isThemeLoaded.value = true;
                    themeLoadUnwatch();
                }
            }, { immediate: true });
        });

        /*----------------------*\
        | Show Preload Animation |
        \*----------------------*/

        const isShowingPreloadAnimation = ref(true);
        const isHidingPreloadAnimation = ref(false);

        const isPreloading = computed(() => {
            return (
                !AppMainComponent.value ||
                !isThemeLoaded.value ||
                !isAllPluginsLoaded.value ||
                isAppPreloading.value
            );
        });

        watch(() => isPreloading.value, (isPreloading, wasPreloading) => {
            if (!isPreloading && wasPreloading) {
                isHidingPreloadAnimation.value = true;
            }
        });

        function onPreloadTransitionEnd() {
            if (isHidingPreloadAnimation.value) {
                isShowingPreloadAnimation.value = false;
                isHidingPreloadAnimation.value = false;
            }
        }

        function onClickPreload() {
            document?.body?.focus();
        }

        /*-----------------------------------*\
        | Quickly Show Default Loading Screen |
        \*-----------------------------------*/

        const preloadStyle = `
            .ogr-preload {
                background: var(--ogr-preload-background, white);
                color: #333;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 5rem rgba(0,0,0,0.05) inset, 0 0 2rem rgba(0,0,0,0.05) inset;
                opacity: 1;
                max-width: 200vw;
                max-height: 200vh;
                z-index: 9999999;
            }
            .ogr-preload--fade-out {
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.5s;
            }
            body.ogr-full-page .ogr-preload {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
            }
            .ogr-preload__hidden-image {
                position: absolute;
                width: 1px;
                height: 1px;
                opacity: 0.01;
            }
            .ogr-preload__logo {
                display: block;
                position: relative;
                animation: ogr-preload-logo-fade-in 0.3s forwards;
                margin: 1rem 4rem;
            }
            @keyframes ogr-preload-logo-fade-in {
                0% {
                    opacity: 0;
                }
                100% {
                    opacity: 1;
                }
            }
            .ogr-preload__logo svg {
                width: 25rem;
                max-width: 100%;
            }
            .ogr-preload__logo__main-text {
                fill: black;
            }
            .ogr-preload__logo__main-text path:nth-child(0) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 0s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(1) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 0.1s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(2) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 0.2s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(3) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 0.3s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(4) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 0.4s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(5) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 0.5s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(6) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 0.6s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(7) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 0.7s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(8) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 0.8s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(9) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 0.9s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(10) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 1s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(11) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 1.1s infinite;
            }
            .ogr-preload__logo__main-text path:nth-child(12) {
                animation: ogr-preload-logo-text-jump 5s ease-in-out 1.2s infinite;
            }
            @keyframes ogr-preload-logo-text-jump {
                60% {
                    transform: translateY(0);
                }
                62% {
                    transform: translateY(5px);
                }
                68% {
                    transform: translateY(-25px);
                }
                76% {
                    transform: translateY(0);
                }
            }
            .ogr-preload__logo__sub-text {
                fill: #5EACF2;
            }
            .ogr-preload__logo__icon {
                animation: ogr-preload-logo-icon-spin 5s ease-in-out infinite;
            }
            @keyframes ogr-preload-logo-icon-spin {
                0% {
                    transform: rotate(0deg);
                    transform-origin: 90px 85px;
                }
                7% {
                    transform: rotate(-5deg);
                    transform-origin: 90px 85px;
                }
                40% {
                    transform: rotate(380deg);
                    transform-origin: 90px 85px;
                }
                53% {
                    transform: rotate(350deg);
                    transform-origin: 90px 85px;
                }
                65% {
                    transform: rotate(360deg);
                    transform-origin: 90px 85px;
                }
                100% {
                    transform: rotate(360deg);
                    transform-origin: 90px 85px;
                }
            }
            .ogr-preload__logo__icon-background {
                fill-rule: evenodd;
                clip-rule: evenodd;
                fill: #5EACF2;
            }
            .ogr-preload__logo__icon-fill {
                fill-rule: evenodd;
                clip-rule: evenodd;
                fill: #FFFFFF;
            }
            @media (prefers-color-scheme: dark) {
                .ogr-preload {
                    background: var(--ogr-preload-background, #1f252d);
                    color: white;
                    box-shadow: 0 0 5rem rgba(0,0,0,0.4) inset, 0 0 2rem rgba(0,0,0,0.05) inset;
                }
                .ogr-preload__logo__main-text {
                    fill: white;
                }
            }
        `;
        const preloadStyleTag = document.createElement('style');
        preloadStyleTag.textContent = preloadStyle;
        document.head.appendChild(preloadStyleTag);

        return {
            isShowingPreloadAnimation,
            isHidingPreloadAnimation,
            isPreloading,
            onPreloadTransitionEnd,
            onClickPreload,
            isThemeLoaded,
            isAllPluginsLoaded,
            AppMainComponent,
        };
    }
})
</script>
