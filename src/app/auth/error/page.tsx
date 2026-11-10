import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n/server";
import { startGoogleAuth } from "@/app/actions/auth";
import { GoogleSubmit } from "@/components/account-control";
export const metadata:Metadata={title:"Google sign-in",robots:{index:false,follow:false}};
export default async function AuthError({searchParams}:{searchParams:Promise<{reason?:string}>}){
  const t=await getTranslations();const {reason}=await searchParams;
  return <main id="main" className="shell auth-error-page"><p className="eyebrow">FESTIVA ACCOUNT</p><h1>{t("로그인을 완료하지 못했어요.")}</h1>
    <p>{reason==="unavailable"?t("구글 로그인을 준비 중이에요."):reason==="handoff"?t("기존 행사를 계정에 연결하지 못했어요. 다시 시도해주세요."):reason==="existing"?t("이미 가입한 계정이에요. 계속 로그인하면 이 브라우저의 행사도 연결됩니다."):t("취소했거나 연결이 만료되었어요. 다시 시도할 수 있어요.")}</p>
    {process.env.GOOGLE_AUTH_ENABLED==="true"&&<><form action={startGoogleAuth}><input type="hidden" name="next" value="/me/events"/>{reason==="existing"&&<input type="hidden" name="mode" value="existing"/>}<GoogleSubmit/></form>{reason!=="existing"&&<form action={startGoogleAuth}><input type="hidden" name="mode" value="existing"/><input type="hidden" name="next" value="/me/events"/><button className="text-link" type="submit">{t("이미 가입한 Google 계정으로 로그인")}</button></form>}</>}
    <Link className="text-link" href="/">{t("← 돌아가기")}</Link></main>;
}
