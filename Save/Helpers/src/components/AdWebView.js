import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const AdWebView = () => {
  // HTML com código modificado para compatibilidade com dispositivos móveis
  const adHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            background-color: transparent;
          }
          .ad-container {
            width: 320px;
            height: 48px;
            display: flex;
            justify-content: center;
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div class="ad-container" id="ad-container">
          <!-- Placeholder para anúncio -->
        </div>
        <script>
          // Detectar se está em um ambiente de app móvel
          const isMobileApp = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
          
          if (isMobileApp) {
            // Carregar script do AdMob para apps web móveis
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-app-pub-3940256099942544';
            script.onload = function() {
              // Criar elemento de anúncio
              const adElement = document.createElement('ins');
              adElement.className = 'adsbygoogle';
              adElement.style = 'display:inline-block;width:320px;height:48px';
              adElement.setAttribute('data-ad-client', 'ca-app-pub-3940256099942544');
              adElement.setAttribute('data-ad-slot', '6300978111');
              
              document.getElementById('ad-container').appendChild(adElement);
              
              try {
                (adsbygoogle = window.adsbygoogle || []).push({});
              } catch (e) {
                console.error('AdSense error:', e);
              }
            };
            document.head.appendChild(script);
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: adHTML }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onError={(error) => console.error('WebView error:', error)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 412,
    height: 56,
    backgroundColor: '#0D47A1',
    paddingVertical: 4,
    paddingHorizontal: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  webview: {
    width: 332,
    height: 48,
    backgroundColor: 'transparent',
  },
});

export default AdWebView;