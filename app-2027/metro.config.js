const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// O SDK do Firebase expõe arquivos CommonJS para o React Native.
config.resolver.sourceExts.push('cjs');

module.exports = config;
