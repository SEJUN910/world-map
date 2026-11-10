"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
export type Account = { id: string; name: string; anonymous: boolean } | null;
export function publicAccount(user: User | null): Account { return user ? { id:user.id, name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.slice(0,80) : "", anonymous:!!user.is_anonymous } : null; }
const Context=createContext<{account:Account;googleReady:boolean}>({account:null,googleReady:false});
export function AccountProvider({initialAccount,googleReady,children}:{initialAccount:Account;googleReady:boolean;children:React.ReactNode}){
  const [account,setAccount]=useState(initialAccount);
  useEffect(()=>{setAccount(initialAccount);},[initialAccount?.id,initialAccount?.anonymous,initialAccount?.name]);
  useEffect(()=>{const {data}=createClient().auth.onAuthStateChange((_event,session)=>{setAccount(publicAccount(session?.user||null));});return()=>data.subscription.unsubscribe();},[]);
  return <Context.Provider value={{account,googleReady}}>{children}</Context.Provider>;
}
export function useAccount(){return useContext(Context);}
