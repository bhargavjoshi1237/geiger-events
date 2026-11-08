import * as SecureStore from "expo-secure-store";

// SecureStore warns above ~2 KB and a Supabase session is larger, so values are split across numbered keys.
const CHUNK = 1800;

async function removeItem(key: string): Promise<void> {
  const count = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
  await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)));
  await SecureStore.deleteItemAsync(`${key}.n`);
}

async function getItem(key: string): Promise<string | null> {
  const count = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
  if (!count) return null;
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
  );
  return parts.some((part) => part === null) ? null : parts.join("");
}

async function setItem(key: string, value: string): Promise<void> {
  await removeItem(key);
  const parts: string[] = [];
  for (let i = 0; i < value.length; ) {
    let end = Math.min(i + CHUNK, value.length);
    // A chunk must not end on a high surrogate, or the pair would split across keys.
    const last = value.charCodeAt(end - 1);
    if (end < value.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    parts.push(value.slice(i, end));
    i = end;
  }
  await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(`${key}.${i}`, part)));
  await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
}

export const secureChunkStorage = { getItem, setItem, removeItem };
