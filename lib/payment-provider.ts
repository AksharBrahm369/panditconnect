import { createHmac, timingSafeEqual } from "node:crypto";

type ProviderOrder={id:string;amount:number;currency:string;status:string};

function config(){const provider=process.env.PAYMENT_PROVIDER?.trim().toLowerCase();const keyId=process.env.PAYMENT_PROVIDER_KEY_ID?.trim();const secret=process.env.PAYMENT_PROVIDER_KEY_SECRET?.trim();if(provider!=="razorpay"||!keyId||!secret)throw new Error("Online payments are not configured");return {provider,keyId,secret};}

export function paymentPublicConfig(){const provider=process.env.PAYMENT_PROVIDER?.trim().toLowerCase();return provider==="razorpay"&&process.env.PAYMENT_PROVIDER_KEY_ID?.trim()?{enabled:true,provider,keyId:process.env.PAYMENT_PROVIDER_KEY_ID.trim()}:{enabled:false,provider:"development",keyId:""};}

export async function createProviderOrder(input:{amountRupees:number;receipt:string;notes:Record<string,string>}):Promise<ProviderOrder>{const c=config();const response=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${c.keyId}:${c.secret}`).toString("base64")}`,"Content-Type":"application/json"},body:JSON.stringify({amount:input.amountRupees*100,currency:"INR",receipt:input.receipt,notes:input.notes})});if(!response.ok)throw new Error(`Payment provider order failed (${response.status})`);return response.json() as Promise<ProviderOrder>;}

export function verifyProviderWebhook(raw:string,signature:string|null){const secret=process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET?.trim();if(!secret||!signature)return false;const expected=createHmac("sha256",secret).update(raw).digest("hex");const a=Buffer.from(expected);const b=Buffer.from(signature);return a.length===b.length&&timingSafeEqual(a,b);}

export async function createProviderRefund(paymentId:string,amountRupees:number,notes:Record<string,string>){const c=config();const response=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${c.keyId}:${c.secret}`).toString("base64")}`,"Content-Type":"application/json"},body:JSON.stringify({amount:amountRupees*100,notes})});if(!response.ok)throw new Error(`Payment provider refund failed (${response.status})`);return response.json() as Promise<{id:string;status:string}>;}
