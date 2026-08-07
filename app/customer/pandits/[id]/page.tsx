import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CheckCircle2, Clock3, Languages, MapPin, ShieldCheck, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PanditAvatar } from "@/components/pandit-avatar";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type PublicPandit = {
  id: string; name: string; city: string | null; experience_years: number; languages: string[];
  specialities: string[]; bio: string | null; rating: string; rating_count: number;
  completed_jobs: number; is_online: boolean; services: { name: string; charge: number }[];
};

export const dynamic = "force-dynamic";

export default async function CustomerPanditProfile({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?role=customer");
  if (user.role !== "CUSTOMER") redirect(user.role === "PANDIT" ? "/pandit" : "/admin");
  const { id } = await params;
  const result = await sql<PublicPandit>(
    `SELECT u.id,u.name,u.city,p.experience_years,p.languages,p.specialities,p.bio,p.rating,p.rating_count,
       p.completed_jobs,p.is_online,
       COALESCE(json_agg(json_build_object('name',s.name,'charge',ps.charge) ORDER BY s.name)
         FILTER (WHERE s.id IS NOT NULL),'[]') AS services
     FROM pim_v2.pandit_profiles p
     JOIN pim_v2.users u ON u.id=p.user_id
     LEFT JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id
     LEFT JOIN pim_v2.services s ON s.id=ps.service_id
     WHERE p.user_id=$1 AND p.verification_status='APPROVED'
     GROUP BY u.id,u.name,u.city,p.experience_years,p.languages,p.specialities,p.bio,p.rating,p.rating_count,
       p.completed_jobs,p.is_online LIMIT 1`,
    [id],
  );
  const pandit = result.rows[0];
  if (!pandit) notFound();
  const requestUrl = `/customer?pandit=${encodeURIComponent(pandit.id)}&name=${encodeURIComponent(pandit.name)}#request-assistance`;

  return <AppShell role="Customer" title={`${pandit.name}'s verified profile`} subtitle="Review the details that matter before sending a request.">
    <Link href="/customer#customer-home" className="back-review"><ArrowLeft size={16} /> Back to nearby Pandits</Link>
    <section className="public-pandit-profile">
      <div className="public-pandit-hero">
        <PanditAvatar panditId={pandit.id} name={pandit.name} className="public-pandit-avatar" />
        <div><span className="eyebrow"><BadgeCheck size={14} /> Admin verified</span><h1>{pandit.name}</h1><p>{pandit.bio || "An experienced Pandit available for traditional Puja services."}</p><div className="public-pandit-badges"><span className={pandit.is_online ? "online" : ""}>{pandit.is_online ? "Available now" : "Currently offline"}</span>{pandit.city && <span><MapPin size={14} /> Serves families near {pandit.city}</span>}</div></div>
        {pandit.is_online ? <Link href={requestUrl} className="btn btn-primary">Request this Pandit</Link> : <button className="btn btn-primary" disabled>Check again when online</button>}
      </div>
      <div className="public-pandit-summary">
        <span><Star size={20} fill="currentColor" /><strong>{pandit.rating_count ? Number(pandit.rating).toFixed(1) : "New"}</strong><small>{pandit.rating_count ? `${pandit.rating_count} verified ratings` : "Not rated yet"}</small></span>
        <span><Clock3 size={20} /><strong>{pandit.experience_years} years</strong><small>Puja experience</small></span>
        <span><CheckCircle2 size={20} /><strong>{pandit.completed_jobs}</strong><small>Completed through platform</small></span>
      </div>
      <div className="public-pandit-columns">
        <article><h2>Pujas and charges</h2><p>Final requirements are confirmed before booking.</p><div className="public-service-list">{pandit.services.map((service) => <span key={service.name}><b>{service.name}</b><strong>₹{service.charge.toLocaleString("en-IN")}</strong></span>)}</div></article>
        <aside><h2>About this Pandit</h2><div className="public-profile-fact"><Languages size={18} /><span><small>Languages</small><strong>{pandit.languages.join(", ")}</strong></span></div><div className="public-profile-fact"><ShieldCheck size={18} /><span><small>Specialities</small><strong>{pandit.specialities.join(", ")}</strong></span></div><div className="public-safety-note"><ShieldCheck size={18} /><p>Phone number, personal address, documents and payment details stay private. Exact customer addresses are shared only after acceptance.</p></div></aside>
      </div>
    </section>
  </AppShell>;
}
