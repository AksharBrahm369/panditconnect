"use client";
import {useEffect} from "react";
import Link from "next/link";
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{void fetch("/api/client-errors",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:error.message,digest:error.digest,path:location.pathname}),keepalive:true});},[error]);return <main className="fatal-error"><div><span className="brand-mark">ॐ</span><h1>Something went wrong</h1><p>Your account and request are safe. Please retry. If this keeps happening, open Support from your account.</p><button className="btn btn-primary" onClick={reset}>Try again</button><Link className="btn btn-ghost" href="/">Go home</Link></div></main>}
