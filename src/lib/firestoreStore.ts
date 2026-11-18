import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestoreDb, handleFirestoreError, OperationType } from './firebase';

export type ChatToolUsed = 'cloudsql' | 'maps' | 'search' | 'general';

export interface GroundingLinkItem {
  title: string;
  uri: string;
  sourceType: 'maps' | 'search';
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  defaultRadiusKm: number;
  preferredTravelMode: 'DRIVE' | 'WALK' | 'TWO_WHEELER';
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'dark',
  defaultRadiusKm: 5,
  preferredTravelMode: 'DRIVE',
};

export interface FirestoreChatSession {
  id: string;
  ownerUid: string;
  title: string;
  companyId: number;
  companyName: string;
  messageCount: number;
  lastMessagePreview: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface FirestoreChatMessage {
  id: string;
  ownerUid: string;
  role: 'user' | 'assistant';
  content: string;
  toolUsed: ChatToolUsed;
  screenContext: string;
  groundingLinks: GroundingLinkItem[];
  sourcesUsed: string[];
  createdAt?: Timestamp | null;
}

export function generateFirestoreId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now()}_${rand}`;
}

function clampRadius(val: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return 5;
  return Math.min(200, Math.max(0.5, n));
}

export async function getUserPreferences(uid: string): Promise<UserPreferences> {
  const path = `users/${uid}/settings/preferences`;
  try {
    const snap = await getDoc(doc(firestoreDb, 'users', uid, 'settings', 'preferences'));
    if (!snap.exists()) return DEFAULT_USER_PREFERENCES;
    const d = snap.data();
    return {
      theme: d.theme === 'light' ? 'light' : 'dark',
      defaultRadiusKm: clampRadius(d.defaultRadiusKm),
      preferredTravelMode:
        d.preferredTravelMode === 'WALK' || d.preferredTravelMode === 'TWO_WHEELER'
          ? d.preferredTravelMode
          : 'DRIVE',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeUserPreferences(
  uid: string,
  onChange: (prefs: UserPreferences) => void
): Unsubscribe {
  const path = `users/${uid}/settings/preferences`;
  return onSnapshot(
    doc(firestoreDb, 'users', uid, 'settings', 'preferences'),
    (snap) => {
      if (!snap.exists()) {
        onChange(DEFAULT_USER_PREFERENCES);
        return;
      }
      const d = snap.data();
      onChange({
        theme: d.theme === 'light' ? 'light' : 'dark',
        defaultRadiusKm: clampRadius(d.defaultRadiusKm),
        preferredTravelMode:
          d.preferredTravelMode === 'WALK' || d.preferredTravelMode === 'TWO_WHEELER'
            ? d.preferredTravelMode
            : 'DRIVE',
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveUserPreferences(uid: string, prefs: UserPreferences): Promise<void> {
  const path = `users/${uid}/settings/preferences`;
  const ref = doc(firestoreDb, 'users', uid, 'settings', 'preferences');
  const payload = {
    ownerUid: uid,
    theme: prefs.theme === 'light' ? 'light' : 'dark',
    defaultRadiusKm: clampRadius(prefs.defaultRadiusKm),
    preferredTravelMode:
      prefs.preferredTravelMode === 'WALK' || prefs.preferredTravelMode === 'TWO_WHEELER'
        ? prefs.preferredTravelMode
        : 'DRIVE',
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        theme: payload.theme,
        defaultRadiusKm: payload.defaultRadiusKm,
        preferredTravelMode: payload.preferredTravelMode,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserChats(
  uid: string,
  onChange: (chats: FirestoreChatSession[]) => void
): Unsubscribe {
  const path = `users/${uid}/chats`;
  const q = query(
    collection(firestoreDb, 'users', uid, 'chats'),
    where('ownerUid', '==', uid),
    orderBy('updatedAt', 'desc'),
    limit(25)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: FirestoreChatSession[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerUid: String(data.ownerUid || uid),
          title: String(data.title || 'Conversa Gêmeo Digital'),
          companyId: Number(data.companyId || 0),
          companyName: String(data.companyName || ''),
          messageCount: Number(data.messageCount || 0),
          lastMessagePreview: String(data.lastMessagePreview || ''),
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
      });
      onChange(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createUserChat(
  uid: string,
  params: { title: string; companyId?: number | null; companyName?: string }
): Promise<string> {
  const chatId = generateFirestoreId('chat');
  const path = `users/${uid}/chats/${chatId}`;
  try {
    await setDoc(doc(firestoreDb, 'users', uid, 'chats', chatId), {
      ownerUid: uid,
      title: (params.title || 'Nova conversa').slice(0, 160),
      companyId: Number(params.companyId || 0),
      companyName: (params.companyName || '').slice(0, 160),
      messageCount: 0,
      lastMessagePreview: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return chatId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeChatMessages(
  uid: string,
  chatId: string,
  onChange: (messages: FirestoreChatMessage[]) => void
): Unsubscribe {
  const path = `users/${uid}/chats/${chatId}/messages`;
  const q = query(
    collection(firestoreDb, 'users', uid, 'chats', chatId, 'messages'),
    where('ownerUid', '==', uid),
    orderBy('createdAt', 'asc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs: FirestoreChatMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerUid: String(data.ownerUid || uid),
          role: data.role === 'user' ? 'user' : 'assistant',
          content: String(data.content || ''),
          toolUsed: (['cloudsql', 'maps', 'search', 'general'].includes(String(data.toolUsed))
            ? data.toolUsed
            : 'general') as ChatToolUsed,
          screenContext: String(data.screenContext || ''),
          groundingLinks: Array.isArray(data.groundingLinks)
            ? (data.groundingLinks as GroundingLinkItem[])
            : [],
          sourcesUsed: Array.isArray(data.sourcesUsed) ? (data.sourcesUsed as string[]) : [],
          createdAt: data.createdAt || null,
        };
      });
      onChange(msgs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function appendChatMessage(
  uid: string,
  chatId: string,
  params: {
    role: 'user' | 'assistant';
    content: string;
    toolUsed?: ChatToolUsed;
    screenContext?: string;
    groundingLinks?: GroundingLinkItem[];
    sourcesUsed?: string[];
    currentMessageCount: number;
    titleIfEmpty?: string;
    companyId?: number | null;
    companyName?: string;
  }
): Promise<string> {
  const messageId = generateFirestoreId('msg');
  const path = `users/${uid}/chats/${chatId}/messages/${messageId}`;
  const cleanLinks = (params.groundingLinks || [])
    .filter((l) => l && l.uri)
    .slice(0, 10)
    .map((l) => ({
      title: String(l.title || 'Fonte externa').slice(0, 160),
      uri: String(l.uri).slice(0, 1024),
      sourceType: l.sourceType === 'maps' ? 'maps' : 'search',
    }));
  const cleanSources = (params.sourcesUsed || [])
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => String(s).slice(0, 200));
  const contentText = params.content.slice(0, 20000);

  try {
    const batch = writeBatch(firestoreDb);
    const msgRef = doc(firestoreDb, 'users', uid, 'chats', chatId, 'messages', messageId);
    const chatRef = doc(firestoreDb, 'users', uid, 'chats', chatId);

    batch.set(msgRef, {
      ownerUid: uid,
      role: params.role,
      content: contentText,
      toolUsed: params.toolUsed || 'general',
      screenContext: (params.screenContext || '').slice(0, 160),
      groundingLinks: cleanLinks,
      sourcesUsed: cleanSources,
      createdAt: serverTimestamp(),
    });

    const chatUpdate: Record<string, unknown> = {
      messageCount: Math.min(5000, params.currentMessageCount + 1),
      lastMessagePreview: contentText.slice(0, 240),
      updatedAt: serverTimestamp(),
    };
    if (params.titleIfEmpty) {
      chatUpdate.title = params.titleIfEmpty.slice(0, 160);
    }
    if (params.companyId !== undefined && params.companyId !== null) {
      chatUpdate.companyId = Number(params.companyId);
    }
    if (params.companyName !== undefined) {
      chatUpdate.companyName = params.companyName.slice(0, 160);
    }

    batch.update(chatRef, chatUpdate);
    await batch.commit();
    return messageId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteUserChat(uid: string, chatId: string): Promise<void> {
  const path = `users/${uid}/chats/${chatId}`;
  try {
    const msgsRef = collection(firestoreDb, 'users', uid, 'chats', chatId, 'messages');
    const msgsSnap = await getDocs(query(msgsRef, where('ownerUid', '==', uid), limit(200)));
    const batch = writeBatch(firestoreDb);
    msgsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(firestoreDb, 'users', uid, 'chats', chatId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
