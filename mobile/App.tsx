import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation, type WebViewProps } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

// FinTwin en el celular: la app web de https://fintwin.windoce.com dentro de una pantalla nativa,
// con avisos cuando llega una captura, el menú de compartir del teléfono, cámara y fotos, y una
// pantalla propia cuando no hay internet.
const BASE = 'https://fintwin.windoce.com';
const FONDO = '#0b1220';
const ES = (Intl.DateTimeFormat().resolvedOptions().locale ?? '').toLowerCase().startsWith('es');
const T = ES
  ? { sinRed: 'Sin conexión', sinRedTexto: 'Revisa tu internet. Lo que escribiste sigue guardado.', reintentar: 'Intentar de nuevo' }
  : { sinRed: 'No connection', sinRedTexto: 'Check your internet. Anything you typed is still saved.', reintentar: 'Try again' };

void SplashScreen.preventAutoHideAsync();
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Las definiciones de tipos de react-native-webview 14 no resuelven sus props con TypeScript 6
// (las ven como «never»); el componente es el mismo, solo se le da su tipo correcto.
const Web = WebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebView> }>;

type Mensaje = { tipo: 'sesion'; conectado: boolean } | { tipo: 'compartir'; texto: string; url: string };

/** Pide permiso de avisos una sola vez y devuelve el token del celular (o null). */
async function tokenDeAvisos(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const actual = await Notifications.getPermissionsAsync();
  let permiso = actual.status;
  if (permiso !== 'granted' && actual.canAskAgain) permiso = (await Notifications.requestPermissionsAsync()).status;
  if (permiso !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return data;
}

function Pantalla() {
  const web = useRef<WebView>(null);
  const [inicio, setInicio] = useState(`${BASE}/`);
  const [sinRed, setSinRed] = useState(false);
  const [atras, setAtras] = useState(false);

  const ir = useCallback((ruta: string) => {
    const url = ruta.startsWith('http') ? ruta : `${BASE}${ruta}`;
    if (!url.startsWith(BASE)) return;
    web.current?.injectJavaScript(`window.location.assign(${JSON.stringify(url)}); true;`);
  }, []);

  // Tocar un aviso abre la cuenta que tiene la captura por revisar.
  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string') setInicio(`${BASE}${url}`);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r.notification.request.content.data?.url;
      if (typeof url === 'string') ir(url);
    });
    return () => sub.remove();
  }, [ir]);

  // Botón atrás de Android: navega dentro de la app antes de cerrarla.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (atras) {
        web.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [atras]);

  const alMensaje = useCallback(async (e: WebViewMessageEvent) => {
    let m: Mensaje;
    try {
      m = JSON.parse(e.nativeEvent.data) as Mensaje;
    } catch {
      return;
    }
    if (m.tipo === 'compartir') {
      await Share.share(Platform.OS === 'ios' ? { message: m.texto, url: m.url } : { message: `${m.texto} ${m.url}` });
    } else if (m.tipo === 'sesion' && m.conectado) {
      const token = await tokenDeAvisos().catch(() => null);
      if (token) {
        const detalle = JSON.stringify({ token, plataforma: Platform.OS });
        web.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('fintwin-push', { detail: ${detalle} })); true;`,
        );
      }
    }
  }, []);

  // Lo que no es de FinTwin (privacidad, Windoce, enlaces de otros) se abre en el navegador del
  // teléfono; los marcos internos (el escudo anti-robots) cargan normal.
  const alCargar = useCallback((req: ShouldStartLoadRequest) => {
    const { url, isTopFrame } = req;
    if (isTopFrame === false) return true;
    if (url.startsWith(BASE) || url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true;
    if (url.startsWith('http')) void WebBrowser.openBrowserAsync(url);
    return false;
  }, []);

  return (
    <SafeAreaView style={estilos.fondo} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      {sinRed ? (
        <View style={estilos.centro}>
          <Text style={estilos.titulo}>{T.sinRed}</Text>
          <Text style={estilos.texto}>{T.sinRedTexto}</Text>
          <Pressable
            style={estilos.boton}
            onPress={() => {
              setSinRed(false);
              web.current?.reload();
            }}
          >
            <Text style={estilos.botonTexto}>{T.reintentar}</Text>
          </Pressable>
        </View>
      ) : null}
      <Web
        ref={web}
        source={{ uri: inicio }}
        style={[estilos.fondo, sinRed ? estilos.oculto : null]}
        applicationNameForUserAgent="FinTwinApp/1.0"
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => (
          <View style={[estilos.centro, StyleSheet.absoluteFill]}>
            <ActivityIndicator color="#22c55e" />
          </View>
        )}
        onLoadEnd={() => void SplashScreen.hideAsync()}
        onError={() => {
          setSinRed(true);
          void SplashScreen.hideAsync();
        }}
        onNavigationStateChange={(n: WebViewNavigation) => setAtras(n.canGoBack)}
        onShouldStartLoadWithRequest={alCargar}
        onMessage={alMensaje}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Pantalla />
    </SafeAreaProvider>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: FONDO },
  oculto: { display: 'none' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: FONDO },
  titulo: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  texto: { color: '#93a3c4', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  boton: { backgroundColor: '#22c55e', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  botonTexto: { color: '#05210f', fontWeight: '700', fontSize: 16 },
});
