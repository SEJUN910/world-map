"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useTranslations } from "./language-provider";
import { useAccount } from "./account-provider";
import { signOutAccount, startGoogleAuth } from "@/app/actions/auth";
import { safeAuthReturn } from "@/lib/auth";
export function GoogleSubmit({disabled=false}:{disabled?:boolean}){
  const {t}=useTranslations();const {pending}=useFormStatus();
  return <button className="google-sign-in" type="submit" disabled={disabled||pending}>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.9 6.1-14.9Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12.2 12.2 0 0 1 0-7.2v-5.2H5.8a20.2 20.2 0 0 0 0 17.6l6.8-5.2Z"/><path fill="#EA4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z"/></svg>
    {pending?t("연결 중…"):t("Google로 계속하기")}</button>;
}
function AccountDialog({onClose,opener,next}:{onClose:()=>void;opener:React.RefObject<HTMLButtonElement|null>;next:string}){
  const {t}=useTranslations();const {account,googleReady}=useAccount();const dialog=useRef<HTMLDialogElement>(null);const close=useRef<HTMLButtonElement>(null);
  useLayoutEffect(()=>{const el=dialog.current!;const overflow=document.body.style.overflow;document.body.style.overflow="hidden";el.showModal();close.current?.focus();return()=>{if(el.open)el.close();document.body.style.overflow=overflow;if(opener.current?.isConnected)opener.current.focus();};},[opener]);
  const member=account&&!account.anonymous;
  return <dialog ref={dialog} className="account-dialog" aria-labelledby="account-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="account-dialog__panel">
    <button ref={close} className="account-dialog__close" aria-label={t("닫기")} onClick={onClose}>×</button>
    <p className="eyebrow">FESTIVA ACCOUNT</p><h2 id="account-title">{member?(account.name||t("내 계정")):t("어디서든 이어지는 발견")}</h2>
    {member?<><p>{t("구글 계정으로 연결되어 있어요.")}</p><Link className="button" href="/me/events" onClick={onClose}>{t("내 행사")}</Link><form action={signOutAccount}><button className="text-link" type="submit">{t("로그아웃")}</button></form></>:<><p>{t("Google로 로그인하면 다른 기기에서도 내 행사를 관리할 수 있어요. 처음이면 자동으로 가입됩니다.")}</p>
      {account?.anonymous&&<p className="fine-print">{t("이 브라우저에서 올린 행사도 계정에 연결됩니다.")}</p>}
      <form action={startGoogleAuth}><input type="hidden" name="next" value={next}/><GoogleSubmit disabled={!googleReady}/></form>
      {!googleReady&&<p className="fine-print" role="status">{t("구글 로그인을 준비 중이에요.")}</p>}
    </>}
  </div></dialog>;
}
export function AccountControl({compact=false}:{compact?:boolean}){
  const {t}=useTranslations();const {account}=useAccount();const opener=useRef<HTMLButtonElement>(null);const [open,setOpen]=useState(false);const [next,setNext]=useState("/me/events");const member=account&&!account.anonymous;
  return <><button ref={opener} className={`account-control${compact ? " account-control--compact" : ""}`} type="button" aria-label={member?t("내 계정"):t("로그인")} title={member?t("내 계정"):t("로그인")} onClick={()=>{setNext(safeAuthReturn(location.pathname+location.search));setOpen(true);}}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2" stroke="currentColor" strokeWidth="1.4"/></svg>{!compact&&<span>{member?t("내 계정"):t("로그인")}</span>}</button>
    {open&&<AccountDialog opener={opener} next={next} onClose={()=>setOpen(false)}/>}</>;
}
