module.exports = {
    webpack: {
        configure: (webpackConfig) => {
            // Ignore source-map warnings from face-api.js
            webpackConfig.ignoreWarnings = [
                function (warning) {
                    return (
                        warning.module &&
                        warning.module.resource &&
                        warning.module.resource.includes('face-api.js')
                    );
                },
            ];
            return webpackConfig;
        },
    },
};
