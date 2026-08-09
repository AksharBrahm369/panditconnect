import type { MetadataRoute } from "next";
import { applicationUrl } from "@/lib/env";

export default function sitemap():MetadataRoute.Sitemap{const base=applicationUrl();return ["","/help","/privacy","/terms","/cancellation-policy","/refund-policy"].map((path)=>({url:`${base}${path}`,lastModified:new Date(),changeFrequency:path?"monthly":"weekly",priority:path?0.5:1}));}
