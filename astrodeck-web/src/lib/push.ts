// src/lib/push.ts
import { api } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush(): Promise<{ ok: boolean; message?: string }> {
  if (!pushSupported()) return { ok: false, message: "Push não suportado neste navegador." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, message: "Permissão de notificações não concedida." };

  const reg = await navigator.serviceWorker.register("/sw.js");
  const current = await reg.pushManager.getSubscription();
  if (current) {
    await api.pushSubscribe(current);
    return { ok: true };
  }

  const { publicKey } = await api.getVapidPublicKey();

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await api.pushSubscribe(sub);
  return { ok: true };
}

export async function disablePush(): Promise<{ ok: boolean; message?: string }> {
  if (!pushSupported()) return { ok: false, message: "Push não suportado." };

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };

  await api.pushUnsubscribe(sub.endpoint);
  await sub.unsubscribe();
  return { ok: true };
}
