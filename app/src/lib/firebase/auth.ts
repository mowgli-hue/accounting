import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { getAppAuth, getAppDb } from "./config";

export async function signUp(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(getAppAuth(), email, password);
  await updateProfile(cred.user, { displayName });
  await setDoc(doc(getAppDb(), "users", cred.user.uid), {
    id: cred.user.uid,
    email,
    displayName,
    currency: "USD",
    createdAt: Timestamp.now(),
  });
  return cred.user;
}

export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(getAppAuth(), email, password);
  return cred.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(getAppAuth(), provider);
  const userDoc = await getDoc(doc(getAppDb(), "users", cred.user.uid));
  if (!userDoc.exists()) {
    await setDoc(doc(getAppDb(), "users", cred.user.uid), {
      id: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName || "User",
      currency: "USD",
      createdAt: Timestamp.now(),
    });
  }
  return cred.user;
}

export async function signOut() {
  await firebaseSignOut(getAppAuth());
}
