import type { MetadataRoute } from "next";
import { applicationUrl } from "@/lib/env";

export default function robots():MetadataRoute.Robots{return {rules:[{userAgent:"*",allow:["/","/privacy","/terms","/cancellation-policy","/refund-policy"],disallow:["/admin","/customer","/pandit","/api/"]}],sitemap:`${applicationUrl()}/sitemap.xml`};}
