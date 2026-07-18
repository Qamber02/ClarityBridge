import zoomSdk, {
  type Apis,
  type ConfigResponse,
  type GetRTMSStatusResponse,
  type OnRTMSStatusChangeEvent,
  type RunningContext,
} from "@zoom/appssdk";

export type ZoomRuntime = {
  configured: boolean;
  runningContext: RunningContext | "browser";
  clientVersion?: string;
  browserVersion?: string;
  product?: string;
  unsupportedApis: string[];
  supportedApis: string[];
  error?: string;
};

export type RtmsSession = GetRTMSStatusResponse["rtmsStatus"][number] | OnRTMSStatusChangeEvent;

const capabilities: Apis[] = [
  "getAppContext",
  "getRunningContext",
  "getSupportedJsApis",
  "getUserContext",
  "onMeeting",
  "onRunningContextChange",
  "onRTMSStatusChange",
  "startRTMS",
  "stopRTMS",
  "pauseRTMS",
  "resumeRTMS",
  "getRTMSStatus",
  "showNotification",
];

function isZoomWebView() {
  return /ZoomApps|ZoomWebKit/i.test(window.navigator.userAgent);
}

export async function configureZoomApp(): Promise<ZoomRuntime> {
  if (!isZoomWebView()) {
    return {
      configured: false,
      runningContext: "browser",
      unsupportedApis: [],
      supportedApis: [],
      error: "Open inside the Zoom client to enable Zoom SDK and RTMS controls.",
    };
  }

  try {
    const config: ConfigResponse = await zoomSdk.config({
      capabilities,
      popoutSize: { width: 360, height: 720 },
    });
    const supported = await zoomSdk.getSupportedJsApis().catch(() => ({ supportedApis: [] as Apis[] }));

    return {
      configured: true,
      runningContext: config.runningContext,
      clientVersion: config.clientVersion,
      browserVersion: config.browserVersion,
      product: config.product,
      unsupportedApis: config.unsupportedApis,
      supportedApis: supported.supportedApis,
    };
  } catch (reason) {
    return {
      configured: false,
      runningContext: "browser",
      unsupportedApis: capabilities,
      supportedApis: [],
      error: reason instanceof Error ? reason.message : "Zoom SDK configuration failed.",
    };
  }
}

export async function getRtmsSessions(): Promise<RtmsSession[]> {
  const response = await zoomSdk.getRTMSStatus();
  return response.rtmsStatus;
}

export async function startRtms() {
  return zoomSdk.startRTMS();
}

export async function stopRtms() {
  return zoomSdk.stopRTMS();
}

export function onRtmsStatusChange(handler: (event: RtmsSession) => void) {
  zoomSdk.onRTMSStatusChange(handler);
}

export function onMeetingEnded(handler: () => void) {
  zoomSdk.onMeeting((event) => {
    if (event.action === "ended") handler();
  });
}
