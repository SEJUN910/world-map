"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { welcomeCookie } from "@/lib/auth";
import { useTranslations } from "./language-provider";
import type { User } from "@supabase/supabase-js";
export type Account = { id: string; name: string; anonymous: boolean } | null;
export function publicAccount(user: User | null): Account { return user ? { id:user.id, name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.slice(0,80) : "", anonymous:!!user.is_anonymous } : null; }
const Context=createContext<{account:Account;googleReady:boolean}>({account:null,googleReady:false});
export function AccountProvider({initialAccount,googleReady,children}:{initialAccount:Account;googleReady:boolean;children:React.ReactNode}){
  const {t}=useTranslations();
  const [account,setAccount]=useState(initialAccount);
  const [welcome,setWelcome]=useState("");
  useEffect(()=>{setAccount(initialAccount);},[initialAccount?.id,initialAccount?.anonymous,initialAccount?.name]);
  useEffect(()=>{const {data}=createClient().auth.onAuthStateChange((_event,session)=>{setAccount(publicAccount(session?.user||null));});return()=>data.subscription.unsubscribe();},[]);
  // Greet once right after a Google sign-in (the callback leaves a short-lived cookie).
  const member=!!account&&!account.anonymous;
  useEffect(()=>{
    if(!member||!document.cookie.split("; ").includes(`${welcomeCookie}=1`)) return;
    document.cookie=`${welcomeCookie}=; path=/; max-age=0`;
    const name=account!.name.trim();
    setWelcome(name?t("{name}님, 반가워요",{name}):t("로그인했어요"));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only when membership changes
  },[member]);
  // Own effect so the hide timer is re-armed if the effect above re-runs (dev StrictMode).
  useEffect(()=>{if(!welcome)return;const timer=setTimeout(()=>setWelcome(""),3500);return()=>clearTimeout(timer);},[welcome]);
  return <Context.Provider value={{account,googleReady}}>{children}<p className={`saved-toast${welcome?" is-visible":""}`} role="status">{welcome}</p></Context.Provider>;
}
export function useAccount(){return useContext(Context);}
